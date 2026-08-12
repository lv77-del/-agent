import { readAiNewsCollectorLatest } from "@/lib/integrations/ai-news-collector";
import { apiError, ok } from "@/lib/http";
export const runtime="nodejs";
export async function GET(){try{return ok(await readAiNewsCollectorLatest());}catch(error){return apiError(error)}}
