import { getLocale } from "@/paraglide/runtime";

type Locale = "zh" | "en";
type Style = "full" | "short";

// Publication dates already use UTC days for validation and archive grouping.
// Explicit locale + timezone make the SSR text identical to the first client render.
const formats: Record<
  Locale,
  Record<Style, [string, Intl.DateTimeFormatOptions]>
> = {
  zh: {
    full: [
      "zh-CN",
      { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" },
    ],
    short: ["zh-CN", { timeZone: "UTC", month: "2-digit", day: "2-digit" }],
  },
  en: {
    full: [
      "en-US",
      { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" },
    ],
    short: ["en-US", { timeZone: "UTC", month: "2-digit", day: "2-digit" }],
  },
};

// Each Intl.DateTimeFormat costs about a millisecond to build, so they are
// created on first use instead of when the module loads.
const formatters = new Map<string, Intl.DateTimeFormat>();

function getFormatter(locale: Locale, style: Style) {
  const key = `${locale}-${style}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    const [tag, options] = formats[locale][style];
    formatter = new Intl.DateTimeFormat(tag, options);
    formatters.set(key, formatter);
  }
  return formatter;
}

export function formatPublicPostDate(
  value: Date | string | number | null | undefined,
  {
    monthDay = false,
    locale = getLocale(),
  }: { monthDay?: boolean; locale?: Locale } = {},
) {
  if (value == null) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return getFormatter(locale, monthDay ? "short" : "full").format(date);
}
