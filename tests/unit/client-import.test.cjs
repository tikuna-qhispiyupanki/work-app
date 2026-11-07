// Import de clients (Excel / CSV) : lecture, colonnes, téléphones, doublons (npm run test:unit)
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const imp = require('../../src/domain/client-import.ts');
const { readWorkbook } = require('../../src/domain/xlsx.ts');

const fx = (f) => new Uint8Array(fs.readFileSync(path.join(__dirname, '..', 'fixtures', f)));

test('téléphones', () => {
  assert.equal(imp.formatPhone('0692112233'), '0692 11 22 33');
  assert.equal(imp.formatPhone('+262 692 44 55 66'), '0692 44 55 66');
  assert.equal(imp.formatPhone('00262692445566'), '0692 44 55 66');
  assert.equal(imp.formatPhone('692123456'), '0692 12 34 56'); // 0 perdu par Excel
  assert.equal(imp.formatPhone('06.92.11.22.33'), '0692 11 22 33');
  assert.equal(imp.formatPhone('3631'), '3631'); // non reconnu : gardé tel quel
});

test('CSV Excel France (point-virgule, Windows-1252)', () => {
  const table = imp.parseCsv(imp.decodeText(fx('clients-excel-fr.csv')));
  const h = imp.findHeaderRow(table);
  assert.equal(h, 0);
  const m = imp.guessMapping(table[h]);
  assert.deepEqual(m, { lastName: 0, firstName: 1, company: 2, phone: 3, phone2: 4, email: 5, address: 6, address2: 7, postalCode: 8, city: 9, notes: 10 });
  const existing = [{ name: 'Lucie Grondin', phone: null, email: null, postal_code: '97410' }];
  const c = imp.buildCandidates(table, h, m, existing);
  assert.equal(c.length, 6);
  assert.deepEqual(c[0].client, { kind: 'particulier', name: 'Payet Jean', phone: '0692 11 22 33', email: 'jean.payet@exemple.invalid', address: '12 chemin des Filaos', postalCode: '97434', city: 'Saint-Gilles-les-Bains', notes: 'Chien méchant' });
  assert.equal(c[1].client.phone, '0262 33 44 55'); // fixe pris si pas de portable
  assert.equal(c[1].client.address, '5 rue des Letchis, Résidence Les Palmiers');
  assert.equal(c[1].client.name, 'Hoarau Marie'); // accents et encodage corrects
  assert.equal(c[2].client.kind, 'professionnel');
  assert.equal(c[2].client.name, 'Syndic Océan');
  assert.equal(c[2].client.notes, 'Contact : Técher Paul');
  assert.equal(c[3].status, 'doublon_fichier');
  assert.equal(c[4].status, 'sans_nom');
  assert.equal(c[5].status, 'doublon'); // « Grondin Lucie » 97410 = « Lucie Grondin »
  assert.deepEqual(c.map((x) => x.status), ['nouveau', 'nouveau', 'nouveau', 'doublon_fichier', 'sans_nom', 'doublon']);
  assert.equal(c[0].line, 2);
});

test('Excel (.xlsx) avec titre au-dessus du tableau', () => {
  const book = readWorkbook(fx('clients.xlsx'));
  const table = imp.tableFromSheet([...book.values()][0]);
  const h = imp.findHeaderRow(table);
  assert.equal(h, 1); // ligne vide retirée : titre, puis en-têtes
  const m = imp.guessMapping(table[h]);
  assert.deepEqual(m, { name: 0, phone: 1, email: 2, address: 3, postalCode: 4, city: 5, kind: 6 });
  const c = imp.buildCandidates(table, h, m, [{ name: 'Grondin', phone: '0692 98 76 54', email: '', postal_code: '' }]);
  assert.equal(c[0].client.phone, '0692 12 34 99');
  assert.equal(c[0].client.postalCode, '97430');
  assert.equal(c[1].client.kind, 'professionnel');
  assert.equal(c[2].status, 'doublon');
  assert.match(c[2].reason, /même téléphone/);
});

test('CSV UTF-8 à virgules avec guillemets', () => {
  const t = imp.parseCsv('﻿name,phone,notes\r\n"Dupont, Jean",0692000000,"il dit ""bonjour""\nsur deux lignes"\n');
  assert.deepEqual(t, [['name', 'phone', 'notes'], ['Dupont, Jean', '0692000000', 'il dit "bonjour" sur deux lignes']]);
  assert.equal(imp.columnLabel(0), 'A');
  assert.equal(imp.columnLabel(27), 'AB');
});
