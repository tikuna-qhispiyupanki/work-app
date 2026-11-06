-- ============================================================================
-- Arboject – socle du serveur (étape 2c-1)
-- Entreprises, membres et rôles, carnet clients, visites, arbres, photos.
-- Règle d'or : chaque ligne appartient à une entreprise (company_id) et la base
-- elle-même refuse l'accès aux non-membres (RLS), quel que soit le code de l'application.
-- Postgres standard (portable), en dehors de auth.uid() fourni par Supabase.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Entreprises
-- ---------------------------------------------------------------------------
create table public.companies (
  id uuid primary key,
  name text not null,
  legal_form text,
  siret text,
  address text,
  postal_code text,
  city text,
  phone text,
  email text,
  logo_photo_id uuid,
  insurance_name text,
  insurance_policy text,
  insurance_area text,
  vat_regime text not null default 'franchise' check (vat_regime in ('franchise', 'assujetti')),
  default_vat_zone text not null default 'reunion' check (default_vat_zone in ('reunion', 'hexagone')),
  quote_validity_days integer not null default 30 check (quote_validity_days between 1 and 365),
  quote_payment_terms text default 'Paiement à réception, par virement, chèque ou espèces.',
  quote_deposit_bp integer not null default 0 check (quote_deposit_bp between 0 and 10000),
  formule text not null default 'pilote', -- abonnement : inutilisé en V1
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Profils (une ligne par personne) et appartenance aux entreprises
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('gerant', 'bureau', 'chef_equipe', 'technicien')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id) where active;

-- ---------------------------------------------------------------------------
-- Fonctions d'accès (utilisées par les règles RLS)
-- « security definer » : elles lisent memberships sans boucler sur ses propres règles.
-- ---------------------------------------------------------------------------
create function public.is_member(p_company uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.company_id = p_company and m.user_id = auth.uid() and m.active
  );
$$;

create function public.has_role(p_company uuid, p_roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.company_id = p_company and m.user_id = auth.uid() and m.active and m.role = any (p_roles)
  );
$$;

-- Rôles qui travaillent sur les visites, les clients et les devis.
-- Le technicien n'y a pas accès : il verra seulement ses chantiers (étape 5).
create function public.can_edit_visits(p_company uuid)
returns boolean language sql stable as $$
  select public.has_role(p_company, array['gerant', 'bureau', 'chef_equipe']);
$$;

