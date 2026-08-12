import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";

const envPath=path.join(process.cwd(),".env.local");
if(!fs.existsSync(envPath))throw new Error(".env.local 不存在，请先执行 vercel env pull");
for(const line of fs.readFileSync(envPath,"utf8").split(/\r?\n/)){const match=line.match(/^([^#=]+)=(.*)$/);if(match&&!process.env[match[1].trim()])process.env[match[1].trim()]=match[2].trim().replace(/^['"]|['"]$/g,"")}
const url=process.env.TURSO_DATABASE_URL,authToken=process.env.TURSO_AUTH_TOKEN;
if(!url||!authToken)throw new Error("缺少 Turso 云数据库连接变量");

const local=createClient({url:"file:content-factory.db"});
const remote=createClient({url,authToken});
const tables=["profiles","workspaces","workspace_members","analysis_tasks","source_articles","insight_reports","topic_insights","contents","content_versions","media_assets","publish_jobs","activity_logs","invitations","background_jobs","usage_records"];
let total=0;
for(const table of tables){
  let rows=[];
  try{rows=(await local.execute(`SELECT * FROM ${table}`)).rows}catch{continue}
  if(!rows.length){console.log(`- ${table}: 0`);continue}
  const columns=Object.keys(rows[0]);
  const sql=`INSERT OR IGNORE INTO ${table} (${columns.join(",")}) VALUES (${columns.map(()=>"?").join(",")})`;
  for(let i=0;i<rows.length;i+=50){
    const statements=rows.slice(i,i+50).map(row=>({sql,args:columns.map(column=>row[column]??null)}));
    await remote.batch(statements,"write");
  }
  total+=rows.length;console.log(`✓ ${table}: ${rows.length}`);
}
await local.close();await remote.close();
console.log(`迁移完成，共处理 ${total} 条记录。`);
