-- ============================================================================
-- Arboject – chantiers (5b) et fiches d'intervention (5c)
-- jobs : un chantier par devis signé, avec le MÊME identifiant que le devis. Le téléphone le crée
--   quand le client signe sur place (sans réseau) ; le serveur le crée quand le client signe par le lien.
--   S'il existe déjà, rien ne se passe (pas de doublon).
-- job_members : l'équipe du chantier (personnes de « Mon équipe »), recopiée de l'équipe prévue sur le devis.
-- intervention_sheets : fiche d'intervention élagage / abattage (décret 2021-1833). Une fois signée
--   par le chef d'entreprise, elle ne change plus (pour corriger : nouvelle version). Gardée 2 ans.
-- intervention_sheet_acks : chaque intervenant atteste qu'on lui a présenté la fiche (signature).
--   Uniquement ajoutées : jamais modifiées ni supprimées.
-- ============================================================================
create table public.jobs (
  id uuid primary key,
  company_id uuid not null references public.companies (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),
  deleted_at timestamptz,
  quote_id uuid references public.quotes (id),
  visit_id uuid references public.visits (id),
  client_id uuid references public.clients (id),
  title text,
  site_address text,
  site_lat double precision,
  site_lng double precision,
  status text not null default 'a_planifier' check (status in ('a_planifier', 'planifie', 'en_cours', 'termine', 'annule')),
  planned_start date,
  planned_end date,
  near_power_lines smallint not null default 0 check (near_power_lines in (0, 1)),
  dt_dict_done_on date,
  notes text
);
create unique index jobs_quote_uniq on public.jobs (quote_id) where quote_id is not null;
create index jobs_company_idx on public.jobs (company_id, planned_start);

create table public.job_members (
  id uuid primary key,
  company_id uuid not null references public.companies (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),
  deleted_at timestamptz,
  job_id uuid not null references public.jobs (id),
  member_id uuid not null references public.team_members (id),
  role_on_job text not null default 'equipier' check (role_on_job in ('chef', 'equipier', 'sauveteur'))
);
create index job_members_job_idx on public.job_members (job_id);

create table public.intervention_sheets (
  id uuid primary key,
  company_id uuid not null references public.companies (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),
  deleted_at timestamptz,
  job_id uuid not null references public.jobs (id),
  version integer not null default 1 check (version >= 1),
  status text not null default 'brouillon' check (status in ('brouillon', 'signee', 'remplacee')),
  location text,                 -- 1° emplacement
  works text,                    -- 1° travaux
  equipment text,                -- 1° équipements (JSON : liste + texte libre)
  start_date date,               -- 1° date de début
  end_date date,                 -- 1° date de fin
  sketch_photo_id uuid,          -- 2° croquis (accès, circulation, végétaux à traiter)
  risks text,                    -- 3° risques (JSON : cases cochées + texte libre)
  prevention text,               -- 4° mesures de prévention
  accident_procedure text,       -- 5° conduite à tenir en cas d'accident
  rescue text,                   -- 6° organisation des secours
  emergency_contacts text,       -- numéros utiles, hôpital le plus proche, point de rendez-vous des secours
  signer_name text,
  signed_at timestamptz,
  signature_photo_id uuid,
  retain_until date              -- signature + 2 ans
);
create index intervention_sheets_job_idx on public.intervention_sheets (job_id, version);

create table public.intervention_sheet_acks (
  id uuid primary key,
  company_id uuid not null references public.companies (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),
  deleted_at timestamptz,
  sheet_id uuid not null references public.intervention_sheets (id),
  member_id uuid references public.team_members (id),
  name text not null check (length(btrim(name)) between 1 and 120),
  acknowledged_at timestamptz not null default now(),
  signature_photo_id uuid
);
create index intervention_sheet_acks_sheet_idx on public.intervention_sheet_acks (sheet_id);

do $$
declare t text;
begin
  foreach t in array array['jobs', 'job_members', 'intervention_sheets', 'intervention_sheet_acks'] loop
    execute format('create trigger %I_protect before update on public.%I for each row execute function private.protect_ownership()', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function private.touch_updated_at()', t, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('create policy %I_select on public.%I for select to authenticated using (private.can_edit_visits(company_id))', t, t);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check (private.can_edit_visits(company_id) and created_by = auth.uid())', t, t);
  end loop;
  -- Les attestations sont uniquement ajoutées : aucune modification.
  foreach t in array array['jobs', 'job_members', 'intervention_sheets'] loop
    execute format('create policy %I_update on public.%I for update to authenticated using (private.can_edit_visits(company_id)) with check (private.can_edit_visits(company_id))', t, t);
  end loop;
end $$;

