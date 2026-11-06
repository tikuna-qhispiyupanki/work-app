-- ============================================================================
-- Arboject – durcissement suite à l'audit de sécurité Supabase (étape 2c-1)
-- 1. Les fonctions internes des règles d'accès passent dans un schéma « private »,
--    non exposé par l'API : on ne peut plus les appeler de l'extérieur.
-- 2. Chemin de recherche figé sur toutes les fonctions (évite les détournements).
-- Seule create_company() reste appelable, par un utilisateur connecté (c'est voulu).
-- ============================================================================
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter function public.is_member(uuid) set schema private;
alter function public.has_role(uuid, text[]) set schema private;
alter function public.can_edit_visits(uuid) set schema private;
alter function public.protect_ownership() set schema private;
alter function public.touch_updated_at() set schema private;

-- can_edit_visits appelait has_role par son ancien nom : on la réécrit.
create or replace function private.can_edit_visits(p_company uuid)
returns boolean language sql stable set search_path = public, private as $$
  select private.has_role(p_company, array['gerant', 'bureau', 'chef_equipe']);
$$;

alter function private.protect_ownership() set search_path = public;
alter function private.touch_updated_at() set search_path = public;

revoke all on all functions in schema private from public, anon;
grant execute on function private.is_member(uuid), private.has_role(uuid, text[]), private.can_edit_visits(uuid) to authenticated;
revoke execute on function public.create_company(uuid, text) from public, anon;
