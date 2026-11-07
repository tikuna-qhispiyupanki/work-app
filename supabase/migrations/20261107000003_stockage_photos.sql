-- ============================================================================
-- Arboject – stockage des photos (étape 2d)
-- Espace privé « photos », un dossier par entreprise : {company_id}/{photo_id}.jpg
-- et la miniature {company_id}/{photo_id}_min.jpg.
-- Accès : seulement les membres de l'entreprise (gérant, bureau, chef d'équipe),
-- par liens signés temporaires. Photos uniquement ajoutées : ni modification, ni suppression.
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 10485760, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Identifiant d'entreprise lu dans le premier dossier du chemin (null si le chemin est invalide).
create or replace function private.company_of_path(p_name text)
returns uuid language sql immutable set search_path = public, storage as $$
  select case when (storage.foldername(p_name))[1] ~ '^[0-9a-f-]{36}$'
              then (storage.foldername(p_name))[1]::uuid end;
$$;
revoke all on function private.company_of_path(text) from public, anon;
grant execute on function private.company_of_path(text) to authenticated;

create policy photos_lire on storage.objects for select to authenticated
  using (bucket_id = 'photos' and private.can_edit_visits(private.company_of_path(name)));

create policy photos_ajouter on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and private.can_edit_visits(private.company_of_path(name)));
