// Test simple du fichier calendrier (lancé par : npm run test:unit)
const assert = require('node:assert');
const { buildIcs } = require('../../src/domain/calendar.ts');

const ics = buildIcs(
  {
    uid: 'visite-123@arboject',
    start: new Date('2026-11-09T05:30:00Z'), // 9 h 30 à La Réunion (UTC+4)
    durationMinutes: 60,
    title: 'Visite – Mme Payet',
    location: '12 chemin des Filaos, 97434 Saint-Paul',
    description: 'Tél. 0692 00 00 00\nManguier au-dessus de la piscine, accès par le portail; chien',
    lat: -21.0533,
    lng: 55.2306,
    alarmsMinutesBefore: [1440, 60],
  },
  new Date('2026-11-06T12:00:00Z')
);
assert.match(ics, /DTSTART:20261109T053000Z\r\n/);
assert.match(ics, /DTEND:20261109T063000Z\r\n/);
assert.match(ics, /LOCATION:12 chemin des Filaos\\, 97434 Saint-Paul\r\n/);
assert.match(ics, /TRIGGER:-PT1440M/);
assert.match(ics, /TRIGGER:-PT60M/);
assert.match(ics, /GEO:-21.053300;55.230600/);
for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75, `ligne trop longue : ${line}`);
assert.ok(ics.replace(/\r\n /g, '').includes('accès par le portail\; chien'));
console.log('calendrier : OK');
