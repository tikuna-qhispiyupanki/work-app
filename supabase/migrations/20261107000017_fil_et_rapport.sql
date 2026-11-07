-- ============================================================================
-- Arboject – étape 6 : fil du chantier et rapport client
-- photos.stage : avant / pendant / après (photos de chantier, owner_type = 'job').
-- job_notes : notes du fil du chantier (texte ; la dictée passe par le micro du clavier). Uniquement ajoutées.
-- job_reports : rapport de fin de chantier (un par chantier, même identifiant que le chantier) :
--   travaux réalisés, remarques, conseils d'entretien, réception signée par le client (au doigt).
--   Une fois signé par le client, il ne change plus.
-- report_links : lien privé envoyé au client pour voir le rapport en ligne (jeton secret, expire).
--   Les photos sont servies par des liens signés créés par le téléphone de l'entreprise (valables 30 jours).
--   Le client n'a accès qu'à UNE fonction : report_for_client(jeton).
-- ============================================================================
alter table public.photos add column stage text check (stage is null or stage in ('avant', 'pendant', 'apres'));

create table public.job_notes (
  id uuid primary key,
  company_id uuid not null references public.companies (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),
  deleted_at timestamptz,
  job_id uuid not null references public.jobs (id),
  author_name text,
  body text not null check (length(btrim(body)) between 1 and 5000)
);
create index job_notes_job_idx on public.job_notes (job_id, created_at);

create table public.job_reports (
  id uuid primary key,
  company_id uuid not null references public.companies (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),
  deleted_at timestamptz,
  job_id uuid not null references public.jobs (id),
  status text not null default 'brouillon' check (status in ('brouillon', 'signe')),
  works_done text,
  remarks text,
  advice text,
  finished_on date,
  client_signer_name text,
  client_signed_at timestamptz,
  client_signature_photo_id uuid,
  client_reserves text
);
create unique index job_reports_job_uniq on public.job_reports (job_id);

create table public.report_links (
  id uuid primary key,
  company_id uuid not null references public.companies (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),
  deleted_at timestamptz,
  job_id uuid not null references public.jobs (id),
  token text not null check (length(token) >= 40 and token ~ '^[A-Za-z0-9_-]+$'),
  expires_at timestamptz not null,
  photos jsonb not null default '[]'::jsonb, -- [{ "url": lien signé, "stage": "avant", "caption": "…" }]
  opened_at timestamptz
);
create unique index report_links_token_uniq on public.report_links (token);

do $$
declare t text;
begin
  foreach t in array array['job_notes', 'job_reports', 'report_links'] loop
    execute format('create trigger %I_protect before update on public.%I for each row execute function private.protect_ownership()', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function private.touch_updated_at()', t, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('create policy %I_select on public.%I for select to authenticated using (private.can_edit_visits(company_id))', t, t);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check (private.can_edit_visits(company_id) and created_by = auth.uid())', t, t);
  end loop;
  -- Les notes sont uniquement ajoutées : pas de modification.
  foreach t in array array['job_reports', 'report_links'] loop
    execute format('create policy %I_update on public.%I for update to authenticated using (private.can_edit_visits(company_id)) with check (private.can_edit_visits(company_id))', t, t);
  end loop;
end $$;

-- Rattachement au chantier de la même entreprise.
create function private.check_job_child()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from jobs where id = new.job_id and company_id = new.company_id) then
    raise exception 'Chantier d''une autre entreprise' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.check_job_child() from public, anon;
create trigger job_notes_job before insert on public.job_notes for each row execute function private.check_job_child();
create trigger job_reports_job before insert or update on public.job_reports for each row execute function private.check_job_child();
create trigger report_links_job before insert or update on public.report_links for each row execute function private.check_job_child();

-- Rapport signé par le client = figé (renvoi identique de la synchronisation accepté).
create function private.protect_signed_report()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.status = 'brouillon' then
    if new.status = 'signe' and (new.client_signed_at is null or new.client_signer_name is null) then
      raise exception 'Réception sans nom ni date' using errcode = '23514';
    end if;
    return new;
  end if;
  if to_jsonb(new) - 'updated_at' = to_jsonb(old) - 'updated_at' then
    return new;
  end if;
  raise exception 'Rapport signé par le client : il ne peut plus être modifié' using errcode = '23514';
end;
$$;
revoke all on function private.protect_signed_report() from public, anon;
create trigger job_reports_signed before update on public.job_reports for each row execute function private.protect_signed_report();

-- Lien : on ne change ni le jeton, ni le chantier, ni la date d'ouverture (écrite par le serveur).
create function private.protect_report_link()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      if new.opened_at is not null or new.expires_at > now() + interval '61 days' then
        raise exception 'Lien de rapport invalide' using errcode = '23514';
      end if;
    elsif (new.token, new.job_id, new.opened_at) is distinct from (old.token, old.job_id, old.opened_at) then
      raise exception 'Lien de rapport non modifiable' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.protect_report_link() from public, anon;
create trigger report_links_guard before insert or update on public.report_links for each row execute function private.protect_report_link();

-- Le client ouvre le lien : le rapport, les travaux du devis, l'entreprise, les photos.
create function public.report_for_client(p_token text)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare l report_links; j jobs; r job_reports; c companies; q quotes;
begin
  select * into l from report_links where token = p_token and deleted_at is null and length(p_token) >= 40;
  if not found then
    raise exception 'Lien inconnu' using errcode = 'P0002';
  end if;
  if l.expires_at <= now() then
    return jsonb_build_object('state', 'expire', 'expires_at', l.expires_at);
  end if;
  select * into j from jobs where id = l.job_id;
  select * into r from job_reports where job_id = l.job_id and deleted_at is null;
  select * into c from companies where id = l.company_id;
  select * into q from quotes where id = j.quote_id;
  if l.opened_at is null then
    update report_links set opened_at = now() where id = l.id;
  end if;
  return jsonb_build_object(
    'state', 'ok',
    'expires_at', l.expires_at,
    'company', jsonb_build_object('name', c.name, 'address', c.address, 'postal_code', c.postal_code, 'city', c.city, 'phone', c.phone, 'email', c.email, 'siret', c.siret),
    'job', jsonb_build_object('title', j.title, 'site_address', j.site_address, 'planned_start', j.planned_start, 'planned_end', j.planned_end),
    'client', coalesce(q.client_snapshot, '{}')::jsonb,
    'quote_number', q.number,
    'report', case when r.id is null then null else jsonb_build_object(
      'works_done', r.works_done, 'remarks', r.remarks, 'advice', r.advice, 'finished_on', r.finished_on, 'status', r.status,
      'client_signer_name', r.client_signer_name, 'client_signed_at', r.client_signed_at, 'client_reserves', r.client_reserves) end,
    'photos', l.photos);
end;
$$;
revoke all on function public.report_for_client(text) from public;
grant execute on function public.report_for_client(text) to anon, authenticated;

alter publication powersync add table public.job_notes, public.job_reports, public.report_links;
do $$
declare r text;
begin
  for r in select rolname from pg_roles where rolname like 'powersync%' and rolreplication loop
    execute format('grant select on public.job_notes, public.job_reports, public.report_links to %I', r);
  end loop;
end $$;
