-- Arboject – signature à distance : une fois le devis signé, le client retrouve par son lien
-- sa signature et la preuve (pour télécharger son exemplaire signé en PDF).
create or replace function public.quote_for_signature(p_token text)
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
    'document', doc, 'document_hash', private.document_hash(doc),
    'signed_hash', r.document_hash, 'signer_ip', r.signer_ip,
    'signature_data', case when r.status = 'signe' then r.signature_data end);
end;
$$;
