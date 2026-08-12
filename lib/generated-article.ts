export type GeneratedArticle = {
  title: string;
  excerpt: string;
  imageQuery: string;
  lead: string;
  blocks: Array<{ heading?: string; text: string }>;
};

export function generatedArticleToMarkdown(article: GeneratedArticle) {
  return [
    article.lead.trim(),
    ...article.blocks.flatMap((block) => [
      block.heading?.trim() ? `## ${block.heading.trim()}` : "",
      block.text.trim(),
    ]),
  ].filter(Boolean).join("\n\n");
}

export function countArticleCharacters(article: GeneratedArticle) {
  return [article.lead, ...article.blocks.flatMap((block) => [block.heading ?? "", block.text])]
    .join("")
    .replace(/\s+/g, "")
    .length;
}

export function parseArticleMarkdown(body: string): Pick<GeneratedArticle, "lead" | "blocks"> {
  const chunks = body.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const leadParts: string[] = [];
  const blocks: GeneratedArticle["blocks"] = [];
  let current: GeneratedArticle["blocks"][number] | null = null;
  for (const chunk of chunks) {
    if (chunk.startsWith("## ")) {
      if (current) blocks.push(current);
      current = { heading: chunk.slice(3).trim(), text: "" };
    } else if (current) {
      current.text = current.text ? `${current.text}\n\n${chunk}` : chunk;
    } else {
      leadParts.push(chunk);
    }
  }
  if (current) blocks.push(current);
  if (!blocks.length && leadParts.length > 1) {
    return { lead: leadParts[0], blocks: leadParts.slice(1).map((text) => ({ text })) };
  }
  return { lead: leadParts.join("\n\n"), blocks };
}
