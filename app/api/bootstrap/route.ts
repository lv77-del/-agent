import { ensureDb } from "@/lib/db";
import { apiError, ok } from "@/lib/http";

export async function POST() {
  try {
    await ensureDb();
    return ok({ initialized: true, seeded: false, message: "数据库结构已初始化；系统不会写入演示文章。" });
  } catch (error) {
    return apiError(error);
  }
}
