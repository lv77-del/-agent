import { runAnalysis } from "@/lib/workflows/analysis";
import { apiError, ok } from "@/lib/http";
import { getRequestActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail } from "@/lib/http";
export const maxDuration=300;
export async function POST(_:Request,c:{params:Promise<{id:string}>}){try{const actor=await getRequestActor(),{id}=await c.params;const task=await db.execute({sql:"SELECT id FROM analysis_tasks WHERE id=? AND workspace_id=?",args:[id,actor.workspaceId]});if(!task.rows[0])return fail("分析任务不存在",404);return ok(await runAnalysis(id))}catch(error){return apiError(error)}}
