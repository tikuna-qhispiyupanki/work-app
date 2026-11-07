-- ============================================================================
-- Arboject – « Mon équipe » et coûts internes (étape 5a)
-- team_members : les personnes de l'entreprise (nom, métier). Vues par tous les membres de l'entreprise
--   (elles serviront à l'équipe du chantier et aux signatures de la fiche d'intervention).
--   `user_id` sera rempli quand l'équipier aura son propre compte (invitation, plus tard).
-- team_member_costs : le coût horaire de chacun (salaire chargé…). Donnée sensible :
--   visible et modifiable SEULEMENT par le gérant et le bureau. Jamais montré au client.
-- quote_crew : qui est prévu sur un devis et combien d'heures, pour calculer la marge.
--   Interne : n'entre ni dans le prix, ni dans le PDF, ni dans la page de signature du client.
-- ============================================================================
create table public.team_members (
  id uuid primary key,
  company_id uuid not null references public.companies (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),
  deleted_at timestamptz,
  name text not null check (length(btrim(name)) between 1 and 120),
  trade text not null default 'grimpeur' check (trade in ('grimpeur', 'sol', 'polyvalent', 'autre')),
  phone text,
  user_id uuid references auth.users (id),
  active smallint not null default 1 check (active in (0, 1)),
  notes text
);
create index team_members_company_idx on public.team_members (company_id);

create table public.team_member_costs (
  id uuid primary key,
  company_id uuid not null references public.companies (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),
  deleted_at timestamptz,
  member_id uuid not null references public.team_members (id),
  hourly_cost_cents integer not null default 0 check (hourly_cost_cents between 0 and 100000)
);
create unique index team_member_costs_member_uniq on public.team_member_costs (member_id);

create table public.quote_crew (
  id uuid primary key,
  company_id uuid not null references public.companies (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),
  deleted_at timestamptz,
  quote_id uuid not null references public.quotes (id),
  member_id uuid not null references public.team_members (id),
  hours double precision not null default 0 check (hours >= 0 and hours <= 1000)
);
create index quote_crew_quote_idx on public.quote_crew (quote_id);

do $$
declare t text;
begin
  foreach t in array array['team_members', 'team_member_costs', 'quote_crew'] loop
    execute format('create trigger %I_protect before update on public.%I for each row execute function private.protect_ownership()', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function private.touch_updated_at()', t, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- Équipe : lecture par tout membre de l'entreprise ; écriture gérant et bureau.
create policy team_members_select on public.team_members for select to authenticated using (private.is_member(company_id));
create policy team_members_insert on public.team_members for insert to authenticated
  with check (private.has_role(company_id, array['gerant', 'bureau']) and created_by = auth.uid());
create policy team_members_update on public.team_members for update to authenticated
  using (private.has_role(company_id, array['gerant', 'bureau'])) with check (private.has_role(company_id, array['gerant', 'bureau']));

-- Coûts : gérant et bureau uniquement, en lecture comme en écriture.
create policy team_member_costs_select on public.team_member_costs for select to authenticated using (private.has_role(company_id, array['gerant', 'bureau']));
create policy team_member_costs_insert on public.team_member_costs for insert to authenticated
  with check (private.has_role(company_id, array['gerant', 'bureau']) and created_by = auth.uid());
create policy team_member_costs_update on public.team_member_costs for update to authenticated
  using (private.has_role(company_id, array['gerant', 'bureau'])) with check (private.has_role(company_id, array['gerant', 'bureau']));

-- Équipe prévue sur un devis : mêmes droits que les devis.
create policy quote_crew_select on public.quote_crew for select to authenticated using (private.can_edit_visits(company_id));
create policy quote_crew_insert on public.quote_crew for insert to authenticated with check (private.can_edit_visits(company_id) and created_by = auth.uid());
create policy quote_crew_update on public.quote_crew for update to authenticated using (private.can_edit_visits(company_id)) with check (private.can_edit_visits(company_id));

-- Un coût ou une ligne d'équipe doit viser une personne de la même entreprise.
create function private.check_member_company()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from team_members m where m.id = new.member_id and m.company_id = new.company_id) then
    raise exception 'Équipier d''une autre entreprise' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.check_member_company() from public, anon;
create trigger team_member_costs_member before insert or update on public.team_member_costs for each row execute function private.check_member_company();
create trigger quote_crew_member before insert or update on public.quote_crew for each row execute function private.check_member_company();

alter publication powersync add table public.team_members, public.team_member_costs, public.quote_crew;
do $$
declare r text;
begin
  for r in select rolname from pg_roles where rolname like 'powersync%' and rolreplication loop
    execute format('grant select on public.team_members, public.team_member_costs, public.quote_crew to %I', r);
  end loop;
end $$;
