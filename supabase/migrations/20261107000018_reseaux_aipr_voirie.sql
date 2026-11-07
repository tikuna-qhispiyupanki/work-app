-- ============================================================================
-- Arboject – réseaux et voirie (choix du fondateur, 07/11/2026)
-- 1. DT-DICT : suivi sur le chantier (statut, n° de déclaration, date d'envoi) ; récépissés joints en documents.
-- 2. AIPR : profil et fin de validité pour chaque personne de l'équipe (attestation de compétence 5 ans).
-- 3. Découverte fortuite d'un réseau : constat (type, description, mesures prises, exploitant prévenu, GPS).
--    Uniquement ajouté : jamais modifié.
-- 4. Demande d'arrêté de circulation / stationnement à la mairie : brouillon gardé sur le chantier (JSON).
-- ============================================================================
alter table public.jobs
  add column dt_dict_status text check (dt_dict_status is null or dt_dict_status in ('a_faire', 'envoyee', 'recepisses', 'non_concerne')),
  add column dt_dict_reference text,
  add column dt_dict_sent_on date,
  add column road_permit text check (road_permit is null or length(road_permit) <= 20000);

alter table public.team_members
  add column aipr_profile text check (aipr_profile is null or aipr_profile in ('operateur', 'encadrant', 'concepteur')),
  add column aipr_valid_until date;

alter table public.photos drop constraint photos_kind_check;
alter table public.photos add constraint photos_kind_check check (kind in ('photo', 'plan', 'croquis', 'signature', 'logo', 'document'));

create table public.network_findings (
  id uuid primary key,
  company_id uuid not null references public.companies (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),
  deleted_at timestamptz,
  job_id uuid not null references public.jobs (id),
  found_at timestamptz not null default now(),
  network_type text not null check (network_type in ('electricite', 'gaz', 'eau', 'assainissement', 'telecom', 'chauffage', 'autre', 'inconnu')),
  description text,
  damage text check (damage is null or damage in ('aucun', 'leger', 'important')),
  actions_taken text,
  operator_contacted text,
  reporter_name text,
  lat double precision,
  lng double precision
);
create index network_findings_job_idx on public.network_findings (job_id);
create trigger network_findings_protect before update on public.network_findings for each row execute function private.protect_ownership();
create trigger network_findings_touch before update on public.network_findings for each row execute function private.touch_updated_at();
create trigger network_findings_job before insert on public.network_findings for each row execute function private.check_job_child();
alter table public.network_findings enable row level security;
revoke all on public.network_findings from anon;
create policy network_findings_select on public.network_findings for select to authenticated using (private.can_edit_visits(company_id));
create policy network_findings_insert on public.network_findings for insert to authenticated with check (private.can_edit_visits(company_id) and created_by = auth.uid());

alter publication powersync add table public.network_findings;
do $$
declare r text;
begin
  for r in select rolname from pg_roles where rolname like 'powersync%' and rolreplication loop
    execute format('grant select on public.network_findings to %I', r);
  end loop;
end $$;
