import { serve } from "inngest/next";
import { collectNewsJob, inngest } from "@/lib/inngest";
export const { GET,POST,PUT }=serve({client:inngest,functions:[collectNewsJob]});
