-- ============================================================================
-- Arboject – ligne de devis offerte (geste commercial)
-- La ligne garde son montant (affiché comme valeur offerte) mais n'entre pas dans le total.
-- ============================================================================
alter table public.quote_lines add column offered smallint not null default 0 check (offered in (0, 1));
