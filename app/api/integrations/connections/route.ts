import { z } from "zod";
import { getRequestActor } from "@/lib/auth";
import { encryptSecret } from "@/lib/credentials";
import { db, ensureDb, now } from "@/lib/db";
import { apiError, fail, ok } from "@/lib/http";

export const runtime = "nodejs";

const platformSchema = z.enum(["wechat", "xiaohongshu"]);
const connectionSchema = z
  .object({
    platform: platformSchema,
    accountName: z.string().trim().min(1, "请填写账号名称").max(100),
    apiUrl: z.string().trim().min(1, "请填写连接信息").max(500),
    apiKey: z.string().trim().max(1000).optional(),
  })
  .superRefine((input, context) => {
    if (
      input.platform === "wechat" &&
      !/^wx[0-9a-zA-Z]{16}$/.test(input.apiUrl)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["apiUrl"],
        message: "请填写正确的微信公众号 AppID（以 wx 开头，共 18 位）",
      });
    }
    if (input.platform === "xiaohongshu") {
      try {
        const url = new URL(input.apiUrl);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      } catch {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["apiUrl"],
          message: "请填写有效的第三方发布接口地址",
        });
      }
    }
  });

function serialize(row: Record<string, unknown>) {
  return {
    platform: String(row.platform),
    accountName: String(row.account_name || ""),
    apiUrl: String(row.api_url || ""),
    apiKeyConfigured: Boolean(row.encrypted_api_key),
    configured: Boolean(row.api_url && row.encrypted_api_key),
    status: String(row.status || "configured"),
    updatedAt: String(row.updated_at || ""),
  };
}

export async function GET(request: Request) {
  try {
    const actor = await getRequestActor();
    await ensureDb();
    const requested = new URL(request.url).searchParams.get("platform");
    const platform = requested ? platformSchema.parse(requested) : null;
    const result = await db.execute({
      sql: `SELECT platform,account_name,api_url,encrypted_api_key,status,updated_at
            FROM integration_connections WHERE workspace_id=?${platform ? " AND platform=?" : ""}`,
      args: platform ? [actor.workspaceId, platform] : [actor.workspaceId],
    });
    const connections = result.rows.map((row) =>
      serialize(row as Record<string, unknown>),
    );
    return ok(platform ? connections[0] || null : connections);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getRequestActor();
    await ensureDb();
    const input = connectionSchema.parse(await request.json());
    const existing = await db.execute({
      sql: "SELECT encrypted_api_key FROM integration_connections WHERE workspace_id=? AND platform=?",
      args: [actor.workspaceId, input.platform],
    });
    const previousKey = String(existing.rows[0]?.encrypted_api_key || "");
    if (!input.apiKey && !previousKey)
      return fail(
        input.platform === "wechat"
          ? "首次配置时必须填写 AppSecret"
          : "首次配置时必须填写访问密钥",
        422,
      );
    const encryptedKey = input.apiKey
      ? encryptSecret(input.apiKey)
      : previousKey;
    const timestamp = now();
    await db.execute({
      sql: `INSERT INTO integration_connections
            (workspace_id,platform,account_name,api_url,encrypted_api_key,status,created_at,updated_at)
            VALUES (?,?,?,?,?,'configured',?,?)
            ON CONFLICT(workspace_id,platform) DO UPDATE SET
              account_name=excluded.account_name,api_url=excluded.api_url,
              encrypted_api_key=excluded.encrypted_api_key,status='configured',updated_at=excluded.updated_at`,
      args: [
        actor.workspaceId,
        input.platform,
        input.accountName,
        input.apiUrl,
        encryptedKey,
        timestamp,
        timestamp,
      ],
    });
    return ok({
      platform: input.platform,
      accountName: input.accountName,
      apiUrl: input.apiUrl,
      apiKeyConfigured: true,
      configured: true,
      status: "configured",
      updatedAt: timestamp,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await getRequestActor();
    await ensureDb();
    const platform = platformSchema.parse(
      new URL(request.url).searchParams.get("platform"),
    );
    await db.execute({
      sql: "DELETE FROM integration_connections WHERE workspace_id=? AND platform=?",
      args: [actor.workspaceId, platform],
    });
    return ok({ platform, disconnected: true });
  } catch (error) {
    return apiError(error);
  }
}
