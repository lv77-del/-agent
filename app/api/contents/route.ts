import { z } from "zod";
import { getRequestActor } from "@/lib/auth";
import { CONTENT_STATUSES } from "@/lib/content-status";
import { getContentLibrary } from "@/lib/content-library";
import { db, ensureDb, id, now } from "@/lib/db";
import { apiError, ok } from "@/lib/http";

const schema = z.object({
  topicInsightId: z.string().optional(),
  title: z.string().min(2).max(200),
  excerpt: z.string().max(500).default(""),
  body: z.string().default(""),
  platforms: z.array(z.enum(["wechat", "xiaohongshu"])).min(1).default(["wechat"]),
  status: z.enum(CONTENT_STATUSES).default("draft"),
  styleSelection: z.record(z.unknown()).default({}),
  mediaAssets: z.array(z.object({
    source: z.string().default("imported"),
    sourceUrl: z.string().url().optional(),
    localUrl: z.string().optional(),
    altText: z.string().default(""),
    authorName: z.string().optional(),
    authorUrl: z.string().url().optional(),
    metadata: z.record(z.unknown()).default({}),
  })).default([]),
});

export async function GET() {
  try {
    const actor = await getRequestActor();
    return ok(await getContentLibrary(actor.workspaceId));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getRequestActor();
    await ensureDb();
    const input = schema.parse(await request.json());
    const contentId = id("content");
    const timestamp = now();
    const taskRecord = {
      currentStage: input.status === "draft" ? "writing" : "publishing",
      completed: ["topic_selection"],
      nextAction: input.status === "draft" ? "edit_content" : "publish_content",
    };
    await db.batch([
      {
        sql: `INSERT INTO contents
          (id,topic_insight_id,title,excerpt,body,status,style_selection,task_record,created_at,updated_at,workspace_id,created_by)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        args: [contentId, input.topicInsightId ?? null, input.title, input.excerpt, input.body,
          input.status, JSON.stringify(input.styleSelection), JSON.stringify(taskRecord), timestamp,
          timestamp, actor.workspaceId, actor.userId],
      },
      ...input.platforms.map((platform) => ({
        sql: `INSERT INTO content_versions
          (id,content_id,platform,title,body,status,created_at,updated_at,workspace_id)
          VALUES (?,?,?,?,?,?,?,?,?)`,
        args: [id("version"), contentId, platform, input.title, input.body, input.status,
          timestamp, timestamp, actor.workspaceId],
      })),
      ...input.mediaAssets.map((asset, index) => ({
        sql: `INSERT INTO media_assets
          (id,content_id,source,source_url,local_url,author_name,author_url,alt_text,position_index,metadata,created_at,workspace_id)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        args: [id("media"), contentId, asset.source, asset.sourceUrl ?? null, asset.localUrl ?? null,
          asset.authorName ?? null, asset.authorUrl ?? null, asset.altText, index,
          JSON.stringify(asset.metadata), timestamp, actor.workspaceId],
      })),
    ], "write");
    const [created] = await getContentLibrary(actor.workspaceId, contentId);
    return ok(created, 201);
  } catch (error) {
    return apiError(error);
  }
}
