import { getRequestActor } from "@/lib/auth";
import { db, parseJson } from "@/lib/db";
import { apiError, ok } from "@/lib/http";
export async function GET(){try{const actor=await getRequestActor();const r=await db.execute({sql:"SELECT * FROM background_jobs WHERE workspace_id=? ORDER BY created_at DESC LIMIT 50",args:[actor.workspaceId]});return ok(r.rows.map(x=>({...x,payload:parseJson(x.payload,{}),result:parseJson(x.result,{})})))}catch(error){return apiError(error)}}
