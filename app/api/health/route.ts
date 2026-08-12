import { db, ensureDb } from "@/lib/db";
import { apiError, ok } from "@/lib/http";
export async function GET(){try{await ensureDb();await db.execute("SELECT 1");return ok({status:"healthy",database:"connected",timestamp:new Date().toISOString()});}catch(error){return apiError(error)}}
