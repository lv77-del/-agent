import { getRequestActor } from "@/lib/auth";
import { apiError, ok } from "@/lib/http";
export async function GET(){try{return ok(await getRequestActor());}catch(error){return apiError(error)}}
