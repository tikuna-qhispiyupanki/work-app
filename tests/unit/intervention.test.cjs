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
  const f = iv.prefillSheet({ siteAddress: '5 allée des Lataniers, 97434 Saint-Gilles', lat: -21.05, lng: 55.23, works: ['Démontage (Manguier, arbre n° 1)', 'Rognage de souche'], nearPowerLines: true, start: '2026-11-20', end: '2026-11-20', usesRopes: true, companyPhone: '0692 00 00 01', manager: { name: 'Jean Chef', phone: null }, clientName: 'Mme Payet', workersCount: 2 });
  assert.match(f.location, /Lataniers/);
  assert.match(f.location, /GPS -21\.05000, 55\.23000/);
  assert.equal(f.works, '• Démontage (Manguier, arbre n° 1)\n• Rognage de souche');
  assert.deepEqual(JSON.parse(f.activities).checked, ['Démontage avec rétention', 'Rognage / essouchage']);
  assert.ok(JSON.parse(f.measures).checked[0].startsWith('DT-DICT'), 'DT-DICT cochée (lignes électriques)');
  assert.equal(f.site_manager_name, 'Jean Chef');
  assert.match(f.meeting_point, /GPS -21\.05000/);
  assert.deepEqual(iv.missingSheetFields({ ...f, company_phone: '', site_manager_name: null }), ["téléphone en cas d'incident", 'responsable sur le chantier']);
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

test('PDF de la fiche : modèle MSA, signatures, conservation, responsabilité, version papier', () => {
  const f = iv.prefillSheet({ siteAddress: '1 rue du Test, 97400 Saint-Denis', lat: null, lng: null, works: ['Élagage'], nearPowerLines: false, start: '2026-11-20', end: '2026-11-21', usesRopes: true });
  const pdf = buildSheetPdf({
    company: { name: 'Élagage Test', city: 'Saint-Denis' },
    sheet: { ...f, version: 1, status: 'signee', signer_name: 'Gérant Test', signed_at: '2026-11-19T06:00:00Z', retain_until: '2028-11-19' },
    jobTitle: 'Mme Fiche – D-2026-0001',
    team: [{ name: 'Paul', role: 'Chef' }],
    acks: [{ name: 'Paul', acknowledged_at: '2026-11-20T04:00:00Z' }],
  });
  // Version papier : lignes de signature à la main et page à afficher
  const paper = pdfStrings(buildSheetPdf({ company: { name: 'Élagage Test' }, sheet: { ...f, version: 1, status: 'signee', signer_name: 'G', signed_at: '2026-11-19T06:00:00Z', retain_until: '2028-11-19' }, jobTitle: 'X', team: [], acks: [], printable: true }));
  for (const m of ['À AFFICHER SUR LE CHANTIER', 'Nom et prénom', 'Signature', 'Au téléphone, dire', 'Autres (à préciser)']) assert.ok(paper.includes(m), `version papier, manque : ${m}`);
  const s = pdfStrings(pdf);
  for (const m of ["FICHE D'INTERVENTION", 'Identification', "Donneur d'ordre", 'Tél. (incident / accident)', '1. Travaux à réaliser', 'Élagage d\'entretien', 'Moyens d\'élévation', 'Nacelle (PEMP)', 'Matières', '2. Croquis', '3. Risques', 'HTB', 'Chenilles processionnaires', '4. Mesures de prévention', 'Balisage externe', 'Mode de communication', 'Point de rencontre des secours', "5. Conduite à tenir en cas d'accident", '6. Organisation des secours', '7. Conduite à tenir en cas de phénomènes', 'Au téléphone, dire', '114', 'Ne jamais raccrocher le premier', 'par Gérant Test', "jusqu'au 19/11/2028", 'Paul', 'la responsabilité restent celles de l']) {
    assert.ok(s.includes(m), `manque : ${m}`);
  }
});

test('urgences les plus proches (La Réunion, sans réseau)', () => {
  const { nearestHospital, emergencyBlock } = require('../../src/domain/emergency.ts');
  assert.match(nearestHospital({ lat: -21.0533, lng: 55.2306 }).name, /CHOR/); // Saint-Gilles → Saint-Paul
  assert.match(nearestHospital({ lat: -21.3393, lng: 55.4781 }).name, /CHU Sud/); // Saint-Pierre
  assert.match(nearestHospital({ lat: -20.88, lng: 55.45 }).name, /Félix-Guyon/); // Saint-Denis
  assert.match(nearestHospital({ lat: -21.03, lng: 55.71 }).name, /GHER/); // Saint-Benoît
  assert.equal(nearestHospital({ lat: 48.85, lng: 2.35 }), null); // hexagone : à compléter
  const b = emergencyBlock({ address: '4 Rue des Barracudas, 97434 Saint-Paul', lat: -21.0533, lng: 55.2306 });
  assert.match(b, /SAMU 15/);
  assert.match(b, /114 par SMS/);
  assert.match(b, /Point de rencontre des secours \(PRS\)/);
  assert.match(b, /CHOR.*≈ 11 km/);
  assert.match(b, /GPS -21\.05330, 55\.23060/);
});

test('mes textes par défaut repris sur une nouvelle fiche (lignes électriques ajoutées si le chantier en a)', () => {
  const p = iv.prefillSheet({ siteAddress: 'x', lat: null, lng: null, works: ['Élagage'], nearPowerLines: true, start: null, end: null, usesRopes: true });
  const d = { prevention: 'Mes mesures', accident_procedure: 'Ma conduite', rescue: 'Mes secours', risks: JSON.stringify({ checked: ['chute_hauteur'], other: 'Chien' }) };
  const f = iv.applyDefaults(p, d, true);
  assert.equal(f.accident_procedure, 'Ma conduite');
  assert.equal(f.rescue, 'Mes secours');
  const r = JSON.parse(f.risks);
  assert.deepEqual(r.checked, ['chute_hauteur', 'lignes_electriques']);
  assert.equal(r.other, 'Chien');
  assert.match(f.prevention, /^Mes mesures\n• Lignes électriques/);
  assert.equal(f.works, '• Élagage'); // le contenu propre au chantier ne change pas
  assert.equal(iv.applyDefaults(p, null, true), p);
});
