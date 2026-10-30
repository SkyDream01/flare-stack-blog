const entities: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#039;": "'",
};

function decode(text: string) {
  return text.replace(
    /&(?:amp|lt|gt|quot|#039);/g,
    (entity) => entities[entity],
  );
}

/**
 * A search API excerpt (`matches.*`): HTML-escaped text whose only tags are
 * `<mark>` around the matched words. Renders the marks as elements and
 * everything else as text, so nothing else in it can become markup.
 */
export function SearchHighlight({
  html,
  fallback,
}: {
  html: string | null;
  fallback: string;
}) {
  if (!html) return fallback;
  return html
    .split(/(<mark>.*?<\/mark>)/gs)
    .map((part, index) =>
      part.startsWith("<mark>") && part.endsWith("</mark>") ? (
        <mark key={index}>{decode(part.slice(6, -7))}</mark>
      ) : (
        decode(part)
      ),
    );
}
