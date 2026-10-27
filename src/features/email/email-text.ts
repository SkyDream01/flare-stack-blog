const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  "#x27": "'",
  nbsp: " ",
};

/**
 * Reads an email's HTML as plain text so a developer can scan it in the
 * terminal: the hidden preview text is dropped, each block gets its own line,
 * and links keep their target.
 */
export function emailHtmlToText(html: string) {
  return html
    .replace(/<div[^>]*display:\s*none[^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(
      /<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
      (_, href: string, text: string) => {
        const label = text.replace(/<[^>]+>/g, "").trim();
        return label && label !== href ? `${label} (${href})` : href;
      },
    )
    .replace(/<br\s*\/?>|<\/(?:p|div|h[1-6]|tr|li|table)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#?\w+);/g, (entity, name: string) => ENTITIES[name] ?? entity)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}
