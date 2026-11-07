-- ============================================================================
-- Arboject – signature du devis à distance (lien personnel envoyé au client)
-- Le téléphone crée une « demande de signature » avec un jeton secret (256 bits, aléatoire).
-- Le client ouvre le lien (page publique, sans compte) : il voit le devis et le signe ou le refuse.
-- Signature électronique « simple » (eIDAS) : preuve = nom, date et heure du serveur, adresse IP,
-- navigateur, empreinte SHA-256 du devis affiché, texte d'acceptation, image de la signature.
-- Le lien ne sert qu'une fois et expire (au plus 60 jours, et jamais après la validité du devis).
-- Le client n'a accès qu'à DEUX fonctions (lecture du devis, décision), jamais aux tables.
-- ============================================================================
create table public.quote_sign_requests (
  id uuid primary key,
  company_id uuid not null references public.companies (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),
  deleted_at timestamptz,
  quote_id uuid not null references public.quotes (id),
  token text not null check (length(token) >= 40 and token ~ '^[A-Za-z0-9_-]+$'),
  expires_at timestamptz not null,
  status text not null default 'envoye' check (status in ('envoye', 'ouvert', 'signe', 'refuse', 'annule')),
  opened_at timestamptz,
  decided_at timestamptz,
  signer_name text check (length(signer_name) <= 120),
  signer_ip text,
  signer_user_agent text,
  document_hash text,
  consent_text text,
  signature_data text check (length(signature_data) <= 400000), -- image JPEG en « data URL »
  refusal_reason text check (length(refusal_reason) <= 1000)
);
create unique index quote_sign_requests_token_uniq on public.quote_sign_requests (token);
create index quote_sign_requests_quote_idx on public.quote_sign_requests (quote_id);

-- Contenu du devis tel que le client le voit (et dont on calcule l'empreinte).
-- Les clés JSON sont triées par Postgres : même devis → même texte → même empreinte.
create function private.quote_document(p_quote uuid)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'number', q.number, 'issued_on', q.issued_on, 'valid_until', q.valid_until,
    'vat_regime', q.vat_regime, 'vat_zone', q.vat_zone, 'vat_rate_bp', q.vat_rate_bp,
    'company', coalesce(q.company_snapshot, '{}')::jsonb, 'client', coalesce(q.client_snapshot, '{}')::jsonb,
    'site_address', q.site_address, 'subtotal_ht_cents', q.subtotal_ht_cents, 'vat_cents', q.vat_cents,
    'total_ttc_cents', q.total_ttc_cents, 'payment_terms', q.payment_terms, 'deposit_bp', q.deposit_bp, 'notes', q.notes,
    'lines', (select coalesce(jsonb_agg(jsonb_build_object(
        'label', l.label, 'unit', l.unit, 'quantity', l.quantity, 'unit_price_ht_cents', l.unit_price_ht_cents,
        'surcharge_bp', l.surcharge_bp, 'total_ht_cents', l.total_ht_cents, 'offered', l.offered) order by l.position, l.created_at), '[]'::jsonb)
      from quote_lines l where l.quote_id = q.id and l.deleted_at is null))
  from quotes q where q.id = p_quote
$$;

create function private.document_hash(p_doc jsonb)
returns text language sql immutable as $$ select encode(sha256(convert_to(p_doc::text, 'UTF8')), 'hex') $$;

-- Un utilisateur de l'application peut créer une demande et l'annuler, rien d'autre :
-- l'ouverture, la signature et le refus ne passent que par les fonctions ci-dessous.
create function private.protect_sign_request()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new; -- fonctions du serveur (lien du client)
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'envoye' or new.opened_at is not null or new.decided_at is not null or new.signer_name is not null
       or new.signer_ip is not null or new.signer_user_agent is not null or new.document_hash is not null
       or new.consent_text is not null or new.signature_data is not null or new.refusal_reason is not null then
      raise exception 'Demande de signature invalide' using errcode = '42501';
    end if;
    if not exists (select 1 from quotes q where q.id = new.quote_id and q.company_id = new.company_id and q.status = 'finalise') then
      raise exception 'Seul un devis finalisé et pas encore signé peut être envoyé' using errcode = '23514';
    end if;
    if new.expires_at > now() + interval '61 days' then
      raise exception 'Durée du lien trop longue' using errcode = '23514';
    end if;
    return new;
  end if;
  if (new.quote_id, new.token, new.expires_at, new.opened_at, new.decided_at, new.signer_name, new.signer_ip, new.signer_user_agent,
      new.document_hash, new.consent_text, new.signature_data, new.refusal_reason)
     is distinct from
     (old.quote_id, old.token, old.expires_at, old.opened_at, old.decided_at, old.signer_name, old.signer_ip, old.signer_user_agent,
      old.document_hash, old.consent_text, old.signature_data, old.refusal_reason) then
    raise exception 'La réponse du client ne peut pas être modifiée' using errcode = '42501';
  end if;
  if new.status is distinct from old.status and not (new.status = 'annule' and old.status in ('envoye', 'ouvert')) then
    raise exception 'Seule l''annulation d''un lien pas encore utilisé est possible' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger quote_sign_requests_guard before insert or update on public.quote_sign_requests for each row execute function private.protect_sign_request();
