"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { LoaderCircle, LockKeyhole, Sparkles } from "lucide-react";
import "./login.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    const supabase = createSupabaseBrowserClient();
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) { setError(result.error.message); setBusy(false); return; }
    router.replace("/"); router.refresh();
  }
  return <main className="login-page"><section className="login-panel">
    <div className="login-brand"><span><Sparkles size={21}/></span><div><b>墨子</b><small>内容工厂</small></div></div>
    <div className="login-copy"><em>INVITE-ONLY BETA</em><h1>欢迎回到你的<br/>内容生产工作台</h1><p>从趋势采集、选题洞察到多平台创作与发布，让团队在同一个工作区协作。</p></div>
    <div className="login-feature"><LockKeyhole size={18}/><span><b>邀请制内测</b><small>只有收到邀请的成员才能登录</small></span></div>
  </section><section className="login-form-wrap"><form className="login-card" onSubmit={submit}>
    <div><h2>登录工作台</h2><p>使用邀请邮件对应的账号登录</p></div>
    <label>邮箱<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@company.com" required autoComplete="email"/></label>
    <label>密码<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="输入登录密码" required minLength={6} autoComplete="current-password"/></label>
    {error && <p className="login-error">{error}</p>}
    <button disabled={busy}>{busy?<><LoaderCircle className="spin" size={17}/>登录中…</>:"进入内容工厂"}</button>
    <small className="login-help">还没有账号？请联系工作区管理员发送邀请。</small>
  </form></section></main>;
}
