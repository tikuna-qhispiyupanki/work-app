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
  tok text := 'tok_' || repeat('x', 44); -- lien de signature de test
  j jsonb;
  j_n int;
  q2 uuid := 'aaaaaaaa-5555-4000-8000-00000000000b';
  m_a uuid := 'aaaaaaaa-6666-4000-8000-00000000000a'; -- équipier de A
  sh uuid := 'aaaaaaaa-7777-4000-8000-00000000000a'; -- fiche d'intervention de A
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

  -- 26-33. Signature à distance : lien personnel, une seule fois, réponse non modifiable
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.quotes (id, company_id, client_id) values (q2, ca, cli_a);
  insert into public.quote_lines (id, company_id, quote_id, kind, label, total_ht_cents) values (gen_random_uuid(), ca, q2, 'libre', 'Élagage', 25000);
  update public.quotes set status = 'finalise', number = 'D-2026-0002', issued_on = current_date, subtotal_ht_cents = 25000, total_ttc_cents = 25000,
    company_snapshot = '{"name":"Élagage A"}' where id = q2;
  insert into public.quote_sign_requests (id, company_id, quote_id, token, expires_at) values (gen_random_uuid(), ca, q2, tok, now() + interval '15 days');
  select count(*) into n from public.quote_sign_requests where quote_id = q2;
  results := results || format(E'\n26. A crée un lien de signature pour un devis finalisé : %s', case when n = 1 then 'OK' else 'ÉCHEC' end);
  begin
    insert into public.quote_sign_requests (id, company_id, quote_id, token, expires_at, status, signer_name)
    values (gen_random_uuid(), ca, q2, tok || 'y', now() + interval '1 day', 'signe', 'Faux');
    ok := false;
  exception when others then ok := true;
  end;
  results := results || format(E'\n27. A crée un lien déjà « signé » (fausse signature) : %s', case when ok then 'refusé → OK' else 'accepté → ÉCHEC' end);
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  begin
    select count(*) into n from public.quote_sign_requests;
    ok := (n = 0);
  exception when others then ok := true;
  end;
  results := results || format(E'\n28. Visiteur non connecté lit la table des liens : %s', case when ok then 'aucun accès → OK' else 'ÉCHEC' end);
  begin
    perform public.quote_for_signature('tok_' || repeat('z', 44));
    ok := false;
  exception when others then ok := true;
  end;
  j := public.quote_for_signature(tok);
  results := results || format(E'\n29. Client avec le lien : voit le devis %s (état %s), lien inventé refusé : %s', j #>> '{document,number}', j ->> 'state',
    case when ok and j ->> 'state' = 'a_signer' and j #>> '{document,lines,0,label}' = 'Élagage' then 'OK' else 'ÉCHEC' end);
  begin
    perform public.decide_quote_signature(tok, 'signe', 'Client A', 'data:image/jpeg;base64,AAAA', null, 'mauvaise-empreinte', 'test');
    ok := false;
  exception when others then ok := true;
  end;
  perform public.decide_quote_signature(tok, 'signe', 'Client A', 'data:image/jpeg;base64,AAAA', null, j ->> 'document_hash', 'test');
  execute 'reset role';
  select count(*) into n from public.quotes q join public.quote_sign_requests r on r.quote_id = q.id
  where q.id = q2 and q.status = 'signe' and q.signer_name = 'Client A' and r.status = 'signe' and r.document_hash = j ->> 'document_hash' and r.consent_text like 'Bon pour accord%';
  results := results || format(E'\n30. Client signe (empreinte vérifiée, mauvaise empreinte refusée) → devis « signé » : %s', case when ok and n = 1 then 'OK' else 'ÉCHEC' end);
  execute 'set local role anon';
  begin
    perform public.decide_quote_signature(tok, 'refuse', 'Autre', null, 'non', j ->> 'document_hash', 'test');
    ok := false;
  exception when others then ok := true;
  end;
  results := results || format(E'\n31. Le même lien resservi : %s', case when ok then 'refusé → OK' else 'accepté → ÉCHEC' end);
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    update public.quote_sign_requests set signer_name = 'Modifié' where quote_id = q2;
    ok := false;
  exception when others then ok := true;
  end;
  results := results || format(E'\n32. A modifie la signature reçue : %s', case when ok then 'refusé → OK' else 'accepté → ÉCHEC' end);
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.quote_sign_requests where company_id = ca;
  results := results || format(E'\n33. B voit %s lien de signature de A (attendu 0) : %s', n, case when n = 0 then 'OK' else 'ÉCHEC' end);
  execute 'reset role';

  -- 34-38. Mon équipe et coûts internes
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.team_members (id, company_id, name, trade) values (m_a, ca, 'Paul Grimpeur', 'grimpeur');
  insert into public.team_member_costs (id, company_id, member_id, hourly_cost_cents) values (gen_random_uuid(), ca, m_a, 2800);
  insert into public.quote_crew (id, company_id, quote_id, member_id, hours) values (gen_random_uuid(), ca, q2, m_a, 7);
  select count(*) into n from public.team_member_costs where member_id = m_a;
  results := results || format(E'\n34. Gérant de A crée un équipier, son coût horaire et l''équipe d''un devis : %s', case when n = 1 then 'OK' else 'ÉCHEC' end);
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', ut, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.team_members where company_id = ca;
  select count(*) into j_n from public.team_member_costs where company_id = ca;
  results := results || format(E'\n35. Technicien de A voit %s équipier et %s coût (attendu 1 et 0) : %s', n, j_n, case when n = 1 and j_n = 0 then 'OK' else 'ÉCHEC' end);
  begin
    insert into public.team_members (id, company_id, name) values (gen_random_uuid(), ca, 'Intrus');
    ok := false;
  exception when others then ok := true;
  end;
  results := results || format(E'\n36. Technicien de A ajoute un équipier : %s', case when ok then 'refusé → OK' else 'accepté → ÉCHEC' end);
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.team_members where company_id = ca;
  select count(*) into j_n from public.quote_crew where company_id = ca;
  results := results || format(E'\n37. B voit %s équipier et %s ligne d''équipe de A (attendu 0) : %s', n, j_n, case when n = 0 and j_n = 0 then 'OK' else 'ÉCHEC' end);
  begin
    insert into public.team_members (id, company_id, name) values ('bbbbbbbb-6666-4000-8000-00000000000b', cb, 'Équipier B');
    insert into public.quote_crew (id, company_id, quote_id, member_id, hours) values (gen_random_uuid(), cb, q2, m_a, 1);
    ok := false;
  exception when others then ok := true;
  end;
  results := results || format(E'\n38. B rattache un équipier de A à ses données : %s', case when ok then 'refusé → OK' else 'accepté → ÉCHEC' end);
  execute 'reset role';

  -- 39-45. Chantier et fiche d'intervention
  select count(*) into n from public.jobs where id = q2 and quote_id = q2 and status = 'a_planifier';
  results := results || format(E'\n39. Chantier créé tout seul à la signature à distance du devis : %s', case when n = 1 then 'OK' else 'ÉCHEC' end);
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.job_members (id, company_id, job_id, member_id, role_on_job) values (gen_random_uuid(), ca, q2, m_a, 'chef');
  insert into public.intervention_sheets (id, company_id, job_id, location, works, risks) values (sh, ca, q2, '1 rue du Test', 'Élagage', '{}');
  begin
    insert into public.intervention_sheet_acks (id, company_id, sheet_id, member_id, name) values (gen_random_uuid(), ca, sh, m_a, 'Paul');
    ok := false;
  exception when others then ok := true;
  end;
  results := results || format(E'\n40. Équipier signe une fiche pas encore signée par le chef d''entreprise : %s', case when ok then 'refusé → OK' else 'accepté → ÉCHEC' end);
  update public.intervention_sheets set status = 'signee', signer_name = 'Gérant A', signed_at = now(), retain_until = current_date + interval '2 years' where id = sh;
  begin
    update public.intervention_sheets set works = 'Abattage' where id = sh;
    ok := false;
  exception when others then ok := true;
  end;
  results := results || format(E'\n41. A modifie une fiche signée : %s', case when ok then 'refusé → OK' else 'accepté → ÉCHEC' end);
  begin
    update public.intervention_sheets set deleted_at = now() where id = sh;
    ok := false;
  exception when others then ok := true;
  end;
  results := results || format(E'\n42. A efface une fiche signée avant 2 ans : %s', case when ok then 'refusé → OK' else 'accepté → ÉCHEC' end);
  insert into public.intervention_sheet_acks (id, company_id, sheet_id, member_id, name) values (gen_random_uuid(), ca, sh, m_a, 'Paul Grimpeur');
  update public.intervention_sheet_acks set name = 'Autre' where sheet_id = sh;
  get diagnostics n = row_count;
  results := results || format(E'\n43. Équipier atteste la fiche ; l''attestation modifiée ensuite : %s ligne(s) (attendu 0) : %s', n, case when n = 0 then 'OK' else 'ÉCHEC' end);
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', ut, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.jobs where company_id = ca;
  results := results || format(E'\n44. Technicien de A voit %s chantier (attendu 0 avant les comptes équipiers) : %s', n, case when n = 0 then 'OK' else 'ÉCHEC' end);
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.intervention_sheets where company_id = ca;
  select count(*) into j_n from public.jobs where company_id = ca;
  begin
    insert into public.intervention_sheets (id, company_id, job_id) values (gen_random_uuid(), cb, q2);
    ok := false;
  exception when others then ok := true;
  end;
  results := results || format(E'\n45. B voit %s chantier / %s fiche de A et crée une fiche sur un chantier de A : %s', j_n, n, case when n = 0 and j_n = 0 and ok then 'refusé → OK' else 'ÉCHEC' end);
  execute 'reset role';

  -- 46-51. Fil du chantier, rapport client, lien du client
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.job_notes (id, company_id, job_id, body) values (gen_random_uuid(), ca, q2, 'Portail fermé à clé');
  update public.job_notes set body = 'Modifié' where job_id = q2;
  get diagnostics n = row_count;
  results := results || format(E'\n46. A ajoute une note au fil du chantier ; la note modifiée ensuite : %s ligne(s) (attendu 0) : %s', n, case when n = 0 then 'OK' else 'ÉCHEC' end);
  insert into public.job_reports (id, company_id, job_id, works_done) values (q2, ca, q2, 'Élagage réalisé');
  update public.job_reports set status = 'signe', client_signer_name = 'Client A', client_signed_at = now() where id = q2;
  begin
    update public.job_reports set works_done = 'Autre chose' where id = q2;
    ok := false;
  exception when others then ok := true;
  end;
  results := results || format(E'\n47. A modifie un rapport réceptionné par le client : %s', case when ok then 'refusé → OK' else 'accepté → ÉCHEC' end);
  insert into public.report_links (id, company_id, job_id, token, expires_at, photos)
  values (gen_random_uuid(), ca, q2, 'rap_' || repeat('r', 44), now() + interval '30 days', '[{"url":"https://exemple.invalid/a.jpg","stage":"apres"}]');
  begin
    insert into public.report_links (id, company_id, job_id, token, expires_at) values (gen_random_uuid(), ca, q2, 'rap_' || repeat('s', 44), now() + interval '400 days');
    ok := false;
  exception when others then ok := true;
  end;
  results := results || format(E'\n48. A crée un lien de rapport valable plus de 60 jours : %s', case when ok then 'refusé → OK' else 'accepté → ÉCHEC' end);
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  j := public.report_for_client('rap_' || repeat('r', 44));
  begin
    perform public.report_for_client('rap_' || repeat('z', 44));
    ok := false;
  exception when others then ok := true;
  end;
  results := results || format(E'\n49. Client avec le lien : rapport « %s », %s photo ; lien inventé refusé : %s', j #>> '{report,works_done}', jsonb_array_length(j -> 'photos'),
    case when ok and j ->> 'state' = 'ok' and j #>> '{report,client_signer_name}' = 'Client A' then 'OK' else 'ÉCHEC' end);
  begin
    select count(*) into n from public.job_reports;
    ok := (n = 0);
  exception when others then ok := true;
  end;
  results := results || format(E'\n50. Visiteur non connecté lit les rapports et notes : %s', case when ok then 'aucun accès → OK' else 'ÉCHEC' end);
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.job_notes where company_id = ca;
  select count(*) into j_n from public.report_links where company_id = ca;
  results := results || format(E'\n51. B voit %s note / %s lien de rapport de A (attendu 0) : %s', n, j_n, case when n = 0 and j_n = 0 then 'OK' else 'ÉCHEC' end);
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
