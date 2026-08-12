import type { Row } from "@libsql/client";
import { parseJson } from "./db";

export const serializeTask = (r: Row) => ({
  id:String(r.id), name:String(r.name), keywords:parseJson<string[]>(r.keywords,[]),
  excludedKeywords:parseJson<string[]>(r.excluded_keywords,[]), dateRangeDays:Number(r.date_range_days),
  collectionLimit:Number(r.collection_limit), status:String(r.status), progress:Number(r.progress),
  articleCount:Number(r.article_count), insightCount:Number(r.insight_count),
  errorMessage:r.error_message?String(r.error_message):null, createdAt:String(r.created_at),
  updatedAt:String(r.updated_at), completedAt:r.completed_at?String(r.completed_at):null,
});
export const serializeContent = (r: Row) => ({
  id:String(r.id), topicInsightId:r.topic_insight_id?String(r.topic_insight_id):null,
  title:String(r.title), excerpt:String(r.excerpt), body:String(r.body), status:String(r.status),
  styleSelection:parseJson<Record<string,unknown>>(r.style_selection,{}),
  taskRecord:parseJson<Record<string,unknown>>(r.task_record,{}),
  platforms:parseJson<string[]>(r.platforms,[]).filter(Boolean),
  createdAt:String(r.created_at), updatedAt:String(r.updated_at),
});
