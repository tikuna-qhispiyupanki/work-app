# Serveur Supabase d'Arboject

- `migrations/` : structure de la base (tables, règles d'accès RLS, publication pour la synchronisation). Une migration par changement, jamais modifiée une fois appliquée en production.
- `tests/rls_test.sql` : vérifie les règles d'accès (12 cas : isolement entre entreprises, rôles, visiteur non connecté). Tout se passe dans une transaction annulée : aucune trace dans la base.

## Tester en local (sans toucher au projet Supabase)

```bash
psql -d <base_vide> -f supabase/tests/local-supabase-shim.sql   # imitation minimale de Supabase (auth.users, auth.uid, rôles)
psql -d <base_vide> -f supabase/migrations/20261106000001_socle.sql
psql -d <base_vide> -f supabase/tests/rls_test.sql               # affiche « RÉSULTATS DES TESTS » : toutes les lignes doivent finir par OK
```
