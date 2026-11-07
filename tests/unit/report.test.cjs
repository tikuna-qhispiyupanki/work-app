// Rapport de fin de chantier (npm run test:unit)
const assert = require('node:assert');
const { test } = require('node:test');
const { inflateSync } = require('node:zlib');
const rp = require('../../src/domain/report.ts');
const { buildReportPdf } = require('../../src/pdf/report-pdf.ts');

const strings = (buf) => {
  const raw = Buffer.from(buf).toString('latin1');
  let out = raw;
  for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
    try {
      out += inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1');
    } catch {}
  }
  return [...out.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)].map((m) => m[1].replace(/\\(.)/g, '$1')).join(' | ');
};

test('travaux repris du devis, photos avant → après', () => {
  assert.equal(
    rp.worksFromQuote([
      { label: 'Taille de palmier', kind: 'prestation', quantity: 2, unit: 'arbre' },
      { label: 'Déplacement', kind: 'deplacement', quantity: 1, unit: 'forfait' },
      { label: 'Abattage', kind: 'prestation', quantity: 1, unit: 'arbre' },
    ]),
    '• Taille de palmier (2 arbre)\n• Abattage'
  );
  const o = rp.orderPhotos([{ stage: 'apres', caption: null, taken_at: '2' }, { stage: null, caption: null }, { stage: 'avant', caption: null, taken_at: '1' }]);
  assert.deepEqual(o.map((p) => p.stage), ['avant', 'apres', null]);
});

test('PDF du rapport : travaux, conseils, réception', () => {
  const s = strings(
    buildReportPdf({
      company: { name: 'Élagage Test', phone: '0692 00 00 01' },
      client: { name: 'Mme Rapport' },
      jobTitle: 'Mme Rapport – D-2026-0001',
      siteAddress: '1 rue du Test, 97400 Saint-Denis',
      quoteNumber: 'D-2026-0001',
      report: { works_done: '• Taille de palmier', remarks: 'RAS', advice: rp.DEFAULT_ADVICE, finished_on: '2026-11-20', client_signer_name: 'Mme Rapport', client_signed_at: '2026-11-20T10:00:00Z', client_reserves: null },
      photos: [],
    })
  );
  for (const m of ['RAPPORT DE FIN DE CHANTIER', 'Travaux réalisés', 'Taille de palmier', "Conseils d'entretien", 'cyclone', 'réceptionnés le 20/11/2026 par Mme Rapport', 'Sans réserve']) assert.ok(s.includes(m), `manque : ${m}`);
});
