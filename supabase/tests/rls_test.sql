-- Test des règles d'accès (RLS). Tout se passe dans une transaction annulée à la fin
-- (exception volontaire) : aucune trace dans la base. Les résultats sont dans le message final.
do $$
declare
  ua uuid := 'aaaaaaaa-0000-4000-8000-000000000001'; -- gérant de l'entreprise A
  ub uuid := 'bbbbbbbb-0000-4000-8000-000000000002'; -- gérant de l'entreprise B
  ut uuid := 'cccccccc-0000-4000-8000-000000000003'; -- technicien de l'entreprise A
  ca uuid := 'aaaaaaaa-1111-4000-8000-00000000000a';
  cb uuid := 'bbbbbbbb-1111-4000-8000-00000000000b';
  cli_a uuid := 'aaaaaaaa-2222-4000-8000-00000000000a';
  cli_b uuid := 'bbbbbbbb-2222-4000-8000-00000000000b';
  results text := '';
  n int;
  ok boolean;
begin
  insert into auth.users (id, email, aud, role) values
    (ua, 'test-a@arboject.invalid', 'authenticated', 'authenticated'),
    (ub, 'test-b@arboject.invalid', 'authenticated', 'authenticated'),
    (ut, 'test-t@arboject.invalid', 'authenticated', 'authenticated');

  -- Gérant A crée son entreprise et un client
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.create_company(ca, 'Élagage A');
  insert into public.clients (id, company_id, name) values (cli_a, ca, 'Client de A');
  insert into public.memberships (company_id, user_id, role) values (ca, ut, 'technicien');
  execute 'reset role';

  -- Gérant B crée son entreprise et un client
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.create_company(cb, 'Élagage B');
  insert into public.clients (id, company_id, name) values (cli_b, cb, 'Client de B');

  -- 1. B ne voit que son client
  select count(*) into n from public.clients;
  results := results || format(E'\n1. B voit %s client(s) (attendu 1) : %s', n, case when n = 1 then 'OK' else 'ÉCHEC' end);
  -- 2. B ne voit pas l'entreprise A
  select count(*) into n from public.companies where id = ca;
  results := results || format(E'\n2. B voit l''entreprise A : %s', case when n = 0 then 'non → OK' else 'oui → ÉCHEC' end);
  -- 3. B ne peut pas créer de client dans A
  begin
    insert into public.clients (id, company_id, name) values (gen_random_uuid(), ca, 'Intrus');
    ok := false;
  exception when others then ok := true;
  end;
  results := results || format(E'\n3. B crée un client chez A : %s', case when ok then 'refusé → OK' else 'accepté → ÉCHEC' end);
  -- 4. B ne peut pas modifier le client de A (la ligne est invisible : 0 ligne modifiée)
  update public.clients set name = 'Piraté' where id = cli_a;
  get diagnostics n = row_count;
  results := results || format(E'\n4. B modifie le client de A : %s ligne(s) (attendu 0) : %s', n, case when n = 0 then 'OK' else 'ÉCHEC' end);
  -- 5. B ne peut pas s'ajouter comme membre de A
  begin
    insert into public.memberships (company_id, user_id, role) values (ca, ub, 'gerant');
    ok := false;
  exception when others then ok := true;
  end;
  results := results || format(E'\n5. B s''ajoute gérant de A : %s', case when ok then 'refusé → OK' else 'accepté → ÉCHEC' end);
  -- 6. B ne peut pas « reprendre » l'entreprise A en rappelant create_company avec son identifiant
  perform public.create_company(ca, 'Vol');
  execute 'reset role';
  select count(*) into n from public.memberships where company_id = ca and user_id = ub;
  results := results || format(E'\n6. B rappelle create_company sur A : %s', case when n = 0 then 'sans effet → OK' else 'membre → ÉCHEC' end);

  -- 7. A voit son client, et peut créer une visite et un arbre
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.clients;
  insert into public.visits (id, company_id, client_id) values ('aaaaaaaa-3333-4000-8000-00000000000a', ca, cli_a);
  insert into public.trees (id, company_id, visit_id, number, species) values (gen_random_uuid(), ca, 'aaaaaaaa-3333-4000-8000-00000000000a', 1, 'Manguier');
  results := results || format(E'\n7. A voit %s client(s) (attendu 1) et crée visite + arbre : %s', n, case when n = 1 then 'OK' else 'ÉCHEC' end);
  -- 8. A ne peut pas déplacer son client vers l'entreprise B
  begin
    update public.clients set company_id = cb where id = cli_a;
    ok := false;
  exception when others then ok := true;
  end;
  results := results || format(E'\n8. A déplace son client chez B : %s', case when ok then 'refusé → OK' else 'accepté → ÉCHEC' end);
  -- 9. A ne peut pas se faire passer pour un autre auteur
  begin
    insert into public.clients (id, company_id, name, created_by) values (gen_random_uuid(), ca, 'Faux auteur', ub);
    ok := false;
  exception when others then ok := true;
  end;
  results := results || format(E'\n9. A crée un client au nom de B : %s', case when ok then 'refusé → OK' else 'accepté → ÉCHEC' end);
  execute 'reset role';

  -- 10. Le technicien de A ne voit ni clients ni visites (seulement ses chantiers, plus tard)
  perform set_config('request.jwt.claims', json_build_object('sub', ut, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.clients;
  select n + count(*) into n from public.visits;
  results := results || format(E'\n10. Technicien de A voit %s client(s)/visite(s) (attendu 0) : %s', n, case when n = 0 then 'OK' else 'ÉCHEC' end);
  select count(*) into n from public.companies;
  results := results || format(E'\n11. Technicien de A voit son entreprise : %s', case when n = 1 then 'OK' else 'ÉCHEC' end);
  execute 'reset role';

  -- 13-16. Stockage des photos : chacun dans le dossier de son entreprise
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into storage.objects (bucket_id, name) values ('photos', ca || '/photo-a.jpg');
  begin
    insert into storage.objects (bucket_id, name) values ('photos', cb || '/intrus.jpg');
    ok := false;
  exception when others then ok := true;
  end;
  results := results || format(E'\n13. A dépose une photo chez B : %s', case when ok then 'refusé → OK' else 'accepté → ÉCHEC' end);
  begin
    insert into storage.objects (bucket_id, name) values ('photos', 'pas-un-dossier/x.jpg');
    ok := false;
  exception when others then ok := true;
  end;
  results := results || format(E'\n14. A dépose une photo hors dossier d''entreprise : %s', case when ok then 'refusé → OK' else 'accepté → ÉCHEC' end);
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from storage.objects where bucket_id = 'photos';
  results := results || format(E'\n15. B voit %s photo(s) de A (attendu 0) : %s', n, case when n = 0 then 'OK' else 'ÉCHEC' end);
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', ut, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from storage.objects where bucket_id = 'photos';
  results := results || format(E'\n16. Technicien de A voit %s photo(s) (attendu 0, pas encore de chantier) : %s', n, case when n = 0 then 'OK' else 'ÉCHEC' end);
  execute 'reset role';

  -- 17-19. Grille de prix : le gérant écrit, le chef d'équipe lit seulement, l'autre entreprise ne voit rien
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.price_grids (id, company_id, name) values ('aaaaaaaa-4444-4000-8000-00000000000a', ca, 'Grille A');
  insert into public.price_items (id, company_id, grid_id, label, suggested_price_cents) values (gen_random_uuid(), ca, 'aaaaaaaa-4444-4000-8000-00000000000a', 'Élagage', 31300);
  insert into public.memberships (company_id, user_id, role) values (ca, ub, 'chef_equipe');
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.price_items where company_id = ca;
  begin
    update public.price_items set my_price_cents = 1 where company_id = ca;
    get diagnostics ok = row_count;
  exception when others then ok := false;
  end;
  results := results || format(E'\n17. Chef d''équipe de A lit la grille (%s ligne) : %s', n, case when n = 1 then 'OK' else 'ÉCHEC' end);
  results := results || format(E'\n18. Chef d''équipe de A modifie un prix : %s', case when not ok then 'refusé → OK' else 'accepté → ÉCHEC' end);
  execute 'reset role';
  delete from public.memberships where company_id = ca and user_id = ub;
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.price_grids where company_id = ca;
  results := results || format(E'\n19. B (autre entreprise) voit %s grille de A (attendu 0) : %s', n, case when n = 0 then 'OK' else 'ÉCHEC' end);
  execute 'reset role';

  -- 20-25. Devis : numérotation, verrouillage après finalisation, isolement
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select first_number into n from public.reserve_quote_numbers(ca, 2026, 10);
  results := results || format(E'\n20. A réserve 10 numéros de devis : premier n° %s : %s', n, case when n = 1 then 'OK' else 'ÉCHEC' end);
  select first_number into n from public.reserve_quote_numbers(ca, 2026, 5);
  results := results || format(E'\n21. Réservation suivante : premier n° %s (attendu 11, pas de doublon) : %s', n, case when n = 11 then 'OK' else 'ÉCHEC' end);
  insert into public.quotes (id, company_id, client_id) values ('aaaaaaaa-5555-4000-8000-00000000000a', ca, cli_a);
  insert into public.quote_lines (id, company_id, quote_id, kind, label, total_ht_cents) values (gen_random_uuid(), ca, 'aaaaaaaa-5555-4000-8000-00000000000a', 'libre', 'Ligne', 1000);
  update public.quotes set status = 'finalise', number = 'D-2026-0001', subtotal_ht_cents = 1000 where id = 'aaaaaaaa-5555-4000-8000-00000000000a';
  begin
    update public.quotes set subtotal_ht_cents = 1 where id = 'aaaaaaaa-5555-4000-8000-00000000000a';
    ok := false;
  exception when others then ok := true;
  end;
  results := results || format(E'\n22. A modifie le montant d''un devis finalisé : %s', case when ok then 'refusé → OK' else 'accepté → ÉCHEC' end);
  begin
    insert into public.quote_lines (id, company_id, quote_id, kind, label) values (gen_random_uuid(), ca, 'aaaaaaaa-5555-4000-8000-00000000000a', 'libre', 'Ajout');
    ok := false;
  exception when others then ok := true;
  end;
  results := results || format(E'\n23. A ajoute une ligne à un devis finalisé : %s', case when ok then 'refusé → OK' else 'accepté → ÉCHEC' end);
  update public.quotes set status = 'signe', signer_name = 'Client A', signed_at = now() where id = 'aaaaaaaa-5555-4000-8000-00000000000a';
  select count(*) into n from public.quotes where id = 'aaaaaaaa-5555-4000-8000-00000000000a' and status = 'signe';
  results := results || format(E'\n24. A enregistre la signature du client : %s', case when n = 1 then 'OK' else 'ÉCHEC' end);
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.quotes where company_id = ca;
  begin
    perform public.reserve_quote_numbers(ca, 2026, 1);
    ok := false;
  exception when others then ok := true;
  end;
  results := results || format(E'\n25. B voit %s devis de A et réserve des numéros chez A : %s', n, case when n = 0 and ok then 'refusé → OK' else 'ÉCHEC' end);
  execute 'reset role';

  -- 12. Un visiteur non connecté ne voit rien
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  begin
    select count(*) into n from public.clients;
    ok := (n = 0);
  exception when others then ok := true; -- accès refusé : c'est aussi un succès
  end;
  results := results || format(E'\n12. Visiteur non connecté : %s', case when ok then 'aucun accès → OK' else 'ÉCHEC' end);
  execute 'reset role';

  raise exception 'RÉSULTATS DES TESTS (transaction annulée, rien n''est gardé) :%', results;
end $$;
