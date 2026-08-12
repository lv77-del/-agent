import path from "node:path";
import { existsSync } from "node:fs";
import { getRequestActor } from "@/lib/auth";
import { apiError, ok } from "@/lib/http";
export const runtime="nodejs";
export async function GET(){try{await getRequestActor();const remote=process.env.AI_NEWS_COLLECTOR_WORKER_URL;if(remote)return ok({installed:true,mode:"remote",workerUrlConfigured:true,triggerPolicy:"subscription_collection_only",supportedHours:[6,12,24]});const home=process.env.USERPROFILE||process.env.HOME||"",root=process.env.AI_NEWS_COLLECTOR_ROOT||path.join(home,".codex","skills","ai-news-collector");return ok({installed:existsSync(path.join(root,"SKILL.md")),mode:"local",workerUrlConfigured:false,triggerPolicy:"subscription_collection_only",supportedHours:[6,12,24]})}catch(error){return apiError(error)}}
