-- Arboject – fiche d'intervention : 7e élément obligatoire selon la notice MSA (oct. 2023)
-- « Les consignes sur la conduite à tenir en cas d'intempéries et de phénomènes météorologiques imprévus ».
alter table public.intervention_sheets add column weather_procedure text;
