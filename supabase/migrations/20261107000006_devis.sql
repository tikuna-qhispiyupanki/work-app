-- ============================================================================
-- Arboject – devis (étape 4b)
-- Un devis est créé depuis une visite. « brouillon » : modifiable ; « finalise » : numéroté,
-- coordonnées copiées et montants figés ; « signe » / « refuse » : décision du client (étape 4c).
-- Montants en centimes, pourcentages en points de base.
-- ============================================================================
create table public.quotes (
  id uuid primary key,
  company_id uuid not null references public.companies (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),
  deleted_at timestamptz,
  visit_id uuid references public.visits (id),
  client_id uuid references public.clients (id),
  number text,                                   -- « D-2026-0001 », attribué à la finalisation
  status text not null default 'brouillon' check (status in ('brouillon', 'finalise', 'signe', 'refuse')),
  issued_on date,
  valid_until date,
  vat_regime text not null default 'franchise' check (vat_regime in ('franchise', 'assujetti')),
  vat_zone text not null default 'reunion' check (vat_zone in ('reunion', 'hexagone')),
  vat_rate_bp integer not null default 0 check (vat_rate_bp between 0 and 10000),
  company_snapshot text,                         -- coordonnées de l'entreprise figées (JSON)
  client_snapshot text,                          -- coordonnées du client figées (JSON)
  site_address text,
  subtotal_ht_cents integer not null default 0,
  vat_cents integer not null default 0,
  total_ttc_cents integer not null default 0,
  payment_terms text,
  deposit_bp integer not null default 0 check (deposit_bp between 0 and 10000),
  notes text,
  signed_at timestamptz,
  signer_name text,
  signature_photo_id uuid,
  signed_lat double precision,
  signed_lng double precision
);
create index quotes_company_idx on public.quotes (company_id, created_at);
create index quotes_visit_idx on public.quotes (visit_id);
create unique index quotes_number_uniq on public.quotes (company_id, number) where number is not null;

create table public.quote_lines (
  id uuid primary key,
  company_id uuid not null references public.companies (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),
  deleted_at timestamptz,
  quote_id uuid not null references public.quotes (id),
  position integer not null default 0,
  kind text not null check (kind in ('prestation', 'heures_sol', 'heures_grimpeur', 'evacuation', 'deplacement', 'location', 'libre')),
  tree_id uuid references public.trees (id),
  price_item_id uuid references public.price_items (id),
  label text not null,
  unit text,
  quantity double precision not null default 1 check (quantity >= 0),
  unit_price_ht_cents integer not null default 0 check (unit_price_ht_cents >= 0),
  retention smallint not null default 0 check (retention in (0, 1)),
  big_trunk smallint not null default 0 check (big_trunk in (0, 1)),
  urgent smallint not null default 0 check (urgent in (0, 1)),
  surcharge_bp integer not null default 0 check (surcharge_bp between 0 and 100000),
  total_ht_cents integer not null default 0,
  note text
);
create index quote_lines_quote_idx on public.quote_lines (quote_id, position);

-- Numérotation : un compteur par entreprise et par année. Les téléphones réservent des blocs
-- de numéros quand ils ont du réseau, pour pouvoir numéroter un devis hors-ligne.
create table public.quote_counters (
  company_id uuid not null references public.companies (id),
  year integer not null,
  last_number integer not null default 0,
  primary key (company_id, year)
);
alter table public.quote_counters enable row level security; -- aucun accès direct : seulement par la fonction ci-dessous

create or replace function public.reserve_quote_numbers(p_company uuid, p_year integer, p_count integer)
returns table (first_number integer, last_number integer)
language plpgsql security definer set search_path = public, private as $$
declare v_last integer;
begin
  if not private.can_edit_visits(p_company) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if p_count < 1 or p_count > 50 or p_year < 2020 or p_year > 2100 then
    raise exception 'Demande invalide' using errcode = '22023';
  end if;
  insert into quote_counters as c (company_id, year, last_number) values (p_company, p_year, p_count)
  on conflict (company_id, year) do update set last_number = c.last_number + p_count
  returning c.last_number into v_last;
  return query select v_last - p_count + 1, v_last;
end;
$$;
revoke all on function public.reserve_quote_numbers(uuid, integer, integer) from public, anon;
grant execute on function public.reserve_quote_numbers(uuid, integer, integer) to authenticated;

-- Protection : un devis finalisé ne change plus (montants, lignes, coordonnées).
-- Seuls restent possibles : passer à « signé » ou « refusé », avec les informations de signature.
create or replace function private.protect_final_quote()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.status = 'brouillon' then
    return new;
  end if;
  if (new.number, new.issued_on, new.valid_until, new.vat_regime, new.vat_zone, new.vat_rate_bp, new.company_snapshot,
      new.client_snapshot, new.site_address, new.subtotal_ht_cents, new.vat_cents, new.total_ttc_cents, new.payment_terms,
      new.deposit_bp, new.visit_id, new.client_id)
     is distinct from
     (old.number, old.issued_on, old.valid_until, old.vat_regime, old.vat_zone, old.vat_rate_bp, old.company_snapshot,
      old.client_snapshot, old.site_address, old.subtotal_ht_cents, old.vat_cents, old.total_ttc_cents, old.payment_terms,
      old.deposit_bp, old.visit_id, old.client_id) then
    raise exception 'Devis finalisé : il ne peut plus être modifié' using errcode = '23514';
  end if;
  if old.status in ('signe', 'refuse') and new.status is distinct from old.status then
    raise exception 'Décision du client déjà enregistrée' using errcode = '23514';
  end if;
  if old.status = 'finalise' and new.status not in ('finalise', 'signe', 'refuse') then
    raise exception 'Un devis finalisé ne redevient pas brouillon' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.protect_final_quote_lines()
returns trigger language plpgsql set search_path = public as $$
declare v_status text;
begin
  select status into v_status from quotes where id = coalesce(new.quote_id, old.quote_id);
  if v_status is distinct from 'brouillon' then
    raise exception 'Devis finalisé : ses lignes ne peuvent plus être modifiées' using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger quotes_final before update on public.quotes for each row execute function private.protect_final_quote();
create trigger quote_lines_final before insert or update or delete on public.quote_lines for each row execute function private.protect_final_quote_lines();

do $$
declare t text;
begin
  foreach t in array array['quotes', 'quote_lines'] loop
    execute format('create trigger %I_protect before update on public.%I for each row execute function private.protect_ownership()', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function private.touch_updated_at()', t, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I_select on public.%I for select to authenticated using (private.can_edit_visits(company_id))', t, t);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check (private.can_edit_visits(company_id) and created_by = auth.uid())', t, t);
    execute format('create policy %I_update on public.%I for update to authenticated using (private.can_edit_visits(company_id)) with check (private.can_edit_visits(company_id))', t, t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

alter publication powersync add table public.quotes, public.quote_lines;
do $$
declare r text;
begin
  for r in select rolname from pg_roles where rolname like 'powersync%' and rolreplication loop
    execute format('grant select on public.quotes, public.quote_lines to %I', r);
  end loop;
end $$;
