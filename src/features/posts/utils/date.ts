/** Server UTC calendar date (YYYY-MM-DD). */
export function serverUtcDateString(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * True when the publish date is later than `now`, to the second: a time later
 * today is in the future too. The column stores whole seconds.
 */
export function isFuturePublishDate(publishedAt: Date, now = new Date()) {
  return publishedAt.getTime() > now.getTime();
}

/**
 * The publish date the editor stores for a day picked in its date picker
 * (YYYY-MM-DD, UTC). A past day is stored at noon UTC, as before. Today is
 * stored at its start, since noon may still be ahead and publishing would then
 * refuse it as a date in the future.
 */
export function pickedPublishDate(day: string, serverToday: string) {
  return new Date(`${day}T${day < serverToday ? "12:00:00" : "00:00:00"}Z`);
}

/**
 * `date` cut to the whole second, the precision `posts.published_at` stores,
 * so the Public Content Snapshot carries the same value admin reads return.
 */
export function toWholeSecond(date: Date) {
  return new Date(Math.floor(date.getTime() / 1000) * 1000);
}

/**
 * The earliest and latest publication date the API takes. Anything outside is
 * a typo or a placeholder such as 0001-01-01, not a date a Post was published.
 */
export const PUBLICATION_DATE_MIN = new Date("1970-01-01T00:00:00.000Z");
export const PUBLICATION_DATE_MAX = new Date("2100-01-01T00:00:00.000Z");

const PUBLICATION_DATE_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2})?)?$/i;

export type PublicationDateIssue =
  | "FORMAT"
  | "NOT_A_DATE"
  | "NOT_A_TIME"
  | "NOT_AN_OFFSET"
  | "OUT_OF_RANGE";

/**
 * Reads an ISO 8601 date or date-time: `2026-10-01`, `2026-10-01T08:30`,
 * `2026-10-01T08:30:15.250Z`, `2026-10-01T08:30:15+08:00`. A date alone is
 * its start, and a time with no `Z` or offset is UTC. A calendar date, time
 * of day or UTC offset that does not exist, such as 2026-02-30, 24:00 or
 * +25:00, is refused rather than rolled over, and so is a date outside
 * `PUBLICATION_DATE_MIN` to `PUBLICATION_DATE_MAX`.
 */
export function parsePublicationDate(
  value: string,
): { date: Date } | { issue: PublicationDateIssue } {
  const match = PUBLICATION_DATE_PATTERN.exec(value.trim());
  if (!match) return { issue: "FORMAT" };
  const [, year, month, day, hour = "0", minute = "0", second = "0"] = match;
  const [y, mo, d, h, mi, s] = [year, month, day, hour, minute, second].map(
    Number,
  );
  // Date.UTC reads years 0 to 99 as 1900 to 1999, and no zone moves a date by
  // a year, so such a year is out of range before it is checked further.
  if (y < PUBLICATION_DATE_MIN.getUTCFullYear() - 1 || y > 2100) {
    return { issue: "OUT_OF_RANGE" };
  }
  // Date.UTC rolls an impossible field over; reading it back tells.
  const midnight = new Date(Date.UTC(y, mo - 1, d));
  const dayExists =
    midnight.getUTCFullYear() === y &&
    midnight.getUTCMonth() === mo - 1 &&
    midnight.getUTCDate() === d;
  if (!dayExists) return { issue: "NOT_A_DATE" };
  if (h > 23 || mi > 59 || s > 59) return { issue: "NOT_A_TIME" };
  const wall = new Date(Date.UTC(y, mo - 1, d, h, mi, s));

  let offsetMinutes = 0;
  const zone = match[8];
  if (zone && zone.toUpperCase() !== "Z") {
    const [offsetHour, offsetMinute] = zone.slice(1).split(":").map(Number);
    if (offsetHour > 23 || offsetMinute > 59) {
      return { issue: "NOT_AN_OFFSET" };
    }
    offsetMinutes =
      (zone.startsWith("-") ? -1 : 1) * (offsetHour * 60 + offsetMinute);
  }
  const milliseconds = Math.floor(Number(`0.${match[7] ?? "0"}`) * 1000);
  const date = new Date(wall.getTime() - offsetMinutes * 60_000 + milliseconds);
  if (date < PUBLICATION_DATE_MIN || date >= PUBLICATION_DATE_MAX) {
    return { issue: "OUT_OF_RANGE" };
  }
  return { date };
}
