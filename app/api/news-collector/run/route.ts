import { z } from "zod";
import { getRequestActor } from "@/lib/auth";
import { db, id, now } from "@/lib/db";
import { inngest } from "@/lib/inngest";
import { apiError, ok } from "@/lib/http";
import { collectNewsIntelligence } from "@/lib/workflows/news-intelligence";
export const runtime="nodejs";export const maxDuration=300;
const schema=z.object({hours:z.union([z.literal(6),z.literal(12),z.literal(24)]).default(24),intent:z.string().optional()});
export async function POST(request:Request){try{
  const actor=await getRequestActor(),x=schema.parse(await request.json().catch(()=>({})));
  if(!process.env.INNGEST_EVENT_KEY)return ok(await collectNewsIntelligence(x.hours,actor),201);
  const jobId=id("job"),t=now();
  await db.execute({sql:"INSERT INTO background_jobs (id,workspace_id,user_id,type,status,payload,created_at,updated_at) VALUES (?,?,?,'news_collection','queued',?,?,?)",args:[jobId,actor.workspaceId,actor.userId,JSON.stringify({hours:x.hours}),t,t]});
  await inngest.send({name:"content/news.collect.requested",data:{jobId,hours:x.hours,workspaceId:actor.workspaceId,userId:actor.userId}});
  return ok({jobId,status:"queued",articleCount:0,topicCandidateCount:0,message:"采集任务已进入后台队列"},202);
}catch(error){return apiError(error)}}
