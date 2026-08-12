import { createClient, type Client } from "@libsql/client";

declare global {
  var contentFactoryDb: Client | undefined;
  var contentFactoryDbReady: Promise<void> | undefined;
}

export const db = global.contentFactoryDb ?? createClient({
  url: process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "file:content-factory.db",
  authToken: process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN,
});

if (process.env.NODE_ENV !== "production") global.contentFactoryDb = db;

const schema = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS analysis_tasks (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, keywords TEXT NOT NULL DEFAULT '[]',
  excluded_keywords TEXT NOT NULL DEFAULT '[]', date_range_days INTEGER NOT NULL DEFAULT 7,
  collection_limit INTEGER NOT NULL DEFAULT 50, status TEXT NOT NULL DEFAULT 'queued',
  progress INTEGER NOT NULL DEFAULT 0, article_count INTEGER NOT NULL DEFAULT 0,
  insight_count INTEGER NOT NULL DEFAULT 0, error_message TEXT, created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL, completed_at TEXT
);
CREATE TABLE IF NOT EXISTS source_articles (
  id TEXT PRIMARY KEY, analysis_task_id TEXT NOT NULL, external_id TEXT, title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '', source_name TEXT NOT NULL DEFAULT '', source_url TEXT,
  published_at TEXT, read_count INTEGER NOT NULL DEFAULT 0, like_count INTEGER NOT NULL DEFAULT 0,
  wow_count INTEGER NOT NULL DEFAULT 0, interaction_rate REAL NOT NULL DEFAULT 0,
  ai_summary TEXT, tags TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL,
  FOREIGN KEY (analysis_task_id) REFERENCES analysis_tasks(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS insight_reports (
  id TEXT PRIMARY KEY, analysis_task_id TEXT NOT NULL UNIQUE, summary TEXT NOT NULL DEFAULT '',
  metrics TEXT NOT NULL DEFAULT '{}', word_cloud TEXT NOT NULL DEFAULT '[]',
  top_articles TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  FOREIGN KEY (analysis_task_id) REFERENCES analysis_tasks(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS topic_insights (
  id TEXT PRIMARY KEY, report_id TEXT NOT NULL, rank INTEGER NOT NULL, title TEXT NOT NULL,
  angle TEXT NOT NULL DEFAULT '', audience TEXT NOT NULL DEFAULT '', rationale TEXT NOT NULL DEFAULT '',
  evidence TEXT NOT NULL DEFAULT '[]', platform_fit TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'candidate', created_at TEXT NOT NULL,
  FOREIGN KEY (report_id) REFERENCES insight_reports(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS contents (
  id TEXT PRIMARY KEY, topic_insight_id TEXT, title TEXT NOT NULL, excerpt TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft',
  style_selection TEXT NOT NULL DEFAULT '{}', task_record TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  FOREIGN KEY (topic_insight_id) REFERENCES topic_insights(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS content_versions (
  id TEXT PRIMARY KEY, content_id TEXT NOT NULL, platform TEXT NOT NULL, title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '', metadata TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(content_id, platform),
  FOREIGN KEY (content_id) REFERENCES contents(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY, content_id TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'unsplash',
  source_url TEXT, local_url TEXT, author_name TEXT, author_url TEXT, alt_text TEXT NOT NULL DEFAULT '',
  position_index INTEGER NOT NULL DEFAULT 0, metadata TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL,
  FOREIGN KEY (content_id) REFERENCES contents(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS publish_jobs (
  id TEXT PRIMARY KEY, content_version_id TEXT NOT NULL, platform TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'create_draft', status TEXT NOT NULL DEFAULT 'pending_approval',
  scheduled_at TEXT, approved_at TEXT, external_id TEXT, external_url TEXT,
  request_payload TEXT NOT NULL DEFAULT '{}', response_payload TEXT NOT NULL DEFAULT '{}',
  error_message TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  FOREIGN KEY (content_version_id) REFERENCES content_versions(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
  action TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY, email TEXT NOT NULL, display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
  owner_id TEXT NOT NULL, plan TEXT NOT NULL DEFAULT 'beta', created_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'editor',
  created_at TEXT NOT NULL, PRIMARY KEY (workspace_id, user_id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, email TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'editor',
  token_hash TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'pending', expires_at TEXT NOT NULL,
  invited_by TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS background_jobs (
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, user_id TEXT NOT NULL, type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued', progress INTEGER NOT NULL DEFAULT 0,
  payload TEXT NOT NULL DEFAULT '{}', result TEXT NOT NULL DEFAULT '{}', error_message TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, completed_at TEXT
);
CREATE TABLE IF NOT EXISTS usage_records (
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, user_id TEXT NOT NULL, kind TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1, metadata TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS integration_connections (
  workspace_id TEXT NOT NULL, platform TEXT NOT NULL, account_name TEXT NOT NULL DEFAULT '',
  api_url TEXT NOT NULL DEFAULT '', encrypted_api_key TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'configured', last_tested_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, platform),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_source_articles_task ON source_articles(analysis_task_id);
CREATE INDEX IF NOT EXISTS idx_topic_insights_report ON topic_insights(report_id);
CREATE INDEX IF NOT EXISTS idx_content_versions_content ON content_versions(content_id);
CREATE INDEX IF NOT EXISTS idx_publish_jobs_status ON publish_jobs(status);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_background_jobs_workspace ON background_jobs(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_integration_connections_workspace ON integration_connections(workspace_id);
`;

const tenantMigrations = [
  "ALTER TABLE analysis_tasks ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'workspace_local'",
  "ALTER TABLE analysis_tasks ADD COLUMN created_by TEXT NOT NULL DEFAULT 'user_local'",
  "ALTER TABLE source_articles ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'workspace_local'",
  "ALTER TABLE insight_reports ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'workspace_local'",
  "ALTER TABLE topic_insights ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'workspace_local'",
  "ALTER TABLE contents ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'workspace_local'",
  "ALTER TABLE contents ADD COLUMN created_by TEXT NOT NULL DEFAULT 'user_local'",
  "ALTER TABLE content_versions ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'workspace_local'",
  "ALTER TABLE media_assets ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'workspace_local'",
  "ALTER TABLE publish_jobs ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'workspace_local'",
  "ALTER TABLE publish_jobs ADD COLUMN created_by TEXT NOT NULL DEFAULT 'user_local'",
  "ALTER TABLE activity_logs ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'workspace_local'",
];

const dataMigrations = [
  "UPDATE contents SET status='ready_to_publish' WHERE status IN ('pending_review','pending_publish')",
  "UPDATE content_versions SET status='ready_to_publish' WHERE status IN ('pending_review','pending_publish')",
  "UPDATE contents SET status='wechat_draft' WHERE status='draft_created'",
  "UPDATE content_versions SET status='wechat_draft' WHERE status='draft_created'",
  `UPDATE contents SET status='wechat_draft' WHERE id IN (
    SELECT cv.content_id FROM content_versions cv
    JOIN publish_jobs pj ON pj.content_version_id=cv.id
    WHERE pj.status='draft_created'
  )`,
  `UPDATE content_versions SET status='wechat_draft' WHERE id IN (
    SELECT content_version_id FROM publish_jobs WHERE status='draft_created'
  )`,
];

export async function ensureDb() {
  if (!global.contentFactoryDbReady) global.contentFactoryDbReady = (async () => {
    await db.executeMultiple(schema);
    for (const sql of tenantMigrations) {
      try { await db.execute(sql); }
      catch (error) { if (!String(error).toLowerCase().includes("duplicate column")) throw error; }
    }
    for (const sql of dataMigrations) await db.execute(sql);
  })();
  return global.contentFactoryDbReady;
}
export const now = () => new Date().toISOString();
export const id = (prefix: string) => `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}
