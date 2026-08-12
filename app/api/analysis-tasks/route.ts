import { z } from "zod";
import { db, ensureDb, id, now } from "@/lib/db";
import { apiError, ok } from "@/lib/http";
import { serializeTask } from "@/lib/serializers";
import { getRequestActor } from "@/lib/auth";

const schema=z.object({name:z.string().trim().min(2).max(100),keywords:z.array(z.string().trim().min(1)).min(1).max(10),excludedKeywords:z.array(z.string()).max(20).default([]),dateRangeDays:z.number().int().min(1).max(365).default(7),collectionLimit:z.number().int().min(5).max(500).default(50)});
export async function GET(){try{const actor=await getRequestActor();const r=await db.execute({sql:"SELECT * FROM analysis_tasks WHERE workspace_id=? ORDER BY created_at DESC",args:[actor.workspaceId]});return ok(r.rows.map(serializeTask));}catch(error){return apiError(error)}}
export async function POST(request:Request){try{const actor=await getRequestActor();const x=schema.parse(await request.json());const taskId=id("analysis"),t=now();await db.execute({sql:"INSERT INTO analysis_tasks (id,name,keywords,excluded_keywords,date_range_days,collection_limit,status,created_at,updated_at,workspace_id,created_by) VALUES (?,?,?,?,?,?,'queued',?,?,?,?)",args:[taskId,x.name,JSON.stringify(x.keywords),JSON.stringify(x.excludedKeywords),x.dateRangeDays,x.collectionLimit,t,t,actor.workspaceId,actor.userId]});const r=await db.execute({sql:"SELECT * FROM analysis_tasks WHERE id=? AND workspace_id=?",args:[taskId,actor.workspaceId]});return ok(serializeTask(r.rows[0]),201);}catch(error){return apiError(error)}}
