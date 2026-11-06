// Fichier de calendrier standard (.ics), compris par le Calendrier de l'iPhone, Google Agenda, Outlook…

export type CalendarEvent = {
  uid: string; // identifiant stable : ajouter deux fois le même rendez-vous le met à jour au lieu de le dupliquer
  start: Date;
  durationMinutes: number;
  title: string;
  location?: string;
  description?: string;
  lat?: number | null;
  lng?: number | null;
  alarmsMinutesBefore?: number[]; // rappels, ex. [1440, 60] = la veille et 1 h avant
};

const pad = (n: number) => String(n).padStart(2, '0');
const utc = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// Les lignes de plus de 75 octets doivent être « pliées » (norme RFC 5545).
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = '';
  let size = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (size + n > (out.length ? 74 : 75)) {
      out.push(current);
      current = '';
      size = 0;
    }
    current += ch;
    size += n;
  }
  out.push(current);
  return out.join('\r\n ');
}

export function buildIcs(e: CalendarEvent, now = new Date()): string {
  const end = new Date(e.start.getTime() + e.durationMinutes * 60000);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Arboject//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${e.uid}`,
    `DTSTAMP:${utc(now)}`,
    `DTSTART:${utc(e.start)}`,
    `DTEND:${utc(end)}`,
    `SUMMARY:${escape(e.title)}`,
    ...(e.location ? [`LOCATION:${escape(e.location)}`] : []),
    ...(e.description ? [`DESCRIPTION:${escape(e.description)}`] : []),
    ...(e.lat != null && e.lng != null ? [`GEO:${e.lat.toFixed(6)};${e.lng.toFixed(6)}`] : []),
    ...(e.alarmsMinutesBefore ?? []).flatMap((m) => [
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escape(e.title)}`,
      `TRIGGER:-PT${m}M`,
      'END:VALARM',
    ]),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}