create trigger quote_sign_requests_protect before update on public.quote_sign_requests for each row execute function private.protect_ownership();
create trigger quote_sign_requests_touch before update on public.quote_sign_requests for each row execute function private.touch_updated_at();
alter table public.quote_sign_requests enable row level security;
create policy quote_sign_requests_select on public.quote_sign_requests for select to authenticated using (private.can_edit_visits(company_id));
create policy quote_sign_requests_insert on public.quote_sign_requests for insert to authenticated with check (private.can_edit_visits(company_id) and created_by = auth.uid());
create policy quote_sign_requests_update on public.quote_sign_requests for update to authenticated using (private.can_edit_visits(company_id)) with check (private.can_edit_visits(company_id));
revoke all on public.quote_sign_requests from anon;

-- État du lien (pour la page du client).
create function private.sign_request_state(r public.quote_sign_requests, q public.quotes)
returns text language sql stable as $$
  select case
    when r.status in ('signe', 'refuse', 'annule') then r.status
    when q.status <> 'finalise' then 'indisponible'
    when r.expires_at <= now() then 'expire'
    else 'a_signer' end
$$;

-- 1. Le client ouvre le lien : le devis, l'état du lien et l'empreinte du document.
create function public.quote_for_signature(p_token text)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare r quote_sign_requests; q quotes; doc jsonb; st text;
begin
  select * into r from quote_sign_requests where token = p_token and deleted_at is null and length(p_token) >= 40;
  if not found then
    raise exception 'Lien inconnu' using errcode = 'P0002';
  end if;
  select * into q from quotes where id = r.quote_id;
  st := private.sign_request_state(r, q);
  if st = 'a_signer' and r.opened_at is null then
    update quote_sign_requests set opened_at = now(), status = 'ouvert' where id = r.id;
  end if;
  doc := private.quote_document(q.id);
  return jsonb_build_object('state', st, 'expires_at', r.expires_at, 'decided_at', r.decided_at, 'signer_name', r.signer_name,
    'document', doc, 'document_hash', private.document_hash(doc));
end;
$$;

-- 2. Le client signe (p_decision = 'signe') ou refuse ('refuse'). Une seule fois.
create function public.decide_quote_signature(p_token text, p_decision text, p_signer_name text, p_signature text,
  p_reason text, p_document_hash text, p_user_agent text)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare r quote_sign_requests; q quotes; doc jsonb; v_hash text; v_ip text; v_consent text; v_name text;
begin
  select * into r from quote_sign_requests where token = p_token and deleted_at is null and length(p_token) >= 40 for update;
  if not found then
    raise exception 'Lien inconnu' using errcode = 'P0002';
  end if;
  select * into q from quotes where id = r.quote_id for update;
  if private.sign_request_state(r, q) <> 'a_signer' then
    raise exception 'Ce lien n''est plus utilisable' using errcode = '23514';
  end if;
  doc := private.quote_document(q.id);
  v_hash := private.document_hash(doc);
  if p_document_hash is distinct from v_hash then
    raise exception 'Le devis a changé depuis son affichage : rechargez la page' using errcode = '23514';
  end if;
  v_name := nullif(btrim(coalesce(p_signer_name, '')), '');
  v_ip := nullif(btrim(split_part(coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1)), '');
  if p_decision = 'signe' then
    if v_name is null or length(v_name) < 2 or length(v_name) > 120 then
      raise exception 'Nom du signataire manquant' using errcode = '22023';
    end if;
    if p_signature is null or p_signature !~ '^data:image/(jpeg|png);base64,[A-Za-z0-9+/=]+$' or length(p_signature) > 400000 then
      raise exception 'Signature manquante' using errcode = '22023';
    end if;
    v_consent := format('Bon pour accord : j''accepte le devis %s du %s (%s), d''un montant de %s centimes, et ses conditions.',
      q.number, to_char(q.issued_on, 'DD/MM/YYYY'), coalesce((q.company_snapshot::jsonb) ->> 'name', ''), q.total_ttc_cents);
  elsif p_decision = 'refuse' then
    v_consent := format('Je refuse le devis %s.', q.number);
  else
    raise exception 'Décision inconnue' using errcode = '22023';
  end if;

  update quote_sign_requests set status = p_decision, decided_at = now(), signer_name = left(v_name, 120), signer_ip = v_ip,
    signer_user_agent = left(p_user_agent, 300), document_hash = v_hash, consent_text = v_consent,
    signature_data = case when p_decision = 'signe' then p_signature end,
    refusal_reason = case when p_decision = 'refuse' then left(nullif(btrim(coalesce(p_reason, '')), ''), 1000) end
  where id = r.id;
  update quote_sign_requests set status = 'annule' where quote_id = q.id and id <> r.id and status in ('envoye', 'ouvert');
  update quotes set status = p_decision, signed_at = now(), signer_name = left(v_name, 120), signed_lat = null, signed_lng = null
  where id = q.id;
  return jsonb_build_object('state', p_decision, 'decided_at', now());
end;
$$;

revoke all on function public.quote_for_signature(text) from public;
revoke all on function public.decide_quote_signature(text, text, text, text, text, text, text) from public;
grant execute on function public.quote_for_signature(text) to anon, authenticated;
grant execute on function public.decide_quote_signature(text, text, text, text, text, text, text) to anon, authenticated;
revoke all on function private.quote_document(uuid) from public;
revoke all on function private.document_hash(jsonb) from public;
revoke all on function private.sign_request_state(public.quote_sign_requests, public.quotes) from public;

alter publication powersync add table public.quote_sign_requests;
do $$
declare r text;
begin
  for r in select rolname from pg_roles where rolname like 'powersync%' and rolreplication loop
    execute format('grant select on public.quote_sign_requests to %I', r);
  end loop;
end $$;
