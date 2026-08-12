"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ArrowLeft,CheckCircle2,Cloud,Copy,LogOut,Mail,Plus,ShieldCheck,Users } from "lucide-react";
import "./team.css";

type Actor={email:string;workspaceName:string;role:string;localMode:boolean};
type Services={cloudAuth:boolean;databaseCloud:boolean;storage:boolean;backgroundJobs:boolean;collectorWorker:boolean;cloudReady:boolean};
export default function TeamPage(){
 const [actor,setActor]=useState<Actor|null>(null),[services,setServices]=useState<Services|null>(null),[invites,setInvites]=useState<any[]>([]),[email,setEmail]=useState(""),[role,setRole]=useState("editor"),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const load=async()=>{const [a,i,s]=await Promise.all([fetch("/api/session").then(r=>r.json()),fetch("/api/invitations").then(r=>r.json()),fetch("/api/integrations/status").then(r=>r.json())]);if(a.ok)setActor(a.data);if(i.ok)setInvites(i.data);if(s.ok)setServices(s.data)};
 useEffect(()=>{load()},[]);
 const invite=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);const r=await fetch("/api/invitations",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email,role})});const x=await r.json();setNotice(x.ok?x.data.message:x.error?.message||"邀请失败");if(x.ok){setEmail("");load()}setBusy(false)};
 const logout=async()=>{if(!actor?.localMode)await createSupabaseBrowserClient().auth.signOut();location.href="/login"};
 return <main className="team-page"><header><Link href="/"><ArrowLeft size={17}/>返回工作台</Link><button onClick={logout}><LogOut size={16}/>退出登录</button></header><div className="team-shell">
  <section className="team-title"><div><span><Users size={22}/></span><div><p>WORKSPACE</p><h1>{actor?.workspaceName||"正在载入工作区…"}</h1><small>{actor?.email} · {actor?.role}</small></div></div><em className={actor?.localMode?"local":"cloud"}><Cloud size={14}/>{actor?.localMode?"本地兼容模式":"云端模式"}</em></section>
  {actor?.localMode&&<aside className="team-banner"><ShieldCheck size={20}/><div><b>登录保护尚未启用</b><p>填写 Supabase 环境变量后，系统会自动切换为邀请制登录；本地开发仍可免登录使用。</p></div></aside>}
  <div className="team-grid"><section className="team-card"><div className="team-card-head"><div><h2>邀请成员</h2><p>成员首次登录后会自动加入当前工作区</p></div><Mail size={20}/></div><form onSubmit={invite}><label>成员邮箱<input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="member@company.com" required/></label><label>权限<select value={role} onChange={e=>setRole(e.target.value)}><option value="editor">编辑者</option><option value="reviewer">审核者</option></select></label><button disabled={busy}><Plus size={16}/>{busy?"发送中…":"发送邀请"}</button></form>{notice&&<div className="team-notice"><CheckCircle2 size={16}/>{notice}</div>}</section>
  <section className="team-card"><div className="team-card-head"><div><h2>云端连接</h2><p>{services?.cloudReady?"已经具备正式上线条件":"上线前需要完成的服务配置"}</p></div><Cloud size={20}/></div><ul className="cloud-list"><li><span>登录与邀请</span><b>{services?.cloudAuth?"已连接":"待配置"}</b></li><li><span>云数据库</span><b>{services?.databaseCloud?"已连接":"本地 SQLite"}</b></li><li><span>图片存储</span><b>{services?.storage?"已连接":"待配置"}</b></li><li><span>后台任务</span><b>{services?.backgroundJobs?"已连接":"待配置"}</b></li><li><span>采集 Worker</span><b>{services?.collectorWorker?"已连接":"待配置"}</b></li></ul></section></div>
  <section className="team-card invite-list"><div className="team-card-head"><div><h2>邀请记录</h2><p>邀请链接七天内有效</p></div><span>{invites.length} 条</span></div>{invites.length?invites.map(x=><div className="invite-row" key={x.id}><span className="mail-icon"><Mail size={16}/></span><div><b>{x.email}</b><small>{x.role==="reviewer"?"审核者":"编辑者"}</small></div><em className={x.status}>{x.status==="accepted"?"已加入":"等待接受"}</em><time>{new Date(String(x.created_at)).toLocaleDateString("zh-CN")}</time></div>):<div className="empty-invites"><Copy size={22}/><p>还没有发送过邀请</p></div>}</section>
 </div></main>
}
