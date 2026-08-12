import { z } from "zod";
import { getRequestActor } from "@/lib/auth";
import { db, now } from "@/lib/db";
import { apiError, fail, ok } from "@/lib/http";
import { serializeTask } from "@/lib/serializers";

const schema=z.object({status:z.enum(["queued","collecting","summarizing","analyzing","completed","failed"]).optional(),progress:z.number().int().min(0).max(100).optional(),errorMessage:z.string().nullable().optional()});
export async function GET(_:Request,c:{params:Promise<{id:string}>}){try{const actor=await getRequestActor(),{id}=await c.params;const r=await db.execute({sql:"SELECT * FROM analysis_tasks WHERE id=? AND workspace_id=?",args:[id,actor.workspaceId]});return r.rows[0]?ok(serializeTask(r.rows[0])):fail("分析任务不存在",404)}catch(error){return apiError(error)}}
export async function PATCH(request:Request,c:{params:Promise<{id:string}>}){try{const actor=await getRequestActor(),{id}=await c.params,x=schema.parse(await request.json());const current=await db.execute({sql:"SELECT * FROM analysis_tasks WHERE id=? AND workspace_id=?",args:[id,actor.workspaceId]});if(!current.rows[0])return fail("分析任务不存在",404);const r=current.rows[0],status=x.status??String(r.status);await db.execute({sql:"UPDATE analysis_tasks SET status=?,progress=?,error_message=?,updated_at=?,completed_at=? WHERE id=? AND workspace_id=?",args:[status,x.progress??r.progress,x.errorMessage===undefined?r.error_message:x.errorMessage,now(),status==="completed"?now():r.completed_at,id,actor.workspaceId]});const result=await db.execute({sql:"SELECT * FROM analysis_tasks WHERE id=? AND workspace_id=?",args:[id,actor.workspaceId]});return ok(serializeTask(result.rows[0]))}catch(error){return apiError(error)}}
