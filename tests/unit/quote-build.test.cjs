// Construction du devis depuis la visite : exemple du calculateur Excel (manguier sur piscine).
const assert = require('node:assert');
const { test } = require('node:test');
const { buildQuoteLines, recomputeLine, quoteTotals, formatQuoteNumber, addDays } = require('../../src/domain/quote-build.ts');
const { DEFAULT_PARAMS } = require('../../src/domain/pricing.ts');

const items = [
  { id: 'demontage', label: 'Démontage sans rétention', unit: 'arbre', suggested_price_cents: 83300, my_price_cents: null },
  { id: 'souche', label: 'Rognage de souche – diamètre 40 à 80 cm', unit: 'souche', suggested_price_cents: 30000, my_price_cents: null },
  { id: 'palmier', label: 'Taille de palmier / cocotier', unit: 'arbre', suggested_price_cents: 17700, my_price_cents: null },
];
const tree = (o) => ({ species: null, quantity: 1, retention: 0, big_trunk: 0, urgent: 0, estimated_ground_hours: 0, estimated_climber_hours: 0, waste_m3: 0, intervention: null, ...o });

test('devis construit depuis la visite = calculateur Excel', () => {
  const trees = [
    tree({ id: 't1', number: 1, species: 'Manguier', price_item_id: 'demontage', retention: 1, big_trunk: 1, estimated_ground_hours: 3, waste_m3: 6 }),
    tree({ id: 't2', number: 2, price_item_id: 'souche' }),
    tree({ id: 't3', number: 3, species: 'Cocotiers', price_item_id: 'palmier', quantity: 2 }),
    tree({ id: 't4', number: 4, species: 'Sans intervention' }),
  ];
  const lines = buildQuoteLines(trees, items, DEFAULT_PARAMS);
  assert.deepStrictEqual(lines.map((l) => [l.kind, l.totalCents]), [
    ['prestation', 129115],
    ['prestation', 30000],
    ['prestation', 35400],
    ['heures_sol', 10500],
    ['evacuation', 36000],
    ['deplacement', 4500],
  ]);
  assert.strictEqual(lines[0].label, 'Démontage sans rétention (Manguier, arbre n° 1)');
  assert.strictEqual(lines[1].label, 'Rognage de souche – diamètre 40 à 80 cm (arbre n° 2)');
  assert.deepStrictEqual(quoteTotals(lines.map((l) => l.totalCents), 0), { htCents: 245515, vatCents: 0, ttcCents: 245515 });
  assert.deepStrictEqual(quoteTotals(lines.map((l) => l.totalCents), 850), { htCents: 245515, vatCents: 20869, ttcCents: 266384 });
});

test('modification d’une ligne et numérotation', () => {
  assert.deepStrictEqual(recomputeLine({ kind: 'prestation', quantity: 2, unitPriceCents: 10000, retention: true, bigTrunk: false, urgent: true }, DEFAULT_PARAMS), { surchargeBp: 7000, totalCents: 34000 });
  assert.deepStrictEqual(recomputeLine({ kind: 'location', quantity: 1, unitPriceCents: 150000, retention: true, bigTrunk: false, urgent: false }, DEFAULT_PARAMS), { surchargeBp: 0, totalCents: 150000 });
  assert.strictEqual(formatQuoteNumber(2026, 7), 'D-2026-0007');
  assert.strictEqual(addDays('2026-11-07', 30), '2026-12-07');
  assert.strictEqual(addDays('2026-12-15', 30), '2027-01-14');
});

test('ligne offerte : hors total, valeur gardée', () => {
  const { quoteTotalsFromLines } = require('../../src/domain/quote-build.ts');
  const lines = [{ total_ht_cents: 100000 }, { total_ht_cents: 30000, offered: 1 }, { total_ht_cents: 4500, offered: 0 }];
  assert.deepStrictEqual(quoteTotalsFromLines(lines, 0), { htCents: 104500, vatCents: 0, ttcCents: 104500, offeredCents: 30000 });
  assert.deepStrictEqual(quoteTotalsFromLines(lines, 850), { htCents: 104500, vatCents: 8883, ttcCents: 113383, offeredCents: 30000 });
});
