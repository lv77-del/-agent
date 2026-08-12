import { db, ensureDb } from "@/lib/db";
import { normalizeContentStatus } from "@/lib/content-status";
import { serializeContent } from "@/lib/serializers";

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function getContentLibrary(workspaceId: string, contentId?: string) {
  await ensureDb();
  const where = contentId ? "AND id = ?" : "";
  const args = contentId ? [workspaceId, contentId] : [workspaceId];

  const [contentResult, versionResult, mediaResult, jobResult] = await Promise.all([
    db.execute({
      sql: `SELECT * FROM contents WHERE workspace_id = ? ${where} ORDER BY updated_at DESC`,
      args,
    }),
    db.execute({
      sql: `SELECT cv.* FROM content_versions cv
        JOIN contents c ON c.id = cv.content_id
        WHERE c.workspace_id = ? ${contentId ? "AND c.id = ?" : ""}
        ORDER BY cv.created_at DESC`,
      args,
    }),
    db.execute({
      sql: `SELECT ma.* FROM media_assets ma
        JOIN contents c ON c.id = ma.content_id
        WHERE c.workspace_id = ? ${contentId ? "AND c.id = ?" : ""}
        ORDER BY ma.created_at ASC`,
      args,
    }),
    db.execute({
      sql: `SELECT pj.*, cv.content_id FROM publish_jobs pj
        JOIN content_versions cv ON cv.id = pj.content_version_id
        JOIN contents c ON c.id = cv.content_id
        WHERE c.workspace_id = ? ${contentId ? "AND c.id = ?" : ""}
        ORDER BY pj.created_at DESC`,
      args,
    }),
  ]);

  const versionsByContent = new Map<string, unknown[]>();
  for (const row of versionResult.rows) {
    const key = String(row.content_id);
    const list = versionsByContent.get(key) ?? [];
    list.push({
      id: String(row.id),
      platform: String(row.platform),
      status: normalizeContentStatus(String(row.status)),
      title: String(row.title),
      excerpt: String(row.excerpt ?? ""),
      body: String(row.body ?? ""),
      createdAt: String(row.created_at),
    });
    versionsByContent.set(key, list);
  }

  const mediaByContent = new Map<string, unknown[]>();
  for (const row of mediaResult.rows) {
    const key = String(row.content_id);
    const list = mediaByContent.get(key) ?? [];
    list.push({
      id: String(row.id),
      type: String(row.type),
      source: String(row.source),
      sourceUrl: row.source_url ? String(row.source_url) : null,
      localUrl: row.local_url ? String(row.local_url) : null,
      altText: row.alt_text ? String(row.alt_text) : "",
      authorName: row.author_name ? String(row.author_name) : null,
      authorUrl: row.author_url ? String(row.author_url) : null,
      metadata: parseJson(row.metadata, {}),
    });
    mediaByContent.set(key, list);
  }

  const latestJobByContent = new Map<string, unknown>();
  for (const row of jobResult.rows) {
    const key = String(row.content_id);
    if (latestJobByContent.has(key)) continue;
    latestJobByContent.set(key, {
      id: String(row.id),
      platform: String(row.platform),
      status: String(row.status),
      externalId: row.external_id ? String(row.external_id) : null,
      externalUrl: row.external_url ? String(row.external_url) : null,
      errorMessage: row.error_message ? String(row.error_message) : null,
      responsePayload: parseJson(row.response_payload, null),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    });
  }

  return contentResult.rows.map((row) => {
    const serialized = serializeContent(row);
    return {
      ...serialized,
      status: normalizeContentStatus(serialized.status),
      versions: versionsByContent.get(serialized.id) ?? [],
      mediaAssets: mediaByContent.get(serialized.id) ?? [],
      latestPublishJob: latestJobByContent.get(serialized.id) ?? null,
    };
  });
}
