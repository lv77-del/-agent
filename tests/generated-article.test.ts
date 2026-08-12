import test from "node:test";
import assert from "node:assert/strict";
import {
  countArticleCharacters,
  generatedArticleToMarkdown,
  parseArticleMarkdown,
} from "../lib/generated-article";

test("article length ignores whitespace but includes headings", () => {
  const article = {
    title: "测试",
    excerpt: "测试摘要",
    imageQuery: "artificial intelligence",
    lead: "开头 正文",
    blocks: [{ heading: "第一节", text: "段落 内容" }],
  };
  assert.equal(countArticleCharacters(article), 11);
});

test("generated markdown can be parsed back into lead and blocks", () => {
  const article = {
    title: "测试",
    excerpt: "测试摘要",
    imageQuery: "technology",
    lead: "这是开头。",
    blocks: [
      { heading: "方法", text: "这是方法正文。" },
      { heading: "结语", text: "这是结语正文。" },
    ],
  };
  const parsed = parseArticleMarkdown(generatedArticleToMarkdown(article));
  assert.equal(parsed.lead, article.lead);
  assert.deepEqual(parsed.blocks, article.blocks);
});