-- Création d'une entreprise : l'entreprise et son premier membre (gérant) en une seule fois.
-- L'identifiant est fourni par le téléphone (création possible hors-ligne, envoyée plus tard).
create function public.create_company(p_id uuid, p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;
  insert into public.companies (id, name, created_by) values (p_id, p_name, auth.uid())
  on conflict (id) do nothing;
  insert into public.memberships (company_id, user_id, role)
  select p_id, auth.uid(), 'gerant'
  where exists (select 1 from public.companies c where c.id = p_id and c.created_by = auth.uid())
  on conflict (company_id, user_id) do nothing;
  return p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Données métier
-- Colonnes communes : id (UUID créé sur le téléphone), company_id, dates, auteur, suppression douce.
-- Les booléens sont des entiers 0/1, comme dans la base du téléphone (SQLite).
-- ---------------------------------------------------------------------------
create table public.clients (
  id uuid primary key,
  company_id uuid not null references public.companies (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),
  deleted_at timestamptz,
  kind text not null default 'particulier' check (kind in ('particulier', 'professionnel')),
  name text,
  phone text,
  email text,
  address text,
  postal_code text,
  city text,
  notes text
);
create index clients_company_idx on public.clients (company_id);

create table public.visits (
  id uuid primary key,
  company_id uuid not null references public.companies (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),
  deleted_at timestamptz,
  client_id uuid references public.clients (id),
  visited_at timestamptz not null default now(),
  site_address text,
  site_postal_code text,
  site_city text,
  site_lat double precision,
  site_lng double precision,
  site_accuracy_m integer,
  vat_zone text not null default 'reunion' check (vat_zone in ('reunion', 'hexagone')),
  access_notes text,
  notes text,
  dictation_text text,
  near_power_lines smallint not null default 0 check (near_power_lines in (0, 1)),
  status text not null default 'prevue' check (status in ('prevue', 'faite', 'brouillon'))
);
create index visits_company_idx on public.visits (company_id, visited_at);
create index visits_client_idx on public.visits (client_id);

create table public.trees (
  id uuid primary key,
  company_id uuid not null references public.companies (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),
  deleted_at timestamptz,
  visit_id uuid not null references public.visits (id),
  number integer not null check (number > 0),
  species text,
  lat double precision,
  lng double precision,
  notes text
);
create index trees_visit_idx on public.trees (visit_id);

create table public.photos (
  id uuid primary key,
  company_id uuid not null references public.companies (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),
  deleted_at timestamptz,
  owner_type text not null,
  owner_id uuid not null,
  kind text not null default 'photo' check (kind in ('photo', 'plan', 'croquis', 'signature')),
  mime_type text,
  width integer,
  height integer,
  bytes integer,
  storage_path text,
  taken_at timestamptz,
  lat double precision,
  lng double precision,
  caption text,
  include_in_report smallint not null default 1 check (include_in_report in (0, 1))
);
create index photos_owner_idx on public.photos (owner_type, owner_id);
create index photos_company_idx on public.photos (company_id);

-- Un enregistrement ne peut pas changer d'entreprise, et son auteur reste le même.
create function public.protect_ownership()
returns trigger language plpgsql as $$
begin
  if new.company_id is distinct from old.company_id then
    raise exception 'Une donnée ne peut pas changer d''entreprise';
  end if;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  return new;
end;
$$;

-- updated_at est fixé par le serveur à chaque modification.
create function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['clients', 'visits', 'trees', 'photos'] loop
    execute format('create trigger %I_protect before update on public.%I for each row execute function public.protect_ownership()', t, t);
  end loop;
  foreach t in array array['companies', 'profiles', 'memberships', 'clients', 'visits', 'trees', 'photos'] loop
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Règles d'accès (RLS)
-- ---------------------------------------------------------------------------
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.clients enable row level security;
alter table public.visits enable row level security;
alter table public.trees enable row level security;
alter table public.photos enable row level security;

-- Entreprises : les membres la voient, seul le gérant la modifie. Création uniquement par create_company().
create policy companies_select on public.companies for select to authenticated using (public.is_member(id));
create policy companies_update on public.companies for update to authenticated
  using (public.has_role(id, array['gerant'])) with check (public.has_role(id, array['gerant']));

-- Profils : chacun voit et modifie le sien, et voit ceux des personnes de ses entreprises.
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid()
  or exists (
    select 1 from public.memberships mine join public.memberships theirs on theirs.company_id = mine.company_id
    where mine.user_id = auth.uid() and mine.active and theirs.user_id = profiles.id
  )
);
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Membres : visibles par les membres de l'entreprise, gérés par le gérant.
create policy memberships_select on public.memberships for select to authenticated using (public.is_member(company_id));
create policy memberships_insert on public.memberships for insert to authenticated with check (public.has_role(company_id, array['gerant']));
create policy memberships_update on public.memberships for update to authenticated
  using (public.has_role(company_id, array['gerant'])) with check (public.has_role(company_id, array['gerant']));

-- Clients, visites, arbres, photos : gérant, bureau et chef d'équipe de l'entreprise.
-- Pas de suppression réelle : on renseigne deleted_at (suppression douce).
do $$
declare t text;
begin
  foreach t in array array['clients', 'visits', 'trees', 'photos'] loop
    execute format('create policy %I_select on public.%I for select to authenticated using (public.can_edit_visits(company_id))', t, t);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check (public.can_edit_visits(company_id) and created_by = auth.uid())', t, t);
    execute format('create policy %I_update on public.%I for update to authenticated using (public.can_edit_visits(company_id)) with check (public.can_edit_visits(company_id))', t, t);
  end loop;
end $$;

-- Les rôles anonymes n'ont accès à rien.
revoke all on public.companies, public.profiles, public.memberships, public.clients, public.visits, public.trees, public.photos from anon;
revoke execute on function public.create_company(uuid, text) from anon, public;
grant execute on function public.create_company(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Publication pour la synchronisation (PowerSync lit les changements de ces tables).
-- ---------------------------------------------------------------------------
create publication powersync for table
  public.companies, public.profiles, public.memberships, public.clients, public.visits, public.trees, public.photos;
