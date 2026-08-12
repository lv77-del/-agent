const fs=require("node:fs");
const path=require("node:path");
const envPath=path.join(process.cwd(),".env.local");
if(fs.existsSync(envPath))for(const line of fs.readFileSync(envPath,"utf8").split(/\r?\n/)){const match=line.match(/^([^#=]+)=(.*)$/);if(match&&!process.env[match[1].trim()])process.env[match[1].trim()]=match[2].trim().replace(/^['"]|['"]$/g,"")}
const checks=[
 ["Supabase 登录","NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_ANON_KEY","SUPABASE_SERVICE_ROLE_KEY"],
 ["libSQL 云数据库","TURSO_DATABASE_URL","TURSO_AUTH_TOKEN"],
 ["Inngest 后台任务","INNGEST_EVENT_KEY","INNGEST_SIGNING_KEY"],
 ["采集 Worker","AI_NEWS_COLLECTOR_WORKER_URL","AI_NEWS_COLLECTOR_WORKER_TOKEN"],
 ["正式站点地址","NEXT_PUBLIC_APP_URL"],
];
let ready=true;
for(const [label,...keys] of checks){let ok=keys.every(key=>Boolean(process.env[key]));if(label==="libSQL 云数据库"&&String(process.env.TURSO_DATABASE_URL||process.env.DATABASE_URL||"").startsWith("file:"))ok=false;if(label==="正式站点地址"&&String(process.env.NEXT_PUBLIC_APP_URL||"").includes("127.0.0.1"))ok=false;ready&&=ok;console.log(`${ok?"✓":"○"} ${label}${ok?"":"：缺少 "+keys.filter(k=>!process.env[k]).join("、")}`)}
console.log(ready?"\n云端必需配置已齐全，可以部署。":"\n当前仍有云服务未配置；已连接的服务可以单独使用。")
process.exitCode=ready?0:2;
