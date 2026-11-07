// PDF du devis : mentions obligatoires présentes, ligne offerte, franchise de TVA, signature.
const assert = require('node:assert');
const { test } = require('node:test');
const { inflateSync } = require('node:zlib');
const { buildQuotePdf, pdfText } = require('../../src/pdf/quote-pdf.ts');

// Texte lisible d'un PDF jsPDF : on décompresse les flux de contenu.
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

const base = {
  quote: { number: 'D-2026-0001', status: 'finalise', issued_on: '2026-11-07', valid_until: '2026-12-07', vat_regime: 'franchise', vat_rate_bp: 0,
    site_address: '5 allée des Lataniers, 97434 Saint-Gilles', subtotal_ht_cents: 245515, vat_cents: 0, total_ttc_cents: 245515,
    payment_terms: 'Paiement à réception, par virement, chèque ou espèces.', deposit_bp: 0, notes: null, signed_at: null, signer_name: null },
  lines: [
    { label: 'Démontage sans rétention (Manguier, arbre n° 1)', unit: 'arbre', quantity: 1, unit_price_ht_cents: 83300, surcharge_bp: 5500, total_ht_cents: 129115 },
    { label: 'Taille de palmier / cocotier (Cocotiers, arbre n° 3)', unit: 'arbre', quantity: 2, unit_price_ht_cents: 17700, surcharge_bp: 0, total_ht_cents: 35400, offered: 1 },
    { label: 'Déplacement', unit: 'forfait', quantity: 1, unit_price_ht_cents: 4500, surcharge_bp: 0, total_ht_cents: 4500 },
  ],
  company: { name: 'Mannek Élagage', address: '1 rue du Test', postal_code: '97400', city: 'Saint-Denis', phone: '0692 00 00 01', siret: '12345678900011', insurance_name: 'Assureur X', insurance_policy: 'RC-42' },
  client: { name: 'Mme Devis', address: '5 allée des Lataniers', postal_code: '97434', city: 'Saint-Gilles' },
};

test('PDF du devis : mentions obligatoires', () => {
  const s = pdfStrings(buildQuotePdf(base));
  for (const m of ['DEVIS', 'N° D-2026-0001', 'Date : 07/11/2026', "Valable jusqu'au 07/12/2026", 'Devis gratuit', 'Mannek', 'SIRET 12345678900011',
    'Mme Devis', 'ADRESSE DU CHANTIER', 'Total HT', 'Net à payer', 'TVA non applicable, art. 293 B du CGI', 'Conditions de paiement',
    'Bon pour accord', 'Assureur X', 'Offert', 'Geste commercial']) {
    assert.ok(s.includes(m), `mention absente : ${m}`);
  }
  assert.ok(s.includes('2 455,15'), 'montant du total'); // le signe € est codé à part dans le PDF
  assert.ok(!/ /.test(s), 'pas d’espace fine (illisible dans le PDF)');
});

test('PDF signé : nom et date du signataire', () => {
  const s = pdfStrings(buildQuotePdf({ ...base, quote: { ...base.quote, status: 'signe', signed_at: '2026-11-08T09:30:00Z', signer_name: 'Mme Devis' } }));
  assert.ok(s.includes('Signé le 08/11/2026 par Mme Devis'));
});

test('texte nettoyé pour le PDF', () => {
  assert.strictEqual(pdfText('≈ 2 455,15 € → ✓ 🎁 ok'), '~ 2 455,15 € ->   ok');
});

test('PDF signé à distance : preuve imprimée (empreinte, IP)', () => {
  const hash = 'a'.repeat(32) + 'b'.repeat(32);
  const s = pdfStrings(
    buildQuotePdf({ ...base, quote: { ...base.quote, status: 'signe', signed_at: '2026-11-08T10:00:00Z', signer_name: 'Mme Devis' }, remoteProof: { hash, ip: '203.0.113.7' } })
  );
  assert.match(s, /Signature électronique à distance|Signature \\351lectronique/);
  assert.match(s, new RegExp('a'.repeat(32)));
  assert.match(s, new RegExp('b'.repeat(32)));
  assert.match(s, /203\.0\.113\.7/);
  const { dataUrlBytes } = require('../../src/pdf/quote-pdf.ts');
  assert.deepEqual([...dataUrlBytes('data:image/jpeg;base64,/9j/')], [0xff, 0xd8, 0xff]);
});
