// Import de la grille Excel du fondateur : les prix recalculés doivent être identiques à ceux d'Excel.
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { importGridWorkbook } = require('../../src/domain/grid-import.ts');
const { suggestedPriceCents, heightsFromLabel } = require('../../src/domain/pricing.ts');

const file = path.join(__dirname, '..', '..', 'docs', 'Grille_tarifaire_elagage_Reunion_2026.xlsx');

test('grille du fondateur : 23 prestations, prix identiques à Excel, paramètres lus', () => {
  const g = importGridWorkbook(new Uint8Array(fs.readFileSync(file)));
  assert.deepStrictEqual(g.warnings, [], 'aucun écart avec Excel');
  assert.strictEqual(g.items.length, 23);
  const byLabel = Object.fromEntries(g.items.map((i) => [i.label, i]));
  assert.strictEqual(byLabel["Élagage d'entretien – arbre 5 à 10 m"].suggestedCents, 31300);
  assert.strictEqual(byLabel['Démontage sans rétention'].suggestedCents, 83300);
  assert.strictEqual(byLabel['Démontage avec rétention'].suggestedCents, 108300);
  assert.strictEqual(byLabel['Rognage de souche – diamètre 40 à 80 cm'].suggestedCents, 30000); // base HT : pas de conversion
  assert.strictEqual(byLabel['Taille de haie'].unit, 'mètre linéaire');
  assert.deepStrictEqual([byLabel["Élagage d'entretien – arbre 5 à 10 m"].heightMin, byLabel["Élagage d'entretien – arbre 5 à 10 m"].heightMax], [5, 10]);
  assert.strictEqual(g.params.rateClimberCents, 5000);
  assert.strictEqual(g.params.rateGroundCents, 3500);
  assert.strictEqual(g.params.travelFlatCents, 4500);
  assert.strictEqual(g.params.wastePerM3Cents, 6000);
  assert.strictEqual(g.params.wasteCostPerM3Cents, 200);
  assert.strictEqual(g.params.coefBp, 10000);
  assert.strictEqual(g.params.surchargeBigTrunkBp, 2500);
  assert.strictEqual(g.params.surchargeUrgentBp, 4000);
  assert.strictEqual(g.params.surchargeRetentionBp, 3000);
});

test('coefficient Réunion et arrondi à l’euro', () => {
  assert.strictEqual(suggestedPriceCents(25000, 50000, 'TTC 20 %', { vatHexagoneBp: 2000, coefBp: 11000 }), 34400); // 312,5 × 1,1 = 343,75 → 344
  assert.strictEqual(suggestedPriceCents(5000, 10000, 'HT', { vatHexagoneBp: 2000, coefBp: 10000 }), 7500);
});

test('hauteurs lues dans les libellés', () => {
  assert.deepStrictEqual(heightsFromLabel("Élagage d'entretien – arbre < 5 m"), { min: 0, max: 5 });
  assert.deepStrictEqual(heightsFromLabel("Élagage d'entretien – arbre > 20 m"), { min: 20, max: null });
  assert.deepStrictEqual(heightsFromLabel('Taille de haie'), { min: null, max: null });
});

test('fichier qui n’est pas un Excel : message clair', () => {
  assert.throws(() => importGridWorkbook(new TextEncoder().encode('bonjour')), /pas un classeur Excel/);
});
