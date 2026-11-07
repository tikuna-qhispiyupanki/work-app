// Calcul du devis : on reproduit l'exemple de l'onglet « Calculateur » de la grille Excel
// (manguier au-dessus d'une piscine), avec la majoration rétention à 30 % (choix du fondateur).
const assert = require('node:assert');
const { test } = require('node:test');
const { lineTotalCents, simpleLineCents, surchargeBp, totals, vatRateBp } = require('../../src/domain/quote-calc.ts');
const { DEFAULT_PARAMS } = require('../../src/domain/pricing.ts');

test('exemple du calculateur Excel : manguier sur piscine', () => {
  const p = DEFAULT_PARAMS;
  const demontage = lineTotalCents(1, 83300, surchargeBp({ retention: true, bigTrunk: true, urgent: false }, p)); // 833 × 1,55
  const souche = lineTotalCents(1, 30000, 0);
  const palmiers = lineTotalCents(2, 17700, 0);
  const sol = simpleLineCents(3, p.rateGroundCents); // 2 h de portage + 1 h de protection
  const dechets = simpleLineCents(6, p.wastePerM3Cents);
  const deplacement = simpleLineCents(1, p.travelFlatCents);
  assert.strictEqual(demontage, 129115);
  assert.strictEqual(demontage + souche + palmiers, 194515); // sous-total prestations : 1 945,15 €
  const reunion = totals([demontage, souche, palmiers, sol, dechets, deplacement], vatRateBp('assujetti', 'reunion'));
  assert.deepStrictEqual(reunion, { htCents: 245515, vatCents: 20869, ttcCents: 266384 }); // 2 455,15 + 208,69 = 2 663,84
  const franchise = totals([demontage, souche, palmiers, sol, dechets, deplacement], vatRateBp('franchise', 'reunion'));
  assert.deepStrictEqual(franchise, { htCents: 245515, vatCents: 0, ttcCents: 245515 });
  assert.strictEqual(vatRateBp('assujetti', 'hexagone'), 2000);
});

test('majorations additionnées : rétention + tronc + urgence = 95 %', () => {
  assert.strictEqual(surchargeBp({ retention: true, bigTrunk: true, urgent: true }, DEFAULT_PARAMS), 9500);
  assert.strictEqual(lineTotalCents(1, 100000, 9500), 195000);
});

test('arrondi au centime et quantités décimales (haie au mètre)', () => {
  assert.strictEqual(lineTotalCents(12.5, 833, 0), 10413); // 104,125 → 104,13
  assert.strictEqual(simpleLineCents(1.5, 3500), 5250);
});

test('estimation d’un arbre et suggestion selon la hauteur', () => {
  const { estimateTree, suggestItemForHeight } = require('../../src/domain/tree-estimate.ts');
  const e = estimateTree(
    { quantity: 1, retention: 1, big_trunk: 0, urgent: 0, estimated_ground_hours: 2, estimated_climber_hours: 0, waste_m3: 3 },
    { suggested_price_cents: 31300, my_price_cents: null },
    DEFAULT_PARAMS
  );
  assert.deepStrictEqual(e, { prestation: 40690, temps: 7000, dechets: 18000, total: 65690, surchargeBp: 3000 }); // 313 × 1,3 + 2 h × 35 + 3 m³ × 60
  const items = [
    { label: "Élagage d'entretien – arbre < 5 m", category: 'Élagage', height_min_m: 0, height_max_m: 5 },
    { label: "Élagage d'entretien – arbre 5 à 10 m", category: 'Élagage', height_min_m: 5, height_max_m: 10 },
    { label: "Élagage d'entretien – arbre > 20 m", category: 'Élagage', height_min_m: 20, height_max_m: null },
  ];
  assert.strictEqual(suggestItemForHeight(items, 7).label, "Élagage d'entretien – arbre 5 à 10 m");
  assert.strictEqual(suggestItemForHeight(items, 5).label, "Élagage d'entretien – arbre 5 à 10 m");
  assert.strictEqual(suggestItemForHeight(items, 25).label, "Élagage d'entretien – arbre > 20 m");
  assert.strictEqual(suggestItemForHeight(items, null), null);
});
