// Marge interne du devis (npm run test:unit)
const assert = require('node:assert');
const { test } = require('node:test');
const { quoteMargin } = require('../../src/domain/margin.ts');

test('marge : prix HT − équipe − déchèterie', () => {
  // Exemple Excel : 2 455,15 € HT ; 1 grimpeur 7 h à 28 €, 1 homme au sol 7 h à 22 € ; 6 m³ à 2 € de dépôt
  const m = quoteMargin({
    revenueCents: 245515,
    crew: [{ hours: 7, hourlyCostCents: 2800 }, { hours: 7, hourlyCostCents: 2200 }],
    wasteM3: 6,
    wasteCostPerM3Cents: 200,
  });
  assert.equal(m.crewHours, 14);
  assert.equal(m.crewCostCents, 35000);
  assert.equal(m.wasteCostCents, 1200);
  assert.equal(m.marginCents, 245515 - 36200);
  assert.equal(m.marginBp, 8526); // 85,26 %
  assert.equal(m.missingCosts, 0);
});

test('marge : coût manquant signalé, demi-heures, prix nul', () => {
  const m = quoteMargin({ revenueCents: 0, crew: [{ hours: 3.5, hourlyCostCents: 2000 }, { hours: 2, hourlyCostCents: null }], wasteM3: 0, wasteCostPerM3Cents: 200 });
  assert.equal(m.crewCostCents, 7000);
  assert.equal(m.missingCosts, 1);
  assert.equal(m.marginBp, null);
});
