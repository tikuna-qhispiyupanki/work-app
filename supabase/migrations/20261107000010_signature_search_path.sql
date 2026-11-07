-- Arboject – audit de sécurité : chemin de recherche fixe pour les fonctions internes de la signature à distance.
alter function private.document_hash(jsonb) set search_path = pg_catalog, public;
alter function private.sign_request_state(public.quote_sign_requests, public.quotes) set search_path = pg_catalog, public;
