/**
 * Schemes a post's link may use: the ones the post renderer's TipTap Link
 * mark keeps. Any other scheme, `javascript:` and `data:` among them, is
 * blanked when the post renders, so a write carrying one is refused instead
 * of being stored to no effect.
 */
const LINK_SCHEMES = new Set([
  "http",
  "https",
  "ftp",
  "ftps",
  "mailto",
  "tel",
  "callto",
  "sms",
  "cid",
  "xmpp",
]);

// Browsers ignore whitespace and control characters in a scheme
// (`java\tscript:` is `javascript:`), so they do not hide one here either.
// eslint-disable-next-line no-control-regex
const IGNORED_IN_SCHEME = /[\s\u0000-\u001f\u007f-\u009f]/g;

/**
 * Whether `href` is a link a post can show: a site path, a `#fragment`, a
 * relative address, or an absolute one with an allowed scheme.
 */
export function isOpenableLinkHref(href: string): boolean {
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(
    href.replace(IGNORED_IN_SCHEME, ""),
  );
  return !scheme || LINK_SCHEMES.has(scheme[1].toLowerCase());
}
