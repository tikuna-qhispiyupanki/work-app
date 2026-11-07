#!/usr/bin/env bash
# Lance tous les tests de bout en bout sur le vrai projet Supabase, avec un compte de test
# temporaire créé au début et supprimé à la fin (même en cas d'échec).
# Prérequis : npm run build:web, puis npx serve -s dist -l 8081 dans un autre terminal.
set -u
REF=qtfhiehlhowbuweykyyu
UID_TEST=eeeeeeee-0000-4000-8000-00000000e2e0
export E2E_EMAIL=test-e2e@arboject.invalid
export E2E_PASSWORD="E2e-$(python3 -c 'import secrets;print(secrets.token_urlsafe(12))')"
cd "$(dirname "$0")/.."

sql() { python3 scripts/supabase-sql.py "$REF" -; }
cleanup() {
  # Fichiers photo du compte de test : supprimés par l'API de stockage (la base refuse la suppression directe).
  cos=$(echo "select coalesce(string_agg(company_id::text, ' '), '') as c from public.memberships where user_id = '$UID_TEST'" | sql | python3 -c "import sys,json; print(json.loads(sys.stdin.read().split(' ',1)[1])[0]['c'])")
  [ -n "$cos" ] && python3 scripts/cleanup-storage.py "$REF" $cos
  out=$(sql <<SQL
do \$\$ declare cids uuid[]; begin
  select array_agg(company_id) into cids from public.memberships where user_id = '$UID_TEST';
  -- Les devis finalisés sont protégés par des déclencheurs : on les suspend pour CE nettoyage seulement.
  set local session_replication_role = replica;
  -- Ordre : d'abord ce qui pointe vers autre chose (devis → photos → arbres → visites → clients → grille → entreprise).
  delete from public.quote_lines where company_id = any(cids);
  delete from public.quotes where company_id = any(cids);
  delete from public.quote_counters where company_id = any(cids);
  set local session_replication_role = origin; -- protections et suppressions en cascade rétablies
  delete from public.photos where company_id = any(cids);
  delete from public.trees where company_id = any(cids);
  delete from public.visits where company_id = any(cids);
  delete from public.clients where company_id = any(cids);
  delete from public.price_items where company_id = any(cids);
  delete from public.price_grids where company_id = any(cids);
  delete from public.memberships where company_id = any(cids);
  delete from public.companies where id = any(cids);
  delete from public.profiles where id = '$UID_TEST';
  delete from auth.refresh_tokens where user_id = '$UID_TEST';
  delete from auth.sessions where user_id = '$UID_TEST';
  delete from auth.identities where user_id = '$UID_TEST';
  delete from auth.users where id = '$UID_TEST';
end \$\$;
SQL
)
  case "$out" in 201*) ;; *) echo "⚠ NETTOYAGE ÉCHOUÉ : $out" ;; esac
  left=$(echo "select count(*) as n from auth.users where id = '$UID_TEST'" | sql)
  case "$left" in *'"n":0'*) echo "Compte de test supprimé." ;; *) echo "⚠ Le compte de test est toujours là : $left" ;; esac
}
trap cleanup EXIT
cleanup >/dev/null
sql <<SQL >/dev/null
do \$\$ begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', '$UID_TEST', 'authenticated', 'authenticated', '$E2E_EMAIL',
    extensions.crypt('$E2E_PASSWORD', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), '$UID_TEST', '$UID_TEST', json_build_object('sub', '$UID_TEST', 'email', '$E2E_EMAIL', 'email_verified', true), 'email', now(), now(), now());
end \$\$;
SQL
created=$(echo "select count(*) as n from auth.users where id = '$UID_TEST'" | sql)
case "$created" in *'"n":1'*) echo "Compte de test créé." ;; *) echo "⚠ Création du compte de test impossible : $created"; exit 1 ;; esac

status=0
if [ "${1:-}" = "--debug" ]; then shift; node "$@"; exit $?; fi
TESTS="${*:-auth offline-visit visit-geo-manage clients-trees clients-manage sync photos grid tree-sheet quote}"
for t in $TESTS; do
  echo "== $t"
  node "tests/$t.e2e.cjs" 2>&1 | grep -v "agent-proxy\|cdp.expo\|For details" || status=1
  [ "${PIPESTATUS[0]}" -eq 0 ] || status=1
done
exit $status
