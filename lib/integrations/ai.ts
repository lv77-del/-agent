import { spawn } from "node:child_process";
import { decryptSecret } from "@/lib/credentials";
import { db, ensureDb } from "@/lib/db";

type GenerateOptions = {
  json?: boolean;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  workspaceId?: string;
};

type ChatMessage = { role: string; content: string };

function promptText(input: string | ChatMessage[]) {
  if (typeof input === "string") return input;
  return input.map((message) => `${message.role}: ${message.content}`).join("\n\n");
}

function extractCodexText(stdout: string) {
  const lines = stdout.split(/\r?\n/).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      const event = JSON.parse(lines[index]);
      const text = event?.item?.text ?? event?.message?.content?.[0]?.text;
      if (typeof text === "string" && text.trim()) return text.trim();
    } catch {
      // Codex JSONL may contain non-JSON diagnostic lines.
    }
  }
  return stdout.trim();
}

async function generateWithCodex(prompt: string, json: boolean) {
  const executable = process.env.CODEX_CLI_PATH || "codex";
  const finalPrompt = [
    "你是内容工厂的中文编辑。严格按照用户要求输出完整结果。",
    json ? "只输出合法 JSON，不要使用 Markdown 代码围栏。" : "输出清晰、准确的中文。",
    prompt,
  ].join("\n\n");

  return new Promise<string>((resolve, reject) => {
    const child = spawn(executable, ["exec", "--json", "--skip-git-repo-check", finalPrompt], {
      cwd: process.cwd(),
      env: process.env,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      if (process.platform === "win32" && child.pid) {
        spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
      } else child.kill("SIGKILL");
      reject(new Error("本机 Codex CLI 无法在网页后端完成调用，请改用独立的 OpenAI 兼容 API Key。"));
    }, 45_000);
    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Codex 生成失败（退出码 ${code}）`));
        return;
      }
      const text = extractCodexText(stdout);
      if (!text) reject(new Error("Codex 未返回内容。"));
      else resolve(text);
    });
  });
}

export async function generateText(input: string | ChatMessage[], options: GenerateOptions = {}) {
  const prompt = promptText(input);
  let stored: Record<string, unknown> | null = null;
  if (options.workspaceId) {
    await ensureDb();
    const result = await db.execute({
      sql: "SELECT account_name,api_url,encrypted_api_key FROM integration_connections WHERE workspace_id=? AND platform='ai' LIMIT 1",
      args: [options.workspaceId],
    });
    stored = (result.rows[0] as Record<string, unknown> | undefined) || null;
  }
  const provider = stored ? "openai-compatible" : (process.env.AI_PROVIDER || "openai-compatible").toLowerCase();
  if (provider === "codex-cli") {
    return generateWithCodex(prompt, Boolean(options.json));
  }

  const baseUrl = String(stored?.api_url || process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const apiKey = stored?.encrypted_api_key
    ? decryptSecret(String(stored.encrypted_api_key))
    : process.env.AI_API_KEY;
  const model = options.model || String(stored?.account_name || process.env.AI_MODEL || "gpt-5-mini");
  if (!apiKey) throw new Error("尚未配置 AI_API_KEY，无法执行真实 AI 生成。可在 .env.local 中配置。");

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: Array.isArray(input) ? input : [{ role: "user", content: prompt }],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
      ...(options.json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(120_000),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `AI 接口请求失败（HTTP ${response.status}）`);
  }
  const text = payload?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) throw new Error("AI 接口未返回有效内容。");
  return text.trim();
}
