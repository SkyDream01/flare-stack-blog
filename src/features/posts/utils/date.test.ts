import { describe, expect, it } from "vitest";
import {
  isFuturePublishDate,
  parsePublicationDate,
  pickedPublishDate,
  toWholeSecond,
} from "./date";

describe("isFuturePublishDate", () => {
  const now = new Date("2026-10-29T08:00:00.000Z");

  it("counts a time later the same day as the future", () => {
    expect(isFuturePublishDate(new Date("2026-10-29T08:00:01Z"), now)).toBe(
      true,
    );
  });

  it("takes now and any earlier time", () => {
    expect(isFuturePublishDate(now, now)).toBe(false);
    expect(isFuturePublishDate(new Date("2026-10-28T23:59:59Z"), now)).toBe(
      false,
    );
  });
});

describe("pickedPublishDate", () => {
  it("stores a past day at noon UTC", () => {
    expect(pickedPublishDate("2026-10-01", "2026-10-29").toISOString()).toBe(
      "2026-10-01T12:00:00.000Z",
    );
  });

  it("stores today at its start, so it is never in the future", () => {
    expect(pickedPublishDate("2026-10-29", "2026-10-29").toISOString()).toBe(
      "2026-10-29T00:00:00.000Z",
    );
  });
});

describe("toWholeSecond", () => {
  it("drops the milliseconds", () => {
    expect(
      toWholeSecond(new Date("2026-10-29T08:00:00.789Z")).toISOString(),
    ).toBe("2026-10-29T08:00:00.000Z");
  });
});

describe("parsePublicationDate", () => {
  const read = (value: string) => {
    const result = parsePublicationDate(value);
    return "date" in result ? result.date.toISOString() : result.issue;
  };

  it("reads a date alone as its start in UTC", () => {
    expect(read("2026-10-01")).toBe("2026-10-01T00:00:00.000Z");
  });

  it("reads a time with no zone as UTC", () => {
    expect(read("2026-10-01T08:30")).toBe("2026-10-01T08:30:00.000Z");
    expect(read("2026-10-01T08:30:15")).toBe("2026-10-01T08:30:15.000Z");
    expect(read("2026-10-01 08:30:15.250")).toBe("2026-10-01T08:30:15.250Z");
  });

  it("applies a stated zone", () => {
    expect(read("2026-10-01T08:30:15Z")).toBe("2026-10-01T08:30:15.000Z");
    expect(read("2026-10-01T08:30:15+08:00")).toBe("2026-10-01T00:30:15.000Z");
    expect(read("2026-10-01T00:30:15-05:30")).toBe("2026-10-01T06:00:15.000Z");
  });

  it("refuses a day the calendar does not have, instead of rolling over", () => {
    expect(read("2026-02-30")).toBe("NOT_A_DATE");
    expect(read("2026-02-29")).toBe("NOT_A_DATE");
    expect(read("2026-13-01")).toBe("NOT_A_DATE");
    expect(read("2026-04-31")).toBe("NOT_A_DATE");
  });

  it("refuses a time of day the clock does not have", () => {
    expect(read("2026-10-01T24:00:00Z")).toBe("NOT_A_TIME");
    expect(read("2026-10-01T10:60:00Z")).toBe("NOT_A_TIME");
    expect(read("2026-10-01T10:00:60Z")).toBe("NOT_A_TIME");
  });

  it("refuses a UTC offset no zone has", () => {
    expect(read("2026-10-01T10:00:00+24:00")).toBe("NOT_AN_OFFSET");
    expect(read("2026-10-01T10:00:00+25:00")).toBe("NOT_AN_OFFSET");
    expect(read("2026-10-01T10:00:00-08:60")).toBe("NOT_AN_OFFSET");
  });

  it("takes February 29 of a leap year", () => {
    expect(read("2028-02-29")).toBe("2028-02-29T00:00:00.000Z");
  });

  it("refuses a date outside 1970 to 2099", () => {
    expect(read("0001-01-01")).toBe("OUT_OF_RANGE");
    expect(read("1969-12-31T23:59:59Z")).toBe("OUT_OF_RANGE");
    expect(read("2100-01-01")).toBe("OUT_OF_RANGE");
    expect(read("9999-12-31")).toBe("OUT_OF_RANGE");
    expect(read("1970-01-01")).toBe("1970-01-01T00:00:00.000Z");
    expect(read("2099-12-31T23:59:59Z")).toBe("2099-12-31T23:59:59.000Z");
  });

  it("refuses text that is not ISO 8601", () => {
    for (const value of ["", "tomorrow", "10/01/2026", "2026-10", "2026"]) {
      expect(read(value)).toBe("FORMAT");
    }
    expect(read("2026-10-01T08")).toBe("FORMAT");
    expect(read("20261001")).toBe("FORMAT");
  });
});
