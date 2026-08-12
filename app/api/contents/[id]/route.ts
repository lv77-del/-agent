import { z } from "zod";
import { getRequestActor } from "@/lib/auth";
import { CONTENT_STATUSES } from "@/lib/content-status";
import { getContentLibrary } from "@/lib/content-library";
import { db, ensureDb, now } from "@/lib/db";
import { apiError, fail, ok } from "@/lib/http";

const schema = z.object({
  title: z.string().min(2).max(200).optional(),
  excerpt: z.string().max(500).optional(),
  body: z.string().optional(),
  status: z.enum(CONTENT_STATUSES).optional(),
});

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getRequestActor();
    const { id } = await context.params;
    const [content] = await getContentLibrary(actor.workspaceId, id);
    return content ? ok(content) : fail("内容不存在。", 404);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getRequestActor();
    await ensureDb();
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    const current = await db.execute({
      sql: "SELECT * FROM contents WHERE id=? AND workspace_id=?",
      args: [id, actor.workspaceId],
    });
    if (!current.rows[0]) return fail("内容不存在。", 404);
    const row = current.rows[0];
    const timestamp = now();
    const title = input.title ?? String(row.title);
    const body = input.body ?? String(row.body);
    const status = input.status ?? String(row.status);
    await db.batch([
      {
        sql: "UPDATE contents SET title=?,excerpt=?,body=?,status=?,updated_at=? WHERE id=? AND workspace_id=?",
        args: [title, input.excerpt ?? String(row.excerpt), body, status, timestamp, id, actor.workspaceId],
      },
      {
        sql: "UPDATE content_versions SET title=?,body=?,status=?,updated_at=? WHERE content_id=? AND workspace_id=?",
        args: [title, body, status, timestamp, id, actor.workspaceId],
      },
    ], "write");
    const [updated] = await getContentLibrary(actor.workspaceId, id);
    return ok(updated);
  } catch (error) {
    return apiError(error);
  }
}
