import { getRequestActor } from "@/lib/auth";
import { db, ensureDb, now, parseJson } from "@/lib/db";
import { apiError, fail, ok } from "@/lib/http";

export async function GET() {
  try {
    const actor = await getRequestActor();
    await ensureDb();
    const timestamp = now();
    await db.batch([
      {
        sql: `UPDATE publish_jobs
          SET status='failed', error_message='发布任务意外中断，可以重新提交。', updated_at=?
          WHERE workspace_id=? AND status='processing'
          AND julianday(updated_at) < julianday('now','-5 minutes')`,
        args: [timestamp, actor.workspaceId],
      },
      {
        sql: `UPDATE contents SET status='failed',updated_at=?
          WHERE workspace_id=? AND status='publishing' AND id IN (
            SELECT cv.content_id FROM content_versions cv
            JOIN publish_jobs pj ON pj.content_version_id=cv.id
            WHERE pj.workspace_id=? AND pj.status='failed'
          )`,
        args: [timestamp, actor.workspaceId, actor.workspaceId],
      },
      {
        sql: `UPDATE content_versions SET status='failed',updated_at=?
          WHERE workspace_id=? AND status='publishing' AND id IN (
            SELECT content_version_id FROM publish_jobs
            WHERE workspace_id=? AND status='failed'
          )`,
        args: [timestamp, actor.workspaceId, actor.workspaceId],
      },
    ], "write");

    const result = await db.execute({
      sql: `SELECT pj.*,cv.title,cv.content_id FROM publish_jobs pj
        JOIN content_versions cv ON cv.id=pj.content_version_id
        WHERE pj.workspace_id=? ORDER BY pj.created_at DESC`,
      args: [actor.workspaceId],
    });
    return ok(result.rows.map((row) => ({
      id: String(row.id),
      contentId: String(row.content_id),
      contentVersionId: String(row.content_version_id),
      title: String(row.title),
      platform: String(row.platform),
      action: String(row.action),
      status: String(row.status),
      externalId: row.external_id ? String(row.external_id) : null,
      externalUrl: row.external_url ? String(row.external_url) : null,
      errorMessage: row.error_message ? String(row.error_message) : null,
      requestPayload: parseJson(row.request_payload, {}),
      responsePayload: parseJson(row.response_payload, {}),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    })));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST() {
  return fail("请从发布管理选择文章并提交到具体平台；系统已取消审核前置步骤。", 409);
}
