import { getRequestActor } from "@/lib/auth";
import { db, ensureDb } from "@/lib/db";
import { apiError, ok } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    const actor = await getRequestActor();
    await ensureDb();
    const stored = await db.execute({
      sql: `SELECT platform,account_name,api_url,encrypted_api_key,updated_at
            FROM integration_connections WHERE workspace_id=?`,
      args: [actor.workspaceId],
    });
    const byPlatform = Object.fromEntries(stored.rows.map((row) => [String(row.platform), row]));
    const databaseUrl = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "file:content-factory.db";

    const connection = (platform: "wechat" | "xiaohongshu", envUrl?: string, envKey?: string) => {
      const row = byPlatform[platform];
      const urlConfigured = Boolean(envUrl || row?.api_url);
      const keyConfigured = Boolean(envKey || row?.encrypted_api_key);
      return {
        urlConfigured,
        keyConfigured,
        connected: urlConfigured && keyConfigured,
        source: envUrl && envKey ? "environment" : row?.api_url && row?.encrypted_api_key ? "database" : "none",
        accountName: String(row?.account_name || ""),
        apiUrl: String(row?.api_url || ""),
        updatedAt: String(row?.updated_at || ""),
      };
    };

    const wechat = connection("wechat", process.env.WECHAT_PUBLISH_API_URL, process.env.WECHAT_PUBLISH_API_KEY);
    const xiaohongshu = connection("xiaohongshu", process.env.XHS_PUBLISH_API_URL, process.env.XHS_PUBLISH_API_KEY);
    const services = {
      cloudAuth: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      databaseCloud: /^(libsql|https):\/\//.test(databaseUrl),
      storage: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      backgroundJobs: Boolean(process.env.INNGEST_EVENT_KEY && process.env.INNGEST_SIGNING_KEY),
      collectorWorker: Boolean(process.env.AI_NEWS_COLLECTOR_WORKER_URL && process.env.AI_NEWS_COLLECTOR_WORKER_TOKEN),
      ai: process.env.AI_PROVIDER === "codex-cli" || Boolean(process.env.AI_API_KEY),
      aiProvider: process.env.AI_PROVIDER === "codex-cli" ? "codex-cli" : "openai-compatible",
      aiModel: process.env.AI_MODEL || (process.env.AI_PROVIDER === "codex-cli" ? "gpt-5.6-sol" : "gpt-5"),
      wechatCollection: Boolean(process.env.WECHAT_COLLECTION_API_URL),
      wechatPublishing: wechat.connected,
      xiaohongshuPublishing: xiaohongshu.connected,
      unsplash: Boolean(process.env.UNSPLASH_ACCESS_KEY),
      researchSkill: Boolean(process.env.RESEARCH_SKILL_URL),
    };
    return ok({
      ...services,
      publishingConnections: { wechat, xiaohongshu },
      cloudReady: services.cloudAuth && services.databaseCloud && services.storage
        && services.backgroundJobs && services.collectorWorker,
    });
  } catch (error) { return apiError(error); }
}
