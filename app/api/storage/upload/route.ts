import { createClient } from "@supabase/supabase-js";
import { getRequestActor } from "@/lib/auth";
import { apiError, fail, ok } from "@/lib/http";

export const runtime="nodejs";
const allowed=new Set(["image/jpeg","image/png","image/webp","image/gif"]);
export async function POST(request:Request){try{
  const actor=await getRequestActor(),form=await request.formData(),file=form.get("file");
  if(!(file instanceof File))return fail("请选择图片",422);
  if(!allowed.has(file.type))return fail("仅支持 JPG、PNG、WebP 或 GIF",422);
  if(file.size>10*1024*1024)return fail("图片不能超过 10MB",422);
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return fail("云端文件存储尚未配置",503);
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),bucket=process.env.SUPABASE_STORAGE_BUCKET||"content-assets";
  await client.storage.createBucket(bucket,{public:true,fileSizeLimit:10485760,allowedMimeTypes:[...allowed]}).catch(()=>undefined);
  const ext=file.name.split(".").pop()?.replace(/[^a-z0-9]/gi,"")||"jpg",path=`${actor.workspaceId}/${crypto.randomUUID()}.${ext}`;
  const uploaded=await client.storage.from(bucket).upload(path,await file.arrayBuffer(),{contentType:file.type,upsert:false});
  if(uploaded.error)throw uploaded.error;
  const publicUrl=client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  return ok({path,url:publicUrl,size:file.size,mimeType:file.type},201);
}catch(error){return apiError(error)}}
