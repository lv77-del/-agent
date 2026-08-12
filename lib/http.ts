import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthorizedError } from "@/lib/auth";

export const ok = <T,>(data: T, status = 200) => NextResponse.json({ ok: true, data }, { status });
export const fail = (message: string, status = 400, details?: unknown) =>
  NextResponse.json({ ok: false, error: { message, details } }, { status });
export function apiError(error: unknown) {
  if (error instanceof UnauthorizedError) return fail(error.message, error.status);
  if (error instanceof ZodError) return fail("请求参数不正确", 422, error.flatten());
  console.error(error);
  return fail(error instanceof Error ? error.message : "服务器内部错误", 500);
}
