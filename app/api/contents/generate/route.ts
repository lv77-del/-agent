import { z } from "zod";
import { getRequestActor } from "@/lib/auth";
import { getContentLibrary } from "@/lib/content-library";
import { db, ensureDb, id, now } from "@/lib/db";
import {
  countArticleCharacters,
  generatedArticleToMarkdown,
  type GeneratedArticle,
} from "@/lib/generated-article";
import { apiError, fail, ok } from "@/lib/http";
import { generateText } from "@/lib/integrations/ai";
import { searchUnsplash } from "@/lib/integrations/unsplash";

export const maxDuration = 180;

const inputSchema = z.object({
  topic: z.string().min(2).max(200),
  minLength: z.number().int().min(300).max(8000),
  maxLength: z.number().int().min(500).max(10000),
  style: z.string().min(1).max(80),
  platforms: z.array(z.enum(["wechat", "xiaohongshu"])).min(1),
  audience: z.string().max(200).default(""),
  purpose: z.string().max(80).default("知识分享"),
  requirements: z.string().max(2000).default(""),
  imageCount: z.number().int().min(0).max(5).default(0),
}).refine((value) => value.maxLength > value.minLength, {
  message: "最大字数必须大于最小字数。",
  path: ["maxLength"],
});

const articleSchema = z.object({
  title: z.string().min(2).max(100),
  excerpt: z.string().min(10).max(240),
  imageQuery: z.string().min(2).max(120),
  lead: z.string().min(20),
  blocks: z.array(z.object({
    heading: z.string().max(80).optional(),
    text: z.string().min(20),
  })).min(3),
});

function parseJsonResult(raw: string): GeneratedArticle {
  const cleaned = raw.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return articleSchema.parse(JSON.parse(cleaned));
}

function generationPrompt(input: z.infer<typeof inputSchema>, correction?: string) {
  return `请创作一篇可直接发布的中文文章。

主题：${input.topic}
目标平台：${input.platforms.join("、")}
目标读者：${input.audience || "对该主题感兴趣的普通读者"}
内容目的：${input.purpose}
写作风格：${input.style}
正文有效字数：${input.minLength}-${input.maxLength} 字
补充要求：${input.requirements || "无"}
${correction ? `上一次结果不合格：${correction}。请完整重写并严格修正。` : ""}

要求：
1. 内容完整，有开头、3-7 个正文段落和自然结尾，不允许截断或以省略号收尾。
2. 只写有用、可执行的内容，避免重复段落和空泛套话。
3. 字数统计包含 lead、各级标题和正文，不含 JSON 键名。
4. imageQuery 使用适合 Unsplash 搜图的英文短语。
5. 只返回以下结构的 JSON：
{"title":"","excerpt":"","imageQuery":"","lead":"","blocks":[{"heading":"","text":""}]}`;
}

export async function POST(request: Request) {
  try {
    const actor = await getRequestActor();
    await ensureDb();
    const input = inputSchema.parse(await request.json());
    let article: GeneratedArticle | null = null;
    let actualLength = 0;
    let correction = "";

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const raw = await generateText(generationPrompt(input, correction), {
        json: true,
        temperature: attempt ? 0.45 : 0.7,
        maxTokens: Math.min(16_000, Math.max(3_000, input.maxLength * 2)),
        workspaceId: actor.workspaceId,
      });
      article = parseJsonResult(raw);
      actualLength = countArticleCharacters(article);
      if (actualLength >= input.minLength && actualLength <= input.maxLength) break;
      correction = actualLength < input.minLength
        ? `实际只有 ${actualLength} 字，至少还需增加 ${input.minLength - actualLength} 字`
        : `实际有 ${actualLength} 字，需要压缩 ${actualLength - input.maxLength} 字以上`;
    }

    if (!article || actualLength < input.minLength || actualLength > input.maxLength) {
      return fail(
        `AI 返回的文章为 ${actualLength} 字，不符合 ${input.minLength}-${input.maxLength} 字要求。系统没有保存不完整文章，请重试。`,
        422,
      );
    }

    let assets: Awaited<ReturnType<typeof searchUnsplash>>["assets"] = [];
    let warning: string | null = null;
    try {
      const imageResult = await searchUnsplash(article.imageQuery, input.imageCount);
      assets = imageResult.assets;
      warning = imageResult.warning;
    } catch (error) {
      warning = error instanceof Error ? `${error.message} 文章已正常保存。` : "配图失败，文章已正常保存。";
    }

    const contentId = id("content");
    const timestamp = now();
    const body = generatedArticleToMarkdown(article);
    const taskRecord = {
      currentStage: "publishing",
      completed: ["topic_selection", "content_generation", "length_validation"],
      nextAction: "publish_content",
      actualLength,
      requestedLength: [input.minLength, input.maxLength],
    };
    const styleSelection = {
      writing: input.style,
      audience: input.audience,
      purpose: input.purpose,
      requirements: input.requirements,
      imageQuery: article.imageQuery,
    };

    await db.batch([
      {
        sql: `INSERT INTO contents
          (id,title,excerpt,body,status,style_selection,task_record,created_at,updated_at,workspace_id,created_by)
          VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        args: [contentId, article.title, article.excerpt, body, "ready_to_publish",
          JSON.stringify(styleSelection), JSON.stringify(taskRecord), timestamp, timestamp,
          actor.workspaceId, actor.userId],
      },
      ...input.platforms.map((platform) => ({
        sql: `INSERT INTO content_versions
          (id,content_id,platform,title,body,metadata,status,created_at,updated_at,workspace_id)
          VALUES (?,?,?,?,?,?,?,?,?,?)`,
        args: [id("version"), contentId, platform, article!.title, body,
          JSON.stringify({ actualLength, requestedLength: [input.minLength, input.maxLength] }),
          "ready_to_publish", timestamp, timestamp, actor.workspaceId],
      })),
      ...assets.map((asset, index) => ({
        sql: `INSERT INTO media_assets
          (id,content_id,source,source_url,author_name,author_url,alt_text,position_index,metadata,created_at,workspace_id)
          VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        args: [id("media"), contentId, "unsplash", asset.sourceUrl, asset.authorName,
          asset.authorUrl, asset.altText, index, JSON.stringify(asset.metadata), timestamp,
          actor.workspaceId],
      })),
    ], "write");

    const [content] = await getContentLibrary(actor.workspaceId, contentId);
    return ok({ content, article: { ...article, actualLength }, warning }, 201);
  } catch (error) {
    return apiError(error);
  }
}
