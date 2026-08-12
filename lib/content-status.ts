export const CONTENT_STATUSES = [
  "draft",
  "ready_to_publish",
  "publishing",
  "wechat_draft",
  "published",
  "failed",
  "archived",
] as const;

export type ContentStatus = (typeof CONTENT_STATUSES)[number];

const LEGACY_STATUS_MAP: Record<string, ContentStatus> = {
  pending_review: "ready_to_publish",
  pending_publish: "ready_to_publish",
  draft_created: "wechat_draft",
  publish_failed: "failed",
};

export function normalizeContentStatus(status?: string | null): ContentStatus {
  if (!status) return "draft";
  if (LEGACY_STATUS_MAP[status]) return LEGACY_STATUS_MAP[status];
  return CONTENT_STATUSES.includes(status as ContentStatus)
    ? (status as ContentStatus)
    : "draft";
}

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  draft: "草稿",
  ready_to_publish: "待发布",
  publishing: "发布中",
  wechat_draft: "草稿箱",
  published: "已发布",
  failed: "发布失败",
  archived: "已归档",
};

export function contentStatusLabel(status?: string | null) {
  return CONTENT_STATUS_LABELS[normalizeContentStatus(status)];
}
