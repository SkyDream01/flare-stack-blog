import { escapeCodeHtml } from "@/lib/plain-code-html";

/*
 * What the feed library (feed, xml-js) leaves to the caller so that RSS and
 * Atom stay well-formed XML 1.0 whatever a Post holds.
 *
 * - It writes characters XML 1.0 forbids (NUL, most control characters,
 *   U+FFFE, lone surrogates) as they are, and the document stops parsing.
 * - It escapes `]]>` inside CDATA once per field: `replace` with a string
 *   takes only the first, so the second one ends the section and the rest is
 *   markup the author controls.
 * - It writes `&amp;` in a text element as `&`, so a title that reads `&amp;`
 *   would come out as `&`.
 *
 * Fields go through `cdataField` or `textField` on the way in and the finished
 * document through `finishXml`, which swaps in what xml-js would have mangled.
 */

// Characters XML 1.0 allows: tab, line feed, carriage return, and everything
// from U+0020 up except the surrogates, U+FFFE and U+FFFF. Matching with `u`
// takes a lone surrogate as one code point, so it is removed too.
const XML_FORBIDDEN =
  /[^\t\n\r\u{20}-\u{D7FF}\u{E000}-\u{FFFD}\u{10000}-\u{10FFFF}]/gu;

// Markers for what finishXml replaces. NUL is forbidden in XML, so the fields
// have lost theirs before a marker goes in and no content can spell one.
const CDATA_END = "\u0000cdata-end\u0000";
const AMPERSAND_ENTITY = "\u0000ampersand\u0000";

/** `text` without the characters XML 1.0 forbids. */
export function withoutXmlForbiddenCharacters(text: string) {
  return text.replace(XML_FORBIDDEN, "");
}

/**
 * `text` as a field the library writes inside CDATA. Every `]]>` is marked
 * for `finishXml` to split the section at.
 */
export function cdataField(text: string) {
  return withoutXmlForbiddenCharacters(text).replaceAll("]]>", CDATA_END);
}

/**
 * `text` as a field the library writes as element text, which it escapes
 * itself.
 */
export function textField(text: string) {
  return withoutXmlForbiddenCharacters(text).replaceAll(
    "&amp;",
    AMPERSAND_ENTITY,
  );
}

/**
 * A plain-text field for a reader that takes it as HTML: Atom `type="html"`
 * and RSS descriptions. `Promise<void>` stays text instead of an unknown tag.
 */
export function htmlFromText(text: string) {
  return escapeCodeHtml(text);
}

/** The library's finished document, with the markers resolved. */
export function finishXml(xml: string) {
  return withoutXmlForbiddenCharacters(
    xml
      .replaceAll(CDATA_END, "]]]]><![CDATA[>")
      .replaceAll(AMPERSAND_ENTITY, "&amp;amp;"),
  );
}
