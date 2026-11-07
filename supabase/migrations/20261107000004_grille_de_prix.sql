-- ============================================================================
-- Arboject – grille de prix (étape 3)
-- Une grille par import de fichier Excel (versions successives : une seule active).
-- Montants en centimes, pourcentages en points de base (3 000 = 30 %).
-- Lecture : gérant, bureau, chef d'équipe (pour faire les devis). Écriture : gérant et bureau.
-- ============================================================================
create table public.price_grids (
  id uuid primary key,
  company_id uuid not null references public.companies (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),
  deleted_at timestamptz,
  name text not null,
  source_file text,
  imported_at timestamptz not null default now(),
  is_active smallint not null default 0 check (is_active in (0, 1)),
  rate_climber_cents integer not null default 5000 check (rate_climber_cents >= 0),
  rate_ground_cents integer not null default 3500 check (rate_ground_cents >= 0),
  travel_flat_cents integer not null default 4500 check (travel_flat_cents >= 0),
  waste_per_m3_cents integer not null default 6000 check (waste_per_m3_cents >= 0),
  waste_cost_per_m3_cents integer not null default 200 check (waste_cost_per_m3_cents >= 0),
  vat_hexagone_bp integer not null default 2000 check (vat_hexagone_bp between 0 and 10000),
  coef_bp integer not null default 10000 check (coef_bp between 1000 and 100000),
  surcharge_retention_bp integer not null default 3000 check (surcharge_retention_bp between 0 and 50000),
  surcharge_big_trunk_bp integer not null default 2500 check (surcharge_big_trunk_bp between 0 and 50000),
  surcharge_urgent_bp integer not null default 4000 check (surcharge_urgent_bp between 0 and 50000)
);
create index price_grids_company_idx on public.price_grids (company_id);

create table public.price_items (
  id uuid primary key,
  company_id uuid not null references public.companies (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),
  deleted_at timestamptz,
  grid_id uuid not null references public.price_grids (id),
  sort_order integer not null default 0,
  label text not null,
  category text,
  unit text,
  min_cents integer check (min_cents >= 0),
  max_cents integer check (max_cents >= 0),
  source_basis text check (source_basis in ('TTC 20 %', 'HT')),
  suggested_price_cents integer not null check (suggested_price_cents >= 0),
  my_price_cents integer check (my_price_cents >= 0),
  height_min_m double precision,
  height_max_m double precision,
  second_source text,
  source text
);
create index price_items_grid_idx on public.price_items (grid_id, sort_order);

do $$
declare t text;
begin
  foreach t in array array['price_grids', 'price_items'] loop
    execute format('create trigger %I_protect before update on public.%I for each row execute function private.protect_ownership()', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function private.touch_updated_at()', t, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I_select on public.%I for select to authenticated using (private.can_edit_visits(company_id))', t, t);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check (private.has_role(company_id, array[''gerant'', ''bureau'']) and created_by = auth.uid())', t, t);
    execute format('create policy %I_update on public.%I for update to authenticated using (private.has_role(company_id, array[''gerant'', ''bureau''])) with check (private.has_role(company_id, array[''gerant'', ''bureau'']))', t, t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- Synchronisation : PowerSync doit pouvoir lire ces tables.
alter publication powersync add table public.price_grids, public.price_items;
do $$
declare r text;
begin
  for r in select rolname from pg_roles where rolname like 'powersync%' and rolreplication loop
    execute format('grant select on public.price_grids, public.price_items to %I', r);
  end loop;
end $$;
