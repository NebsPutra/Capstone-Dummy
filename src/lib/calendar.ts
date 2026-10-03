// "Add to calendar" links for an activity. Times are Asia/Jakarta wall-clock
// (UTC+7 all year, no daylight saving), converted to UTC for both formats.

type CalendarEvent = {
  id: string;
  title: string;
  description?: string | null;
  location: string;
  date: string; // YYYY-MM-DD
  start: string; // HH:MM[:SS]
  end: string; // HH:MM[:SS]
  url: string; // the activity page
};

/** "2026-10-06" + "19:00" in Jakarta -> "20261006T120000Z". */
export function jakartaToUtcStamp(date: string, time: string): string {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCHours(h - 7, m, 0, 0);
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function googleCalendarUrl(e: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${jakartaToUtcStamp(e.date, e.start)}/${jakartaToUtcStamp(e.date, e.end)}`,
    details: [e.description, e.url].filter(Boolean).join("\n\n"),
    location: e.location,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

/** iCalendar escaping: backslash, comma, semicolon, newlines. */
const ics = (s: string) => s.replace(/\\/g, "\\\\").replace(/[,;]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");

/** A one-event .ics file (Apple Calendar, Outlook, most phones) as a data: URL. */
export function icsDataUrl(e: CalendarEvent): string {
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Komunitas//EN",
    "BEGIN:VEVENT",
    `UID:${e.id}@komunitas`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
    `DTSTART:${jakartaToUtcStamp(e.date, e.start)}`,
    `DTEND:${jakartaToUtcStamp(e.date, e.end)}`,
    `SUMMARY:${ics(e.title)}`,
    `LOCATION:${ics(e.location)}`,
    `DESCRIPTION:${ics([e.description, e.url].filter(Boolean).join("\n\n"))}`,
    `URL:${e.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(body)}`;
}
