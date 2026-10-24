import {dayKey, localDate, toTime} from "./utils";

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
