import { getLocale } from "@/paraglide/runtime";

function intlLocale() {
  return getLocale() === "zh" ? "zh-CN" : "en-US";
}

/** A whole number with the locale's thousands separators. */
export function formatCount(value: number) {
  return new Intl.NumberFormat(intlLocale()).format(value);
}

/** A popularity window's first to last UTC day, e.g. "Sep 14 – Oct 13". */
export function formatWindow(start: number, end: number) {
  return new Intl.DateTimeFormat(intlLocale(), {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).formatRange(new Date(start), new Date(end));
}

/** Today's date with its weekday, e.g. "10月14日星期三". */
export function formatToday(date: Date) {
  return new Intl.DateTimeFormat(intlLocale(), {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}

/** A calendar day, e.g. "2026年10月14日". */
export function formatDay(date: Date) {
  return new Intl.DateTimeFormat(intlLocale(), {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

/** A month label, e.g. "10月" or "Oct". */
export function formatMonth(date: Date) {
  return new Intl.DateTimeFormat(intlLocale(), { month: "short" }).format(date);
}
