import type { TimelineItem } from "@/lib/validation";

/** Days between two date strings (YYYY-MM-DD). Positive if b > a. */
export function daysBetween(a: string, b: string): number {
  const da = new Date(a);
  const db = new Date(b);
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

/** Today as YYYY-MM-DD */
export function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Add/subtract days from a YYYY-MM-DD string. */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Countdown in days from today to an event date. Always >= 0. */
export function countdownDays(eventDate: string): number {
  return Math.max(0, daysBetween(todayString(), eventDate));
}

/**
 * Compress timeline milestones so they fit within [today, eventDate].
 * If the event is soon (< 30 days), tasks get proportionally accelerated.
 * Returns items with dates clamped and sorted.
 */
export function compressTimeline(items: TimelineItem[], eventDate: string): TimelineItem[] {
  const today = todayString();
  const totalDays = daysBetween(today, eventDate);

  if (totalDays <= 0) {
    // Event is today or past — pin everything to today
    return items.map((item) => ({ ...item, date: today }));
  }

  // Sort items by their ideal daysBeforeEvent order (we use their date proximity to event)
  const sorted = [...items].sort((a, b) => {
    const da = daysBetween(a.date, eventDate);
    const db = daysBetween(b.date, eventDate);
    return db - da; // earliest tasks first (farthest from event)
  });

  // Compress: map original offset from event to compressed range
  const offsets = sorted.map((item) => daysBetween(item.date, eventDate));
  const maxOffset = Math.max(...offsets, 1);

  return sorted.map((item, idx) => {
    const offset = offsets[idx] ?? 0;
    const compressedOffset = Math.round((offset / maxOffset) * totalDays);
    const newDate = addDays(eventDate, -compressedOffset);
    // Clamp to [today, eventDate]
    const clamped = newDate < today ? today : newDate > eventDate ? eventDate : newDate;
    return { ...item, date: clamped };
  });
}

/**
 * Format a date string as a human-readable label.
 * Uses en-IN locale for consistency.
 */
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Check if a task is overdue (date < today and not done). */
export function isOverdue(item: TimelineItem): boolean {
  return !item.done && item.date < todayString();
}

// ===== ICS Generation =====

/** Escape text for ICS VEVENT properties (RFC 5545). */
function icsEscape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}

/** Fold long ICS lines at 75 octets (RFC 5545 §3.1). */
function icsLineFold(line: string): string {
  const MAX = 75;
  if (line.length <= MAX) return line;
  const chunks: string[] = [];
  chunks.push(line.slice(0, MAX));
  let i = MAX;
  while (i < line.length) {
    chunks.push(" " + line.slice(i, i + MAX - 1));
    i += MAX - 1;
  }
  return chunks.join("\r\n");
}

/** Convert YYYY-MM-DD to ICS DATE value */
function icsDate(dateStr: string): string {
  return dateStr.replace(/-/g, "");
}

/** Generate an ICS calendar string from timeline items. */
export function generateICS(items: TimelineItem[], eventName: string, eventDate: string): string {
  const now = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");

  const vevents = items
    .map((item, idx) => {
      const uid = `jashn-task-${idx + 1}-${icsDate(item.date)}@jashn.app`;
      const summary = icsEscape(`[${eventName}] ${item.task}`);
      const description = icsEscape(
        `Category: ${item.category}\nPriority: ${item.priority}${item.notes ? `\nNotes: ${item.notes}` : ""}`,
      );
      return [
        "BEGIN:VEVENT",
        icsLineFold(`UID:${uid}`),
        `DTSTAMP:${now}`,
        `DTSTART;VALUE=DATE:${icsDate(item.date)}`,
        `DTEND;VALUE=DATE:${icsDate(addDays(item.date, 1))}`,
        icsLineFold(`SUMMARY:${summary}`),
        icsLineFold(`DESCRIPTION:${description}`),
        `STATUS:${item.done ? "COMPLETED" : "NEEDS-ACTION"}`,
        `PRIORITY:${item.priority === "high" ? 1 : item.priority === "medium" ? 5 : 9}`,
        "END:VEVENT",
      ].join("\r\n");
    })
    .join("\r\n");

  const mainEvent = [
    "BEGIN:VEVENT",
    `UID:jashn-event-${icsDate(eventDate)}@jashn.app`,
    `DTSTAMP:${now}`,
    `DTSTART;VALUE=DATE:${icsDate(eventDate)}`,
    `DTEND;VALUE=DATE:${icsDate(addDays(eventDate, 1))}`,
    icsLineFold(`SUMMARY:${icsEscape(eventName)}`),
    "END:VEVENT",
  ].join("\r\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Jashn//AI Event Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    mainEvent,
    vevents,
    "END:VCALENDAR",
  ].join("\r\n");
}
