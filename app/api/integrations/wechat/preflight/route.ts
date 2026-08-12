import { getRequestActor } from "@/lib/auth";
import { decryptSecret } from "@/lib/credentials";
import { db, ensureDb, now } from "@/lib/db";
import { apiError, fail, ok } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 30;

type WechatResponse = Record<string, unknown> & {
  errcode?: number;
  errmsg?: string;
};

async function readWechatResponse(response: Response): Promise<WechatResponse> {
  const text = await response.text();
  try {
    return JSON.parse(text) as WechatResponse;
  } catch {
    throw new Error(`微信接口返回了无法识别的数据（HTTP ${response.status}）`);
  }
}

function diagnostic(result: WechatResponse, successFields: string[] = []) {
  const code = Number(result.errcode || 0);
  const success = code === 0 && successFields.every((field) => field in result);
  return {
    ok: success,
    errorCode: success ? null : code || null,
    message: success ? "检查通过" : String(result.errmsg || "微信接口未返回预期结果"),
  };
}

function explainWechatError(code: number | null, fallback: string) {
  const messages: Record<number, string> = {
    40013: "AppID 无效，请检查是否复制了公众号的 AppID。",
    40125: "AppSecret 无效，请在微信开发者平台重置后重新保存。",
    40164: "当前服务器 IP 不在公众号的 IP 白名单中。",
    48001: "当前公众号没有该接口权限，或接口权限尚未开通。",
    61004: "当前调用 IP 未登记，请配置公众号 IP 白名单。",
  };
  return code !== null && messages[code] ? messages[code] : fallback;
}

async function withTimeout(url: string, init?: RequestInit) {
  return fetch(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
}

export async function POST() {
  try {
    const actor = await getRequestActor();
    await ensureDb();
    const stored = await db.execute({
      sql: `SELECT api_url, encrypted_api_key
            FROM integration_connections
            WHERE workspace_id=? AND platform='wechat' LIMIT 1`,
      args: [actor.workspaceId],
    });
    const row = stored.rows[0];
    if (!row?.api_url || !row?.encrypted_api_key) {
      return fail("请先在系统设置中保存公众号 AppID 和 AppSecret。", 422);
    }

    const appid = String(row.api_url);
    const secret = decryptSecret(String(row.encrypted_api_key));
    const tokenResponse = await withTimeout("https://api.weixin.qq.com/cgi-bin/stable_token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credential",
        appid,
        secret,
        force_refresh: false,
      }),
    });
    const tokenResult = await readWechatResponse(tokenResponse);
    const accessToken = typeof tokenResult.access_token === "string" ? tokenResult.access_token : "";
    if (!accessToken) {
      const errorCode = Number(tokenResult.errcode || 0) || null;
      const rawMessage = String(tokenResult.errmsg || "无法获取微信 access_token。");
      const blockedIp = rawMessage.match(/invalid ip\s+([^\s,]+)/i)?.[1] || null;
      return ok({
        configured: true,
        credentialsValid: errorCode === 40164 || errorCode === 61004 ? null : false,
        ipAllowlistValid: errorCode !== 40164 && errorCode !== 61004 ? null : false,
        errorCode,
        blockedIp,
        draftApi: { ok: false, errorCode: null, message: "未执行" },
        materialApi: { ok: false, errorCode: null, message: "未执行" },
        publishApi: { ok: false, errorCode: null, message: "未执行" },
        canCreateDraft: false,
        canSubmitPublish: false,
        conclusion: explainWechatError(errorCode, rawMessage),
      });
    }

    const draftResponse = await withTimeout(
      `https://api.weixin.qq.com/cgi-bin/draft/count?access_token=${encodeURIComponent(accessToken)}`,
    );
    const draftResult = await readWechatResponse(draftResponse);
    const draftApi = diagnostic(draftResult, ["total_count"]);

    const materialResponse = await withTimeout(
      `https://api.weixin.qq.com/cgi-bin/material/get_materialcount?access_token=${encodeURIComponent(accessToken)}`,
    );
    const materialResult = await readWechatResponse(materialResponse);
    const materialApi = diagnostic(materialResult, ["image_count", "news_count"]);

    const publishResponse = await withTimeout(
      `https://api.weixin.qq.com/cgi-bin/freepublish/batchget?access_token=${encodeURIComponent(accessToken)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ offset: 0, count: 1, no_content: 1 }),
      },
    );
    const publishResult = await readWechatResponse(publishResponse);
    const publishApi = diagnostic(publishResult, ["total_count", "item_count"]);
    const canCreateDraft = draftApi.ok && materialApi.ok;
    const canSubmitPublish = publishApi.ok;
    const firstFailure = !draftApi.ok
      ? draftApi
      : !materialApi.ok
        ? materialApi
        : !publishApi.ok
          ? publishApi
          : null;
    const conclusion = firstFailure
      ? explainWechatError(firstFailure.errorCode, firstFailure.message)
      : "公众号凭据、IP 白名单、草稿接口和发布记录接口均已通过只读检查。";

    await db.execute({
      sql: `UPDATE integration_connections SET status=?, last_tested_at=?, updated_at=?
            WHERE workspace_id=? AND platform='wechat'`,
      args: [canCreateDraft && canSubmitPublish ? "connected" : "error", now(), now(), actor.workspaceId],
    });

    return ok({
      configured: true,
      credentialsValid: true,
      ipAllowlistValid: true,
      draftApi,
      materialApi,
      publishApi,
      canCreateDraft,
      canSubmitPublish,
      conclusion,
      note: "本次为只读检查，没有创建草稿，也没有发布文章。",
    });
  } catch (error) {
    return apiError(error);
  }
}
