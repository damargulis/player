import {dayKey, localDate, localDayKey, toTime} from "./utils";

describe("localDate", () => {
  it("keeps a date-only value on the right day, whatever the timezone", () => {
    // new Date('2027-01-14') is UTC midnight, which is the 13th anywhere west of Greenwich
    const d = localDate("2027-01-14");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toStrictEqual([2027, 0, 14]);
  });

  it("keeps the time when there is one", () => {
    const d = localDate("2026-12-09T19:30");
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toStrictEqual([9, 19, 30]);
  });

  it("treats a full timestamp as local rather than converting it", () => {
    const d = localDate("2026-12-09T19:30:00.000Z");
    expect([d.getDate(), d.getHours()]).toStrictEqual([9, 19]);
  });

  it("survives a bare month or day", () => {
    expect(localDate("2026-12-09").getDate()).toBe(9);
    expect(localDate("2026-01-01").getMonth()).toBe(0);
  });
});

describe("dayKey", () => {
  it("is the date half, with or without a time", () => {
    expect(dayKey("2027-01-14")).toBe("2027-01-14");
    expect(dayKey("2026-12-09T19:30")).toBe("2026-12-09");
  });

  it("round-trips with localDate", () => {
    const key = "2026-11-28";
    const d = localDate(key);
    const rebuilt = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-` +
      `${String(d.getDate()).padStart(2, "0")}`;
    expect(rebuilt).toBe(key);
  });
});

test("toTime still formats durations", () => {
  expect(toTime(90000)).toBe("1:30");
});

describe("localDayKey", () => {
  /**
   * The bug it exists for: `toISOString().slice(0, 10)` gives the UTC day, which west of
   * Greenwich is already tomorrow for the last hours of every evening. It was live in three
   * places — the DJ's concert window, the concerts calendar's "today", and the JamBase sweep's
   * start date.
   */
  it("gives the local day, not the UTC one", () => {
    // 2026-11-12 20:48 local. In any negative-offset zone the UTC instant is already the 13th.
    const evening = new Date(2026, 10, 12, 20, 48);
    expect(localDayKey(evening)).toBe("2026-11-12");
    if (evening.getTimezoneOffset() > 0) {
      // only meaningful west of Greenwich, which is where this machine is
      expect(evening.toISOString().slice(0, 10)).toBe("2026-11-13");
    }
  });

  it("pads single-digit months and days", () => {
    expect(localDayKey(new Date(2026, 0, 5, 12, 0))).toBe("2026-01-05");
  });

  it("is stable across the whole of a local day", () => {
    const start = localDayKey(new Date(2026, 10, 12, 0, 0));
    const end = localDayKey(new Date(2026, 10, 12, 23, 59));
    expect(start).toBe("2026-11-12");
    expect(end).toBe(start);
  });

  it("defaults to now", () => {
    expect(localDayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
