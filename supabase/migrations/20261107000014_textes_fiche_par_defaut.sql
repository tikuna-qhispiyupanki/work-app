-- Arboject – textes par défaut de la fiche d'intervention, propres à chaque entreprise
-- (équipements habituels, risques cochés, mesures de prévention, conduite à tenir, secours), en JSON.
-- Repris automatiquement sur chaque nouvelle fiche. Modifiable par le gérant (règle d'accès existante de companies).
alter table public.companies add column sheet_defaults text check (sheet_defaults is null or length(sheet_defaults) <= 20000);
