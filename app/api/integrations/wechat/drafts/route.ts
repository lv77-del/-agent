import sharp from "sharp";
import { z } from "zod";
import { getRequestActor } from "@/lib/auth";
import { decryptSecret } from "@/lib/credentials";
import { db, ensureDb, id, now } from "@/lib/db";
import { apiError, fail, ok } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;

const inputSchema = z.object({
  title: z.string().trim().min(2, "文章标题不能为空").max(64, "公众号标题不能超过 64 字"),
  body: z.string().trim().min(80, "文章正文不完整，请先进入编辑页检查并保存正文"),
  digest: z.string().trim().max(120, "公众号摘要不能超过 120 字").optional(),
  images: z.array(z.string().url()).max(10).default([]),
  mediaId: z.string().trim().min(1).optional(),
  contentId: z.string().trim().min(1).optional(),
  contentVersionId: z.string().trim().min(1).optional(),
});

type WechatResult = Record<string, unknown> & { errcode?: number; errmsg?: string };

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function articleHtml(body: string, imageUrls: string[] = []) {
  const sections = body
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  const insertions = new Map<number, string[]>();
  imageUrls.forEach((url, index) => {
    const position = Math.max(
      0,
      Math.min(
        sections.length - 1,
        Math.floor(((index + 1) * sections.length) / (imageUrls.length + 1)),
      ),
    );
    insertions.set(position, [...(insertions.get(position) || []), url]);
  });
  return sections
    .flatMap((part, index) => {
      let html: string;
      if (part.startsWith("## ")) {
        html = `<h2 style="margin:28px 0 12px;font-size:20px;line-height:1.5;color:#16141f;">${escapeHtml(part.slice(3))}</h2>`;
      } else {
        html = `<p style="margin:0 0 18px;font-size:16px;line-height:1.9;color:#3d3948;letter-spacing:.02em;">${escapeHtml(part).replaceAll("\n", "<br>")}</p>`;
      }
      const images = (insertions.get(index) || []).map(
        (url) =>
          `<p style="margin:22px 0;text-align:center;"><img src="${escapeHtml(url)}" style="display:block;width:100%;height:auto;border-radius:8px;" /></p>`,
      );
      return [html, ...images];
    })
    .join("");
}

