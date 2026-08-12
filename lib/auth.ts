import { db, ensureDb, id, now } from "@/lib/db";
import { cloudAuthEnabled, createSupabaseServerClient } from "@/lib/supabase/server";

export class UnauthorizedError extends Error { status = 401; }

export type RequestActor = {
  userId: string; email: string; workspaceId: string; workspaceName: string;
  role: "owner" | "editor" | "reviewer"; localMode: boolean;
};

async function ensureMembership(userId: string, email: string, displayName?: string): Promise<RequestActor> {
  await ensureDb();
  const t = now();
  await db.execute({
    sql: "INSERT OR IGNORE INTO profiles (id,email,display_name,created_at,updated_at) VALUES (?,?,?,?,?)",
    args: [userId, email, displayName || email.split("@")[0] || "用户", t, t],
  });
  const pendingInvite = await db.execute({
    sql: "SELECT id,workspace_id,role FROM invitations WHERE lower(email)=lower(?) AND status='pending' AND expires_at>? ORDER BY created_at LIMIT 1",
    args: [email, t],
  });
  if (pendingInvite.rows[0]) {
    await db.batch([
      { sql: "INSERT OR IGNORE INTO workspace_members (workspace_id,user_id,role,created_at) VALUES (?,?,?,?)", args: [pendingInvite.rows[0].workspace_id, userId, pendingInvite.rows[0].role, t] },
      { sql: "UPDATE invitations SET status='accepted' WHERE id=?", args: [pendingInvite.rows[0].id] },
    ], "write");
  }
  let member = await db.execute({
    sql: `SELECT wm.workspace_id,wm.role,w.name FROM workspace_members wm
          JOIN workspaces w ON w.id=wm.workspace_id WHERE wm.user_id=? ORDER BY wm.created_at LIMIT 1`,
    args: [userId],
  });
  if (!member.rows[0]) {
    const workspaceId = userId === "user_local" ? "workspace_local" : id("workspace");
    const name = `${displayName || email.split("@")[0]}的内容团队`;
    await db.batch([
      { sql: "INSERT OR IGNORE INTO workspaces (id,name,slug,owner_id,created_at) VALUES (?,?,?,?,?)", args: [workspaceId, name, `space-${workspaceId.slice(-10)}`, userId, t] },
      { sql: "INSERT OR IGNORE INTO workspace_members (workspace_id,user_id,role,created_at) VALUES (?,?,?,?)", args: [workspaceId, userId, "owner", t] },
    ], "write");
    member = await db.execute({ sql: "SELECT ? AS workspace_id,'owner' AS role,? AS name", args: [workspaceId, name] });
  }
  return {
    userId, email, workspaceId: String(member.rows[0].workspace_id),
    workspaceName: String(member.rows[0].name), role: String(member.rows[0].role) as RequestActor["role"],
    localMode: !cloudAuthEnabled(),
  };
}

export async function getRequestActor(): Promise<RequestActor> {
  if (!cloudAuthEnabled()) return ensureMembership("user_local", "local@content.factory", "本地管理员");
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user?.email) throw new UnauthorizedError("请先登录");
  return ensureMembership(user.id, user.email, String(user.user_metadata?.display_name || ""));
}
