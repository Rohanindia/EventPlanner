import { describe, it, expect } from "vitest";
import {
  daysBetween,
  addDays,
  countdownDays,
  isOverdue,
  generateICS,
  formatDate,
  todayString,
  compressTimeline,
} from "@/lib/dates";
import type { TimelineItem } from "@/lib/validation";

const FUTURE_DATE = "2999-12-31";
const PAST_DATE = "2020-01-01";

const makeTask = (overrides: Partial<TimelineItem> = {}): TimelineItem => ({
  id: "t1",
  date: FUTURE_DATE,
  task: "Test task",
  category: "Planning",
  priority: "high",
  done: false,
  notes: "",
  ...overrides,
});

describe("daysBetween", () => {
  it("returns 0 for same date", () => {
    expect(daysBetween("2025-01-01", "2025-01-01")).toBe(0);
  });

  it("returns positive for future date", () => {
    expect(daysBetween("2025-01-01", "2025-01-02")).toBe(1);
  });

  it("returns negative for past date", () => {
    expect(daysBetween("2025-01-02", "2025-01-01")).toBe(-1);
  });

  it("handles month boundaries correctly", () => {
    expect(daysBetween("2025-01-31", "2025-03-02")).toBe(30);
  });
});

describe("addDays", () => {
  it("adds positive days", () => {
    expect(addDays("2025-01-01", 5)).toBe("2025-01-06");
  });

  it("subtracts with negative days", () => {
    expect(addDays("2025-01-06", -5)).toBe("2025-01-01");
  });

  it("handles month rollovers", () => {
    expect(addDays("2025-01-31", 1)).toBe("2025-02-01");
  });
});

describe("countdownDays", () => {
  it("returns 0 for past dates", () => {
    expect(countdownDays(PAST_DATE)).toBe(0);
  });

  it("returns positive for future dates", () => {
    expect(countdownDays(FUTURE_DATE)).toBeGreaterThan(0);
  });
});

describe("isOverdue", () => {
  it("returns false for future undone task", () => {
    expect(isOverdue(makeTask({ date: FUTURE_DATE, done: false }))).toBe(false);
  });

  it("returns false for done past task", () => {
    expect(isOverdue(makeTask({ date: PAST_DATE, done: true }))).toBe(false);
  });

  it("returns true for past undone task", () => {
    expect(isOverdue(makeTask({ date: PAST_DATE, done: false }))).toBe(true);
  });
});

describe("generateICS", () => {
  const tasks: TimelineItem[] = [
    makeTask({
      id: "t1",
      date: "2026-01-15",
      task: "Book venue",
      category: "Venue",
      priority: "high",
    }),
    makeTask({
      id: "t2",
      date: "2026-02-01",
      task: 'Task with "quotes" and commas, semicolons;',
      category: "Test",
      priority: "low",
    }),
  ];

  it("contains VCALENDAR wrapper", () => {
    const ics = generateICS(tasks, "My Wedding", "2026-03-01");
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("contains task summaries", () => {
    const ics = generateICS(tasks, "My Wedding", "2026-03-01");
    expect(ics).toContain("Book venue");
  });

  it("escapes commas in task names", () => {
    const ics = generateICS(tasks, "My Wedding", "2026-03-01");
    // Commas must be escaped in ICS
    expect(ics).not.toMatch(/[^\\],(?!.*PRODID)/); // rough check
  });

  it("folds long lines", () => {
    const longTask = makeTask({ task: "A".repeat(200) });
    const ics = generateICS([longTask], "Event", "2026-12-01");
    const lines = ics.split("\r\n");
    lines.forEach((line) => {
      expect(line.length).toBeLessThanOrEqual(76); // 75 + possible continuation space
    });
  });

  it("includes event VEVENT for the main event date", () => {
    const ics = generateICS([], "My Event", "2027-06-15");
    expect(ics).toContain("20270615");
  });

  it("handles injection in event name", () => {
    const ics = generateICS([], "Event\r\nINJECTED:HEADER", "2027-01-01");
    // Newline should be escaped as \\n, not a literal unescaped CRLF newline
    expect(ics).not.toContain("\r\nINJECTED:HEADER");
    expect(ics).toContain("SUMMARY:Event\\nINJECTED:HEADER");
  });
});

describe("formatDate", () => {
  it("formats a date string", () => {
    const result = formatDate("2025-12-25");
    expect(result).toMatch(/25/);
    expect(result).toMatch(/Dec|dec/i);
  });
});

describe("todayString", () => {
  it("returns a valid YYYY-MM-DD string", () => {
    const today = todayString();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("compressTimeline", () => {
  it("returns all items dated to today if event is past", () => {
    const today = todayString();
    const items: TimelineItem[] = [
      makeTask({ id: "c1", date: "2020-06-01" }),
      makeTask({ id: "c2", date: "2020-07-01" }),
    ];
    const result = compressTimeline(items, "2020-01-01");
    result.forEach((item) => {
      expect(item.date).toBe(today);
    });
  });

  it("compresses timeline within available days", () => {
    const tomorrow = addDays(todayString(), 1);
    const items: TimelineItem[] = [
      makeTask({ id: "c1", date: "2020-01-01" }),
      makeTask({ id: "c2", date: "2020-06-01" }),
    ];
    const result = compressTimeline(items, tomorrow);
    result.forEach((item) => {
      expect(item.date >= todayString()).toBe(true);
      expect(item.date <= tomorrow).toBe(true);
    });
  });

  it("handles empty items array", () => {
    const result = compressTimeline([], "2030-01-01");
    expect(result).toEqual([]);
  });

  it("preserves item properties except date", () => {
    const items: TimelineItem[] = [
      makeTask({ id: "c1", date: "2020-01-01", task: "Test task", category: "Cat1" }),
    ];
    const result = compressTimeline(items, "2030-01-01");
    expect(result[0]?.task).toBe("Test task");
    expect(result[0]?.category).toBe("Cat1");
  });
});
