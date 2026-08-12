import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { createClient } from "@libsql/client";

const execFileAsync=promisify(execFile);
export type NewsCollectorResult={
 mode:"local"|"remote";database?:string;briefing?:string;html?:string;
 sourceItems:Array<Record<string,unknown>>;topicCandidates:Array<Record<string,unknown>>;
};

function decodeHtmlEntities(value:string){
 return value
  .replace(/&#(\d+);/g,(_,code)=>String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi,(_,code)=>String.fromCodePoint(Number.parseInt(code,16)))
  .replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&lt;/gi,"<")
  .replace(/&gt;/gi,">").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'");
}

function cleanDisplayText(value:unknown){
 return decodeHtmlEntities(String(value||""))
  .replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ")
  .replace(/<[^>]+>/g," ").replace(/https?:\/\/\S+/gi," ").replace(/\s+/g," ").trim();
}

function displayCategory(row:Record<string,unknown>){
 const text=[row.title,row.title_zh,row.summary,row.tags_json,row.content_type].join(" ").toLowerCase();
 if(row.source_type==="github"||/开源|open.?source|open.?weight|github/.test(text))return "open_source";
 if(row.source_type==="paper"||/论文|研究|research|benchmark|tutorial|模型架构/.test(text))return "research";
 if(row.content_type==="launch"||/发布|上线|release|launch|新模型|更新/.test(text))return "product";
 return "other";
}

function prepareResult(result:NewsCollectorResult):NewsCollectorResult{
 const sourceItems=result.sourceItems.map(row=>{
  const titleZh=cleanDisplayText(row.title_zh); const summaryZh=cleanDisplayText(row.summary_zh);
  const originalTitle=cleanDisplayText(row.title); const originalSummary=cleanDisplayText(row.summary||row.content);
  const chineseReady=row.translation_status!=="needs_translation"&&/[㐀-鿿]/.test(`${titleZh}${summaryZh}`);
  return{...row,display_title:chineseReady?(titleZh||originalTitle):originalTitle,display_summary:chineseReady?(summaryZh||originalSummary):originalSummary,is_chinese_ready:chineseReady,display_category:displayCategory(row)} as Record<string,unknown>&{is_chinese_ready:boolean};
 });
 const chineseSourceIds=new Set(sourceItems.filter(row=>row.is_chinese_ready).map(row=>String(row["item_uid"])));
 const topicCandidates=result.topicCandidates.map(row=>{
  const title=cleanDisplayText(row.title); const reason=cleanDisplayText(row.reason||row.angle)
   .replace(/news_analysis\s*类选题/gi,"新闻解读类选题").replace(/analysis\s*类选题/gi,"深度分析类选题")
   .replace(/wechat/gi,"公众号").replace(/、?x([。；，,\s]|$)/gi,"、X（推特）$1");
  return{...row,display_title:title,display_reason:reason,is_chinese_ready:chineseSourceIds.has(String(row.source_item_uid))&&/[㐀-鿿]/.test(title)};
 });
 return{...result,sourceItems,topicCandidates};
}

export function shouldUseAiNewsCollector(input:{lane?:string;query?:string;keywords?:string[]}){
 if(input.lane==="subscription_collection")return true;
 const text=[input.query,...(input.keywords||[])].filter(Boolean).join(" ").toLowerCase();
 return /ai.?新闻|ai.?资讯|ai.?日报|过去\s*(6|12|24)\s*小时|今日热点|素材池|daily.?brief|ai.?news/.test(text);
}

function defaults(){
 const home=process.env.USERPROFILE||process.env.HOME||"";
 const root=process.env.AI_NEWS_COLLECTOR_ROOT||path.join(home,".codex","skills","ai-news-collector");
 const python=process.env.AI_NEWS_COLLECTOR_PYTHON||path.join(process.cwd(),".runtime","ai-news-collector","Scripts","python.exe");
 return{root,python};
}

export async function readAiNewsCollectorLatest():Promise<NewsCollectorResult>{
 const remote=process.env.AI_NEWS_COLLECTOR_WORKER_URL;
 if(remote)return callRemote(`${remote.replace(/\/$/,"")}/latest`,{method:"GET"});
 const {root}=defaults();return readOutputs(root);
}

async function callRemote(url:string,init:RequestInit):Promise<NewsCollectorResult>{
 const response=await fetch(url,{...init,headers:{"content-type":"application/json",authorization:`Bearer ${process.env.AI_NEWS_COLLECTOR_WORKER_TOKEN||""}`,...init.headers},cache:"no-store",signal:AbortSignal.timeout(290000)});
 if(!response.ok)throw new Error(`AI-news-collector Worker 调用失败（${response.status}）：${await response.text()}`);
 const body=await response.json() as NewsCollectorResult|{ok:boolean;data:NewsCollectorResult;error?:{message?:string}};
 const result="data" in body?body.data:body;
 return prepareResult({...result,mode:"remote"});
}

async function readOutputs(root:string):Promise<NewsCollectorResult>{
 const database=path.join(root,"data","media_sources.sqlite");
 const client=createClient({url:`file:${database}`});
 const bucket=(await client.execute("SELECT MAX(daily_bucket) AS bucket FROM collection_runs")).rows[0]?.bucket;
 const source=await client.execute({sql:"SELECT item_uid,title,title_zh,source_name,source_type,content_type,platform,url,published_at,summary,summary_zh,content,tags_json,view_count,like_count,comment_count,repost_count,favorite_count,engagement_velocity_score,platform_engagement_percentile,source_priority,source_reliability,freshness_score,collector_rank_score,is_official_source,is_primary_source,translation_status,quality_flags_json,platform_hint_json,status FROM source_items WHERE daily_bucket=? AND status='new' ORDER BY collector_rank_score DESC",args:[bucket]});
 const topics=await client.execute({sql:"SELECT candidate_uid,cluster_uid,title,source_title,angle,topic_type,core_question,target_audience_json,topic_score,score_breakdown_json,platform_fit_json,recommended_platforms_json,source_item_uid,reference_items_json,reason,status FROM topic_candidates WHERE daily_bucket=? ORDER BY topic_score DESC",args:[bucket]});
 await client.close();
 const date=String(bucket);return prepareResult({mode:"local",database,briefing:path.join(root,"data","briefings",`${date}.ai-hot-brief.md`),html:path.join(root,"data","briefings",`${date}.ai-hot-brief.html`),sourceItems:source.rows as Array<Record<string,unknown>>,topicCandidates:topics.rows as Array<Record<string,unknown>>});
}

export async function runAiNewsCollector(hours:6|12|24=24):Promise<NewsCollectorResult>{
 const remote=process.env.AI_NEWS_COLLECTOR_WORKER_URL;
 if(remote)return callRemote(`${remote.replace(/\/$/,"")}/run`,{method:"POST",body:JSON.stringify({hours})});
 const {root,python}=defaults();
 await execFileAsync(python,[path.join(root,"scripts","workflow.py"),"--config",path.join(root,"config","sources.yaml"),"--mode","full","--hours",String(hours)],{cwd:root,timeout:300000,maxBuffer:10*1024*1024});
 return readOutputs(root);
}