function plainText(value: string) {
  return value.replace(/[#*_>`~\[\]()]/g, "").replace(/\s+/g, " ").trim();
}

function explain(code: number, message: string) {
  const known: Record<number, string> = {
    40013: "公众号 AppID 无效",
    40125: "公众号 AppSecret 无效",
    40164: "当前服务器 IP 不在公众号白名单中",
    45009: "微信接口调用次数已达到上限，请稍后重试",
    48001: "当前公众号没有草稿或素材接口权限",
  };
  return known[code] || message || `微信接口错误 ${code}`;
}

async function wechatJson(url: string, init?: RequestInit): Promise<WechatResult> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  let result: WechatResult;
  try {
    result = JSON.parse(text) as WechatResult;
  } catch {
    throw new Error(`微信接口返回异常（HTTP ${response.status}）`);
  }
  const code = Number(result.errcode || 0);
  if (code) throw new Error(explain(code, String(result.errmsg || "")));
  return result;
}

async function createCover() {
  const svg = Buffer.from(`
    <svg width="900" height="383" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#6d4aff"/><stop offset="1" stop-color="#2f9bd6"/></linearGradient></defs>
      <rect width="900" height="383" rx="28" fill="url(#g)"/>
      <circle cx="720" cy="80" r="145" fill="#fff" opacity=".12"/>
      <circle cx="805" cy="300" r="180" fill="#16141f" opacity=".10"/>
      <path d="M95 255 C210 90 335 90 450 255 S690 420 810 210" fill="none" stroke="#fff" opacity=".72" stroke-width="18" stroke-linecap="round"/>
      <circle cx="95" cy="255" r="24" fill="#fff"/><circle cx="450" cy="255" r="24" fill="#fff"/>
    </svg>`);
  return sharp(svg).jpeg({ quality: 78, mozjpeg: true }).toBuffer();
}

async function uploadBodyImage(
  accessToken: string,
  sourceUrl: string,
  index: number,
) {
  try {
    const response = await fetch(sourceUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
      headers: { "user-agent": "Mozilla/5.0 ContentFactory/1.0" },
    });
    if (!response.ok) {
      throw new Error(`下载失败（HTTP ${response.status}）`);
    }
    const source = Buffer.from(await response.arrayBuffer());
    const image = await sharp(source)
      .rotate()
      .resize({ width: 1200, withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
    const form = new FormData();
    form.append(
      "media",
      new Blob([new Uint8Array(image)], { type: "image/jpeg" }),
      `body-${index + 1}.jpg`,
    );
    const result = await wechatJson(
      `https://api.weixin.qq.com/cgi-bin/media/uploadimg?access_token=${encodeURIComponent(accessToken)}`,
      { method: "POST", body: form },
    );
    const url = String(result.url || "");
    if (!url) throw new Error("微信没有返回图片地址");
    return url;
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    throw new Error(`正文第 ${index + 1} 张配图上传失败：${message}`);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getRequestActor();
    const input = inputSchema.parse(await request.json());
    await ensureDb();
    const connection = await db.execute({
      sql: `SELECT account_name,api_url,encrypted_api_key FROM integration_connections
            WHERE workspace_id=? AND platform='wechat' LIMIT 1`,
      args: [actor.workspaceId],
    });
    const stored = connection.rows[0];
    if (!stored?.api_url || !stored?.encrypted_api_key) {
      return fail("请先配置公众号 AppID 和 AppSecret", 422);
    }

    const timestamp = now();
    let contentId = input.contentId || id("content");
    let versionId = input.contentVersionId || id("version");
    const jobId = id("publish");
    const digest = input.digest || plainText(input.body).slice(0, 100);
    const statements: any[] = [];
    if (input.contentId) {
      const existing = await db.execute({
        sql: "SELECT id FROM contents WHERE id=? AND workspace_id=?",
        args: [input.contentId, actor.workspaceId],
      });
      if (!existing.rows[0]) return fail("要发布的文章不存在。", 404);
      if (input.contentVersionId) {
        const existingVersion = await db.execute({
          sql: "SELECT id FROM content_versions WHERE id=? AND content_id=? AND workspace_id=? AND platform='wechat'",
          args: [input.contentVersionId, contentId, actor.workspaceId],
        });
        if (!existingVersion.rows[0]) return fail("文章没有可用的公众号版本。", 422);
      } else {
        const existingVersion = await db.execute({
          sql: "SELECT id FROM content_versions WHERE content_id=? AND workspace_id=? AND platform='wechat' LIMIT 1",
          args: [contentId, actor.workspaceId],
        });
        if (!existingVersion.rows[0]) return fail("文章没有可用的公众号版本。", 422);
        versionId = String(existingVersion.rows[0].id);
      }
      statements.push(
        {
          sql: "UPDATE contents SET title=?,excerpt=?,body=?,status='publishing',updated_at=? WHERE id=? AND workspace_id=?",
          args: [input.title, digest, input.body, timestamp, contentId, actor.workspaceId],
        },
        {
          sql: "UPDATE content_versions SET title=?,body=?,status='publishing',updated_at=? WHERE id=? AND workspace_id=?",
          args: [input.title, input.body, timestamp, versionId, actor.workspaceId],
        },
      );
    } else {
      statements.push(
        {
          sql: `INSERT INTO contents
                (id,title,excerpt,body,status,style_selection,task_record,created_at,updated_at,workspace_id,created_by)
                VALUES (?,?,?,?,'publishing','{}','{}',?,?,?,?)`,
          args: [contentId, input.title, digest, input.body, timestamp, timestamp, actor.workspaceId, actor.userId],
        },
        {
          sql: `INSERT INTO content_versions
                (id,content_id,platform,title,body,metadata,status,created_at,updated_at,workspace_id)
                VALUES (?,?,'wechat',?,?,?,'publishing',?,?,?)`,
          args: [versionId, contentId, input.title, input.body, JSON.stringify({ digest }), timestamp, timestamp, actor.workspaceId],
        },
      );
    }
    statements.push({
      sql: `INSERT INTO publish_jobs
            (id,content_version_id,platform,action,status,request_payload,response_payload,created_at,updated_at,workspace_id,created_by)
            VALUES (?,?,'wechat',?,'processing',?,'{}',?,?,?,?)`,
      args: [jobId, versionId, input.mediaId ? "update_draft" : "create_draft", JSON.stringify({ title: input.title, target: "draft_box", mediaId: input.mediaId || null }), timestamp, timestamp, actor.workspaceId, actor.userId],
    });
    await db.batch(statements, "write");

    try {
      const appid = String(stored.api_url);
      const secret = decryptSecret(String(stored.encrypted_api_key));
      const tokenResult = await wechatJson("https://api.weixin.qq.com/cgi-bin/stable_token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ grant_type: "client_credential", appid, secret, force_refresh: false }),
      });
      const accessToken = String(tokenResult.access_token || "");
      if (!accessToken) throw new Error("微信没有返回 access_token");

      const cover = await createCover();
      const form = new FormData();
      form.append("media", new Blob([new Uint8Array(cover)], { type: "image/jpeg" }), "cover.jpg");
      const coverResult = await wechatJson(
        `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${encodeURIComponent(accessToken)}&type=thumb`,
        { method: "POST", body: form },
      );
      const thumbMediaId = String(coverResult.media_id || "");
      if (!thumbMediaId) throw new Error("封面上传成功但微信没有返回素材 ID");

      const bodyImageUrls = await Promise.all(
        input.images.map((sourceUrl, index) =>
          uploadBodyImage(accessToken, sourceUrl, index),
        ),
      );

      const article = {
        title: input.title,
        author: String(stored.account_name || "").slice(0, 16),
        digest,
        content: articleHtml(input.body, bodyImageUrls),
        content_source_url: "",
        thumb_media_id: thumbMediaId,
        need_open_comment: 0,
        only_fans_can_comment: 0,
      };
      const draftResult = input.mediaId
        ? await wechatJson(
            `https://api.weixin.qq.com/cgi-bin/draft/update?access_token=${encodeURIComponent(accessToken)}`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                media_id: input.mediaId,
                index: 0,
                articles: article,
              }),
            },
          )
        : await wechatJson(
            `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${encodeURIComponent(accessToken)}`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ articles: [article] }),
            },
          );
      const mediaId = input.mediaId || String(draftResult.media_id || "");
      if (!mediaId) throw new Error("微信没有返回草稿 ID");

      const verifyResult = await wechatJson(
        `https://api.weixin.qq.com/cgi-bin/draft/get?access_token=${encodeURIComponent(accessToken)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ media_id: mediaId }),
        },
      );
      const first = Array.isArray(verifyResult.news_item) ? verifyResult.news_item[0] as Record<string, unknown> | undefined : undefined;
      const verified = Boolean(
        first && String(first.title || "") === input.title && String(first.content || "").trim(),
      );
      if (!verified) throw new Error("草稿已创建，但回查内容不完整；请到公众号后台人工检查");
      const verifiedImageCount = (
        String(first?.content || "").match(/<img\b/gi) || []
      ).length;
      if (verifiedImageCount < bodyImageUrls.length) {
        throw new Error(
          `草稿正文配图回查失败：应有 ${bodyImageUrls.length} 张，实际 ${verifiedImageCount} 张`,
        );
      }

      const completedAt = now();
      await db.batch([
        {
          sql: "UPDATE publish_jobs SET status='draft_created',external_id=?,external_url=?,response_payload=?,updated_at=? WHERE id=? AND workspace_id=?",
          args: [mediaId, "https://mp.weixin.qq.com/cgi-bin/loginpage?t=wxm2-login&lang=zh_CN", JSON.stringify({ verified: true, target: "draft_box", bodyImageCount: verifiedImageCount, message: `微信草稿箱回查成功，正文包含 ${verifiedImageCount} 张配图。` }), completedAt, jobId, actor.workspaceId],
        },
        {
          sql: "UPDATE contents SET status='wechat_draft',updated_at=? WHERE id=? AND workspace_id=?",
          args: [completedAt, contentId, actor.workspaceId],
        },
        {
          sql: "UPDATE content_versions SET status='wechat_draft',updated_at=? WHERE id=? AND workspace_id=?",
          args: [completedAt, versionId, actor.workspaceId],
        },
      ], "write");
      return ok({
        jobId,
        mediaId,
        status: "draft_created",
        verified: true,
        bodyImageCount: verifiedImageCount,
        accountName: String(stored.account_name || ""),
        message: `${input.mediaId ? "已更新" : "已进入"}微信公众号草稿箱并完成回查，正文包含 ${verifiedImageCount} 张配图。`,
        backendUrl:
          "https://mp.weixin.qq.com/cgi-bin/loginpage?t=wxm2-login&lang=zh_CN",
      }, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : "创建公众号草稿失败";
      const failedAt = now();
      await db.batch([
        {
          sql: "UPDATE publish_jobs SET status='failed',error_message=?,updated_at=? WHERE id=? AND workspace_id=?",
          args: [message, failedAt, jobId, actor.workspaceId],
        },
        {
          sql: "UPDATE contents SET status='failed',updated_at=? WHERE id=? AND workspace_id=?",
          args: [failedAt, contentId, actor.workspaceId],
        },
        {
          sql: "UPDATE content_versions SET status='failed',updated_at=? WHERE id=? AND workspace_id=?",
          args: [failedAt, versionId, actor.workspaceId],
        },
      ], "write");
      return fail(message, 502, { jobId, draftCreated: false });
    }
  } catch (error) {
    return apiError(error);
  }
}
