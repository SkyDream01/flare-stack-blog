const UNSAFE_IN_SCRIPT = /[<>&\u2028\u2029]/g;

/**
 * JSON to place inside an inline `<script>` element, such as JSON-LD. The
 * HTML parser ends a script at `</script` and treats `<!--` specially
 * whatever the JSON means, so `<`, `>` and `&` are written as `\u003c`-style
 * escapes, along with U+2028 and U+2029, which end a line in older
 * JavaScript. Outside strings JSON has none of these characters, so the
 * result parses to the same value.
 */
export function inlineScriptJson(value: unknown): string {
  return JSON.stringify(value).replace(
    UNSAFE_IN_SCRIPT,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}
