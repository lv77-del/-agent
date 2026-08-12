import test from "node:test";
import assert from "node:assert/strict";
import { contentStatusLabel, normalizeContentStatus } from "../lib/content-status";

test("legacy review statuses bypass review and become ready to publish", () => {
  assert.equal(normalizeContentStatus("pending_review"), "ready_to_publish");
  assert.equal(normalizeContentStatus("pending_publish"), "ready_to_publish");
  assert.equal(contentStatusLabel("pending_review"), "待发布");
});

test("wechat draft is distinct from published", () => {
  assert.equal(contentStatusLabel("wechat_draft"), "草稿箱");
  assert.equal(contentStatusLabel("published"), "已发布");
});
