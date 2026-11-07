// Fiche d'intervention : pré-remplissage, contrôles avant signature, PDF (npm run test:unit)
const assert = require('node:assert');
const { test } = require('node:test');
const { inflateSync } = require('node:zlib');
const iv = require('../../src/domain/intervention.ts');
const { buildSheetPdf } = require('../../src/pdf/sheet-pdf.ts');

function pdfStrings(buf) {
  const raw = Buffer.from(buf).toString('latin1');
  let out = raw;
  for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
    try {
      out += inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1');
    } catch {}
  }
  return [...out.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)].map((m) => m[1].replace(/\\(.)/g, '$1')).join(' | ');
}

test('pré-remplissage depuis la visite et le devis', () => {
  const f = iv.prefillSheet({ siteAddress: '5 allée des Lataniers, 97434 Saint-Gilles', lat: -21.05, lng: 55.23, works: ['Démontage (Manguier, arbre n° 1)'], nearPowerLines: true, start: '2026-11-20', end: '2026-11-20', usesRopes: true });
  assert.match(f.location, /Lataniers/);
  assert.match(f.location, /GPS -21\.05000, 55\.23000/);
  assert.equal(f.works, '• Démontage (Manguier, arbre n° 1)');
  const r = JSON.parse(f.risks);
  assert.ok(r.checked.includes('lignes_electriques'), 'lignes électriques cochées (visite)');
  assert.ok(r.checked.includes('chute_hauteur'));
  assert.match(f.prevention, /DT-DICT/);
  assert.match(f.accident_procedure, /15/);
  assert.deepEqual(iv.missingSheetFields(f), []);
});

test('contrôles avant signature', () => {
  assert.deepEqual(iv.missingSheetFields({ location: ' ', works: 'x', start_date: '2026-11-21', end_date: '2026-11-20', risks: '{"checked":[],"other":""}', prevention: 'x', accident_procedure: 'x', rescue: '' }), [
    'emplacement', 'date de fin avant la date de début', 'risques', 'organisation des secours',
  ]);
  assert.equal(iv.retainUntil(new Date('2026-11-20T08:00:00Z')), '2028-11-20');
});

test('PDF de la fiche : 6 rubriques, signatures, conservation, responsabilité', () => {
  const f = iv.prefillSheet({ siteAddress: '1 rue du Test, 97400 Saint-Denis', lat: null, lng: null, works: ['Élagage'], nearPowerLines: false, start: '2026-11-20', end: '2026-11-21', usesRopes: true });
  const pdf = buildSheetPdf({
    company: { name: 'Élagage Test', city: 'Saint-Denis' },
    sheet: { ...f, version: 1, status: 'signee', signer_name: 'Gérant Test', signed_at: '2026-11-19T06:00:00Z', retain_until: '2028-11-19' },
    jobTitle: 'Mme Fiche – D-2026-0001',
    team: [{ name: 'Paul', role: 'Chef' }],
    acks: [{ name: 'Paul', acknowledged_at: '2026-11-20T04:00:00Z' }],
  });
  const s = pdfStrings(pdf);
  for (const m of ["FICHE D'INTERVENTION", '1. Emplacement', '2. Croquis', '3. Risques', '4. Mesures de prévention', "5. Conduite à tenir en cas d'accident", '6. Organisation des secours', 'par Gérant Test', "jusqu'au 19/11/2028", 'Paul', 'la responsabilité restent celles de l']) {
    assert.ok(s.includes(m), `manque : ${m}`);
  }
});
