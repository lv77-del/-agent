import { db, ensureDb, id, now } from "@/lib/db";
import { collectWechatArticles } from "@/lib/integrations/collection";
import { generateText } from "@/lib/integrations/ai";

type Summary={summary:string;topics:string[];keywords:string[];audience:string;angle:string};
type Insight={title:string;angle:string;audience:string;rationale:string;evidence:string[];platformFit:string[]};

function parseObject<T>(text:string):T{
 const cleaned=text.replace(/^```(?:json)?/i,"").replace(/```$/i,"").trim();
 return JSON.parse(cleaned) as T;
}
async function mapLimit<T,R>(items:T[],limit:number,fn:(item:T,index:number)=>Promise<R>){
 const output=new Array<R>(items.length);let cursor=0;
 async function worker(){while(cursor<items.length){const index=cursor++;output[index]=await fn(items[index],index)}}
 await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));return output;
}
async function setProgress(taskId:string,status:string,progress:number,error:string|null=null){
 await db.execute({sql:"UPDATE analysis_tasks SET status=?,progress=?,error_message=?,updated_at=? WHERE id=?",args:[status,progress,error,now(),taskId]});
}

export async function runAnalysis(taskId:string){
 await ensureDb();
 const taskResult=await db.execute({sql:"SELECT * FROM analysis_tasks WHERE id=?",args:[taskId]});
 if(!taskResult.rows[0])throw new Error("分析任务不存在");
 const task=taskResult.rows[0];
 const workspaceId=String(task.workspace_id||"workspace_local");
 try{
  await setProgress(taskId,"collecting",5);
  const keywords=JSON.parse(String(task.keywords)) as string[];
  const collected=await collectWechatArticles({keywords,limit:Number(task.collection_limit),dateRangeDays:Number(task.date_range_days)});
  const unique=[...new Map(collected.map(a=>[a.sourceUrl||`${a.sourceName}:${a.title}`,a])).values()];
  const created=now();
  await db.batch(unique.map(a=>{const rate=a.readCount>0?(a.likeCount+a.wowCount)/a.readCount:0;return{sql:"INSERT INTO source_articles (id,analysis_task_id,external_id,title,body,source_name,source_url,published_at,read_count,like_count,wow_count,interaction_rate,created_at,workspace_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",args:[id("source"),taskId,a.externalId??null,a.title,a.body,a.sourceName,a.sourceUrl??null,a.publishedAt??null,a.readCount,a.likeCount,a.wowCount,rate,created,workspaceId]}}),"write");
  await db.execute({sql:"UPDATE analysis_tasks SET article_count=?,updated_at=? WHERE id=?",args:[unique.length,now(),taskId]});
  await setProgress(taskId,"summarizing",18);
  const rows=(await db.execute({sql:"SELECT * FROM source_articles WHERE analysis_task_id=?",args:[taskId]})).rows;
  const summaries=await mapLimit(rows,4,async(row,index)=>{
   const result=parseObject<Summary>(await generateText([{role:"system",content:"你是内容研究员。只输出合法 JSON，字段为 summary、topics、keywords、audience、angle。摘要必须忠于原文，不补充原文没有的事实。"},{role:"user",content:`标题：${row.title}\n来源：${row.source_name}\n正文：${String(row.body).slice(0,18000)}`}],{json:true,workspaceId}));
   await db.execute({sql:"UPDATE source_articles SET ai_summary=?,tags=? WHERE id=?",args:[result.summary,JSON.stringify([...new Set([...(result.topics||[]),...(result.keywords||[])])]),row.id]});
   await setProgress(taskId,"summarizing",18+Math.round(((index+1)/rows.length)*52));
   return{...result,id:String(row.id),title:String(row.title),sourceName:String(row.source_name),readCount:Number(row.read_count),likeCount:Number(row.like_count),wowCount:Number(row.wow_count),interactionRate:Number(row.interaction_rate)};
  });
  await setProgress(taskId,"analyzing",75);
  const aggregate=parseObject<{summary:string;wordCloud:{word:string;count:number}[];insights:Insight[]}>(await generateText([{role:"system",content:"你是资深中文内容策略师。根据文章摘要和真实指标生成选题洞察。只输出合法 JSON：summary、wordCloud（15项）、insights（严格5项，每项含 title、angle、audience、rationale、evidence、platformFit）。不得伪造输入中没有的数据。"},{role:"user",content:JSON.stringify({keywords,articles:summaries})}],{json:true,workspaceId}));
  const byRead=[...summaries].sort((a,b)=>b.readCount-a.readCount).slice(0,5);
  const byLike=[...summaries].sort((a,b)=>b.likeCount-a.likeCount).slice(0,5);
  const byInteraction=[...summaries].sort((a,b)=>b.interactionRate-a.interactionRate).slice(0,5);
  const reportId=id("report"),t=now();
  await db.batch([{sql:"INSERT INTO insight_reports (id,analysis_task_id,summary,metrics,word_cloud,top_articles,created_at,updated_at,workspace_id) VALUES (?,?,?,?,?,?,?,?,?)",args:[reportId,taskId,aggregate.summary,JSON.stringify({articleCount:rows.length,totalReads:summaries.reduce((s,a)=>s+a.readCount,0),averageInteractionRate:summaries.reduce((s,a)=>s+a.interactionRate,0)/Math.max(summaries.length,1)}),JSON.stringify(aggregate.wordCloud),JSON.stringify({byRead,byLike,byInteraction}),t,t,workspaceId]},...aggregate.insights.slice(0,5).map((x,rank)=>({sql:"INSERT INTO topic_insights (id,report_id,rank,title,angle,audience,rationale,evidence,platform_fit,status,created_at,workspace_id) VALUES (?,?,?,?,?,?,?,?,?,'candidate',?,?)",args:[id("insight"),reportId,rank+1,x.title,x.angle,x.audience,x.rationale,JSON.stringify(x.evidence||[]),JSON.stringify(x.platformFit||[]),t,workspaceId]}))],"write");
  await db.execute({sql:"UPDATE analysis_tasks SET status='completed',progress=100,insight_count=5,completed_at=?,updated_at=? WHERE id=?",args:[now(),now(),taskId]});
  return{taskId,reportId,articleCount:rows.length,insightCount:5};
 }catch(error){await setProgress(taskId,"failed",Number(task.progress)||0,error instanceof Error?error.message:"未知错误");throw error}
}
