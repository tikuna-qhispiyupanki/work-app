// Réseaux et voirie : DT-DICT, AIPR, découverte fortuite, arrêté de voirie (npm run test:unit)
const assert = require('node:assert');
const { test } = require('node:test');
const { inflateSync } = require('node:zlib');
const nw = require('../../src/domain/networks.ts');
const { buildFindingPdf, buildRoadPermitPdf } = require('../../src/pdf/network-pdf.ts');

const strings = (buf) => {
  const raw = Buffer.from(buf).toString('latin1');
  let out = raw;
  for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
    try {
      out += inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1');
    } catch {}
  }
  return [...out.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)].map((m) => m[1].replace(/\\(.)/g, '$1')).join(' ');
};

test('DT-DICT : informations prêtes à copier', () => {
  const f = nw.dtDictFields({ siteAddress: '4 Rue des Barracudas, 97434 Saint-Paul', lat: -21.0533, lng: 55.2306, start: '2026-11-20', end: '2026-11-21', works: ['Élagage'], company: { name: 'Élagage Test', siret: '123' }, manager: 'Jean', nearPowerLines: true });
  const get = (l) => f.find((x) => x.label === l)?.value;
  assert.equal(get('Coordonnées GPS'), '-21.053300, 55.230600');
  assert.equal(get('Dates prévues'), '20/11/2026 au 21/11/2026');
  assert.match(get('Nature des travaux'), /lignes électriques aériennes \(Élagage\)/);
  assert.equal(get('Entreprise'), 'Élagage Test – SIRET 123');
});

test('AIPR : valide, bientôt, expirée, absente', () => {
  const today = new Date('2026-11-07T12:00:00');
  assert.equal(nw.aiprState({ aipr_profile: 'encadrant', aipr_valid_until: '2028-01-01' }, today), 'ok');
  assert.equal(nw.aiprState({ aipr_profile: 'operateur', aipr_valid_until: '2026-12-01' }, today), 'bientot');
  assert.equal(nw.aiprState({ aipr_profile: 'operateur', aipr_valid_until: '2026-11-01' }, today), 'expiree');
  assert.equal(nw.aiprState({ aipr_profile: null, aipr_valid_until: null }, today), 'absente');
  assert.equal(nw.aiprText({ aipr_profile: 'operateur', aipr_valid_until: '2026-11-01' }, today), 'AIPR Opérateur expirée depuis le 01/11/2026');
  assert.deepEqual(nw.membersWithoutAipr([{ name: 'A', aipr_profile: 'encadrant', aipr_valid_until: '2028-01-01' }, { name: 'B', aipr_profile: null, aipr_valid_until: null }], today).map((m) => m.name), ['B']);
});

test('PDF : constat de découverte et demande d\'arrêté de voirie', () => {
  const s1 = strings(buildFindingPdf({ company: { name: 'Élagage Test' }, jobTitle: 'Mme X', siteAddress: '1 rue A', finding: { found_at: '2026-11-20T08:15:00Z', network_type: 'gaz', description: 'Conduite jaune à 40 cm', damage: 'aucun', actions_taken: 'Arrêt, balisage', operator_contacted: 'GRDF', reporter_name: 'Jean', lat: -21.05, lng: 55.23 }, photos: [] }));
  for (const m of ["DÉCOUVERTE FORTUITE", 'Gaz, hydrocarbures', 'Conduite jaune', 'GRDF', '-21.050000, 55.230000', 'Arrêter immédiatement']) assert.ok(s1.includes(m), `constat, manque : ${m}`);
  const p = nw.defaultRoadPermit({ city: 'Saint-Paul', siteAddress: '1 rue A, 97460 Saint-Paul', start: '2026-11-20', end: null, contact: 'Jean 0692 00 00 01' });
  const s2 = strings(buildRoadPermitPdf({ company: { name: 'Élagage Test' }, permit: p, works: 'élagage de 2 manguiers', today: new Date('2026-11-07') }));
  for (const m of ['Mairie de Saint-Paul', "Objet : demande d'arrêté temporaire", 'du 20/11/2026 au 20/11/2026', 'Interdiction de stationner', 'Jean 0692 00 00 01']) assert.ok(s2.includes(m), `arrêté, manque : ${m}`);
});
