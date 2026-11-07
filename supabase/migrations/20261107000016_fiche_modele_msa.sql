-- Arboject – fiche d'intervention complétée selon le modèle MSA (notice réf. 12350, oct. 2023)
-- Identification (donneur d'ordre, téléphone en cas d'incident, responsable sur le chantier, nombre de travailleurs,
-- heures), travaux (activités cochées), état sanitaire des arbres, mesures de prévention cochées (dont balisage),
-- mode de communication, ressources de secours, trousse, point de rencontre des secours, observations.
-- Listes cochées en JSON : {"checked": [...], "other": "..."}.
alter table public.intervention_sheets
  add column client_name text,
  add column client_phone text,
  add column company_phone text,
  add column site_manager_name text,
  add column site_manager_phone text,
  add column workers_count integer check (workers_count is null or workers_count between 0 and 200),
  add column start_time text,
  add column end_time text,
  add column activities text,
  add column trees_state text,
  add column measures text,
  add column communication_mode text,
  add column rescue_checks text,
  add column first_aid_location text,
  add column meeting_point text,
  add column observations text;
