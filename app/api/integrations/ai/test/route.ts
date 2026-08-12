import { generateText } from "@/lib/integrations/ai";
import { getRequestActor } from "@/lib/auth";
import { apiError, ok } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST() {
  try {
    const actor = await getRequestActor();
    const result = await generateText([{ role: "user", content: "这是连接测试。请只回复：连接成功" }], { workspaceId: actor.workspaceId });
    return ok({ connected: result.includes("连接成功"), provider: process.env.AI_PROVIDER || "openai-compatible" });
  } catch (error) { return apiError(error); }
}
