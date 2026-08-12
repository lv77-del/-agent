import { db, ensureDb, id, now, parseJson } from "@/lib/db";
import { runAiNewsCollector } from "@/lib/integrations/ai-news-collector";

export async function collectNewsIntelligence(
  hours:6|12|24,
  actor={workspaceId:"workspace_local",userId:"user_local"},
){
  await ensureDb();
  const result=await runAiNewsCollector(hours),t=now(),taskId=id("analysis"),reportId=id("report");
  await db.execute({
    sql:"INSERT INTO analysis_tasks (id,name,keywords,date_range_days,collection_limit,status,progress,article_count,insight_count,created_at,updated_at,completed_at,workspace_id,created_by) VALUES (?,?,?,1,?,'completed',100,?,?,?,?,?,?,?,?)",
    args:[taskId,`AI 资讯 ${hours} 小时情报`,JSON.stringify(["AI 新闻","每日资讯"]),result.sourceItems.length,result.sourceItems.length,Math.min(5,result.topicCandidates.length),t,t,t,actor.workspaceId,actor.userId],
  });
  const sourceStatements=result.sourceItems.map(row=>({
    sql:"INSERT INTO source_articles (id,analysis_task_id,external_id,title,body,source_name,source_url,published_at,read_count,like_count,wow_count,interaction_rate,ai_summary,tags,created_at,workspace_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    args:[id("source"),taskId,String(row.item_uid||""),String(row.title_zh||row.title||""),String(row.content||""),String(row.source_name||""),String(row.url||""),row.published_at?String(row.published_at):null,Number(row.view_count||0),Number(row.like_count||0),Number(row.favorite_count||0),0,String(row.summary_zh||row.summary||""),String(row.tags_json||"[]"),t,actor.workspaceId],
  }));
  if(sourceStatements.length)await db.batch(sourceStatements,"write");
  const top=result.sourceItems.slice(0,5).map(x=>({id:x.item_uid,title:x.title_zh||x.title,sourceName:x.source_name,url:x.url,readCount:x.view_count||0,likeCount:x.like_count||0,interactionRate:0}));
  await db.execute({
    sql:"INSERT INTO insight_reports (id,analysis_task_id,summary,metrics,word_cloud,top_articles,created_at,updated_at,workspace_id) VALUES (?,?,?,?,?,?,?,?,?)",
    args:[reportId,taskId,`AI-news-collector 已完成过去 ${hours} 小时的采集、去重、聚类和选题候选生成。`,JSON.stringify({articleCount:result.sourceItems.length,topicCandidateCount:result.topicCandidates.length,collectorMode:result.mode}),"[]",JSON.stringify({byRead:top,byLike:top,byInteraction:top}),t,t,actor.workspaceId],
  });
  const insightStatements=result.topicCandidates.slice(0,5).map((row,rank)=>({
    sql:"INSERT INTO topic_insights (id,report_id,rank,title,angle,audience,rationale,evidence,platform_fit,status,created_at,workspace_id) VALUES (?,?,?,?,?,?,?,?,?,'candidate',?,?)",
    args:[id("insight"),reportId,rank+1,String(row.title||""),String(row.angle||""),parseJson<string[]>(row.target_audience_json,[]).join("、"),String(row.reason||""),String(row.reference_items_json||"[]"),String(row.recommended_platforms_json||"[]"),t,actor.workspaceId],
  }));
  if(insightStatements.length)await db.batch(insightStatements,"write");
  return{taskId,reportId,hours,articleCount:result.sourceItems.length,topicCandidateCount:result.topicCandidates.length,briefing:result.briefing,html:result.html};
}
