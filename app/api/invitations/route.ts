import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { getRequestActor } from "@/lib/auth";
import { db, id, now } from "@/lib/db";
import { apiError, fail, ok } from "@/lib/http";

const input = z.object({ email:z.string().email(), role:z.enum(["editor","reviewer"]).default("editor") });
export async function GET(){try{const actor=await getRequestActor();const r=await db.execute({sql:"SELECT id,email,role,status,expires_at,created_at FROM invitations WHERE workspace_id=? ORDER BY created_at DESC",args:[actor.workspaceId]});return ok(r.rows)}catch(error){return apiError(error)}}
export async function POST(request:Request){try{
  const actor=await getRequestActor(); if(actor.role!=="owner")return fail("只有管理员可以邀请成员",403);
  const x=input.parse(await request.json()),token=randomBytes(24).toString("hex"),t=now();
  const expires=new Date(Date.now()+7*86400000).toISOString();
  await db.execute({sql:"INSERT INTO invitations (id,workspace_id,email,role,token_hash,status,expires_at,invited_by,created_at) VALUES (?,?,?,?,?,'pending',?,?,?)",args:[id("invite"),actor.workspaceId,x.email,x.role,createHash("sha256").update(token).digest("hex"),expires,actor.userId,t]});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,app=process.env.NEXT_PUBLIC_APP_URL;
  let emailSent=false;
  if(url&&key&&app){const sent=await fetch(`${url}/auth/v1/invite?redirect_to=${encodeURIComponent(`${app}/auth/callback`)}`,{method:"POST",headers:{apikey:key,authorization:`Bearer ${key}`,"content-type":"application/json"},body:JSON.stringify({email:x.email})});if(!sent.ok)throw new Error(`邀请邮件发送失败：${await sent.text()}`);emailSent=true}
  return ok({email:x.email,role:x.role,expiresAt:expires,emailSent,message:emailSent?"邀请邮件已发送":"邀请已登记；配置服务端密钥后将自动发送邮件"},201);
}catch(error){return apiError(error)}}
