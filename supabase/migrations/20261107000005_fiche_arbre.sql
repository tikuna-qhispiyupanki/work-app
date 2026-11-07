-- ============================================================================
-- Arboject – fiche arbre complète (étape 4a)
-- Ce que l'élagueur relève pendant la visite et qui servira au devis.
-- ============================================================================
alter table public.trees
  add column height_m double precision check (height_m >= 0 and height_m <= 120),
  add column trunk_diameter_cm double precision check (trunk_diameter_cm >= 0 and trunk_diameter_cm <= 1000),
  add column price_item_id uuid references public.price_items (id),
  add column intervention text,                        -- libellé copié depuis la grille (reste lisible si la grille change)
  add column quantity double precision not null default 1 check (quantity > 0),
  add column retention smallint not null default 0 check (retention in (0, 1)),      -- piscine, toit, véranda, clôture, voiture dessous
  add column big_trunk smallint not null default 0 check (big_trunk in (0, 1)),      -- tronc > 60 cm
  add column urgent smallint not null default 0 check (urgent in (0, 1)),            -- urgence, week-end, férié
  add column slope smallint not null default 0 check (slope in (0, 1)),              -- pente, ravine, sol instable
  add column far_disposal smallint not null default 0 check (far_disposal in (0, 1)),-- portage éloigné, escaliers
  add column power_lines smallint not null default 0 check (power_lines in (0, 1)),
  add column estimated_ground_hours double precision not null default 0 check (estimated_ground_hours >= 0),
  add column estimated_climber_hours double precision not null default 0 check (estimated_climber_hours >= 0),
  add column waste_m3 double precision not null default 0 check (waste_m3 >= 0);
