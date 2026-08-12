import { Inngest } from "inngest";
import { db, now } from "@/lib/db";
import { collectNewsIntelligence } from "@/lib/workflows/news-intelligence";

export const inngest = new Inngest({ id:"content-factory" });

export const collectNewsJob = inngest.createFunction(
  { id:"collect-ai-news", retries:2, concurrency:{limit:2} },
  { event:"content/news.collect.requested" },
  async ({ event, step }) => {
    const { jobId,hours,workspaceId,userId }=event.data as {jobId:string;hours:6|12|24;workspaceId:string;userId:string};
    await step.run("mark-running",()=>db.execute({sql:"UPDATE background_jobs SET status='running',progress=10,updated_at=? WHERE id=?",args:[now(),jobId]}));
    try{
      const result=await step.run("collect-and-normalize",()=>collectNewsIntelligence(hours,{workspaceId,userId}));
      await step.run("mark-complete",()=>db.execute({sql:"UPDATE background_jobs SET status='completed',progress=100,result=?,updated_at=?,completed_at=? WHERE id=?",args:[JSON.stringify(result),now(),now(),jobId]}));
      return result;
    }catch(error){
      await db.execute({sql:"UPDATE background_jobs SET status='failed',error_message=?,updated_at=? WHERE id=?",args:[error instanceof Error?error.message:"采集失败",now(),jobId]});
      throw error;
    }
  },
);