-- Cohérence : tout ce qui est rattaché doit appartenir à la même entreprise.
create function private.check_job_links()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_table_name = 'jobs' then
    if new.quote_id is not null and not exists (select 1 from quotes where id = new.quote_id and company_id = new.company_id) then
      raise exception 'Devis d''une autre entreprise' using errcode = '42501';
    end if;
  elsif tg_table_name = 'job_members' then
    if not exists (select 1 from jobs where id = new.job_id and company_id = new.company_id)
       or not exists (select 1 from team_members where id = new.member_id and company_id = new.company_id) then
      raise exception 'Chantier ou équipier d''une autre entreprise' using errcode = '42501';
    end if;
  elsif tg_table_name = 'intervention_sheets' then
    if not exists (select 1 from jobs where id = new.job_id and company_id = new.company_id) then
      raise exception 'Chantier d''une autre entreprise' using errcode = '42501';
    end if;
  elsif tg_table_name = 'intervention_sheet_acks' then
    if not exists (select 1 from intervention_sheets where id = new.sheet_id and company_id = new.company_id and status = 'signee') then
      raise exception 'La fiche doit être signée par le chef d''entreprise avant d''être présentée' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger jobs_links before insert or update on public.jobs for each row execute function private.check_job_links();
create trigger job_members_links before insert or update on public.job_members for each row execute function private.check_job_links();
create trigger intervention_sheets_links before insert on public.intervention_sheets for each row execute function private.check_job_links();
create trigger intervention_sheet_acks_links before insert on public.intervention_sheet_acks for each row execute function private.check_job_links();

-- Fiche signée = figée. Seul changement permis ensuite : « remplacee » quand une nouvelle version est signée.
create function private.protect_signed_sheet()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.status = 'brouillon' then
    if new.status = 'signee' and (new.signed_at is null or new.signer_name is null or new.retain_until is null) then
      raise exception 'Fiche signée sans nom, date ou durée de conservation' using errcode = '23514';
    end if;
    return new;
  end if;
  if old.status = 'signee' and new.status = 'remplacee'
     and (to_jsonb(new) - 'status' - 'updated_at') = (to_jsonb(old) - 'status' - 'updated_at') then
    return new;
  end if;
  if old.status = 'signee' and to_jsonb(new) - 'updated_at' = to_jsonb(old) - 'updated_at' then
    return new; -- renvoi identique (synchronisation)
  end if;
  raise exception 'Fiche d''intervention signée : elle ne peut plus être modifiée (créez une nouvelle version)' using errcode = '23514';
end;
$$;
create trigger intervention_sheets_signed before update on public.intervention_sheets for each row execute function private.protect_signed_sheet();

-- Conservation : une fiche signée ne peut pas être supprimée (même « en douceur ») avant 2 ans.
create function private.protect_sheet_retention()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.status <> 'brouillon' and old.retain_until >= current_date then
    raise exception 'Fiche à conserver jusqu''au %', to_char(old.retain_until, 'DD/MM/YYYY') using errcode = '23514';
  end if;
  return old;
end;
$$;
create trigger intervention_sheets_retention before delete on public.intervention_sheets for each row execute function private.protect_sheet_retention();

-- Chantier créé quand le devis passe à « signé » (par le lien du client, ou au retour du réseau).
-- Même identifiant que le devis : si le téléphone l'a déjà créé, rien ne se passe.
create function private.create_job_on_signature()
returns trigger language plpgsql security definer set search_path = public as $$
declare v visits;
begin
  if new.status = 'signe' and old.status is distinct from 'signe' then
    select * into v from visits where id = new.visit_id;
    insert into jobs (id, company_id, created_by, quote_id, visit_id, client_id, title, site_address, site_lat, site_lng, near_power_lines)
    values (new.id, new.company_id, null, new.id, new.visit_id, new.client_id,
      coalesce((new.client_snapshot::jsonb) ->> 'name', 'Chantier') || ' – ' || coalesce(new.number, ''),
      new.site_address, v.site_lat, v.site_lng, coalesce(v.near_power_lines, 0))
    on conflict (id) do nothing;
    insert into job_members (id, company_id, created_by, job_id, member_id)
    select gen_random_uuid(), c.company_id, null, new.id, c.member_id from quote_crew c
    where c.quote_id = new.id and c.deleted_at is null
      and not exists (select 1 from job_members j where j.job_id = new.id and j.member_id = c.member_id);
  end if;
  return new;
end;
$$;
revoke all on function private.create_job_on_signature() from public, anon, authenticated;
create trigger quotes_create_job after update on public.quotes for each row execute function private.create_job_on_signature();

revoke all on function private.check_job_links() from public, anon;
revoke all on function private.protect_signed_sheet() from public, anon;
revoke all on function private.protect_sheet_retention() from public, anon;

alter publication powersync add table public.jobs, public.job_members, public.intervention_sheets, public.intervention_sheet_acks;
do $$
declare r text;
begin
  for r in select rolname from pg_roles where rolname like 'powersync%' and rolreplication loop
    execute format('grant select on public.jobs, public.job_members, public.intervention_sheets, public.intervention_sheet_acks to %I', r);
  end loop;
end $$;
