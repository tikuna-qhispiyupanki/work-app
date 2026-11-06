# CLAUDE.md – Règles du projet (à relire à chaque session)

Nom de l'application : **Arboject** (disponibilité INPI, nom de domaine et stores à vérifier).
Application SaaS mobile et web pour les entreprises d'élagage et de travaux sur cordes. On commence par La Réunion.

Documents de référence :
- `docs/cahier-des-charges.md` : produit, règles métier, réglementation, choix techniques.
- `docs/Grille_tarifaire_elagage_Reunion_2026.xlsx` : prestations, suppléments et paramètres du devis.
- `docs/modele-de-donnees.md` : tables, relations, règles d'accès. À tenir à jour à chaque changement du schéma.

## Façon de travailler avec le fondateur

- Le fondateur est cordiste et élagueur, **pas développeur**, et il est le premier utilisateur. Il a de 4 à 16 h par semaine.
- Tout se dit en **français simple**. Chaque terme technique est expliqué en une phrase.
- On avance par **petites étapes testables**. À la fin de chaque étape, on dit ce qui a été fait, comment le tester sur l'iPhone ou le navigateur, puis on **attend sa validation** avant d'aller plus loin.
- Ne jamais inventer un résultat de test. Si quelque chose n'a pas été vérifié, le dire.
- Quand une décision lui appartient (prix, textes légaux, ergonomie), on la lui pose avec un choix recommandé.
- Commits petits, en français, poussés sur GitHub (`tikuna-qhispiyupanki/work-app`) à chaque étape validée.

## Feuille de route

1. CLAUDE.md et modèle de données ✅ (validé)
2. Socle : authentification, entreprises et rôles, synchronisation hors-ligne, photos ← **en cours**
   - 2a. Squelette Expo (SDK 58) et écran d'accueil ✅ (validé)
   - 2b. Base locale SQLite (PowerSync web), application web installable et hors-ligne, première visite ✅ (à valider)
   - 2c. Connexion (Supabase Auth), entreprises, rôles, RLS et synchronisation
   - 2d. Photos : compression, miniature, file d'envoi
3. Grille de prix : import du fichier Excel
4. Visite et devis
5. Fiche d'intervention et chantier
6. Fil du chantier et rapport client
7. Tests sur les chantiers du fondateur (critère : un mois de devis sans papier)

Plus tard : V1 bis cordistes (checklist de départ, carnet d'heures, registre EPI), V2 planning et heures, V3 facturation via un logiciel agréé et abonnement.

## Décisions figées (ne pas remettre en cause sans accord explicite)

### Stack
- Expo / React Native en **TypeScript strict**, une seule base de code pour iOS, Android et **web**. Le back-office est la version web de la même application (Expo Router).
- **Phase de test sans aucun abonnement payant** (décision du fondateur) : l'iPhone utilise la **version web installable (PWA)**, ajoutée à l'écran d'accueil depuis Safari. Hébergement : **GitHub Pages** (dépôt public), adresse `https://tikuna-qhispiyupanki.github.io/work-app/`, mise en ligne automatique par `.github/workflows/deploy-pages.yml` à chaque envoi sur `main`. Le chemin de base `/work-app` vient de `EXPO_PUBLIC_BASE_PATH` : ne jamais écrire de chemin absolu « / » en dur, utiliser `BASE_PATH` (`src/config/base-path.ts`).
- **Dépôt public** : aucune clé secrète, aucun mot de passe, aucune donnée client réelle dans le dépôt. Seules les clés publiques prévues pour le navigateur (ex. clé « anon » Supabase) sont permises. Pas de compte Apple, pas de build EAS pour l'instant. La version native (EAS, App Store) viendra avant la commercialisation, avec le même code.
- Conséquences PWA à garder en tête : pas d'envoi en arrière-plan (envoi quand l'application est ouverte), tester sur Safari iPhone, champs de saisie à 16 px minimum (sinon Safari zoome), ne jamais dépendre d'une API native absente du web sans solution de repli.
- Serveur : **Supabase** (Postgres, Auth, Storage), région **Paris (eu-west-3)**. Jamais la région « Europe » générique.
- Le code serveur reste du Postgres standard et portable : pas de dépendance inutile à des fonctions propres à Supabase, pour pouvoir changer d'hébergeur.
- Phase de test : uniquement les offres gratuites. Toute dépense doit être validée avant.

### Hors-ligne complet
- Toutes les écritures vont d'abord dans **SQLite sur le téléphone**, puis sont synchronisées avec Supabase. Moteur : **PowerSync** (`@powersync/web`, stockage IndexedDB, fichiers du worker copiés dans `public/@powersync` par `npm run assets`). Le service de synchronisation PowerSync (offre gratuite ou auto-hébergé) sera branché à l'étape 2c.
- Schéma local : `src/db/schema.ts`. Accès aux données : `src/db/*.ts`. Les écrans lisent avec `useQuery` de `@powersync/react`.
- Conflits : **le dernier enregistrement gagne, champ par champ** (on n'envoie que les colonnes modifiées, chaque ligne a `updated_at`).
- **Messages, photos, signatures et acquittements sont uniquement ajoutés** : jamais modifiés ni supprimés par la synchronisation.
- Identifiants : **UUID générés sur le téléphone**, jamais d'identifiant auto-incrémenté.
- Un indicateur visible montre ce qui n'est pas encore envoyé.
- Une fonction du parcours terrain (visite, devis, signature, fiche, photos) ne doit **jamais exiger le réseau**.

### Plusieurs entreprises
- Chaque ligne métier porte un `company_id`. L'isolement est garanti par les **RLS Postgres**, pas seulement par l'application. Aucune table métier sans RLS.
- Rôles : `gerant`, `bureau`, `chef_equipe`, `technicien` (`client` en lecture seule plus tard).
- Un utilisateur peut appartenir à plusieurs entreprises (table `memberships`).
- `companies.formule` existe, vaut `pilote` et n'est pas utilisé en V1.

### Photos
- Compression sur le téléphone : 1 600 px sur le plus grand côté, JPEG qualité 0,7. Miniature de 320 px. Option « haute définition » ponctuelle.
- File d'envoi en arrière-plan avec reprise après coupure, et option « Wi-Fi seulement ».
- Bucket privé, avec un dossier par entreprise : `{company_id}/...`. Les photos ne sont consultables que par **liens signés temporaires**.
- La date, l'heure et le GPS sont gardés **en base**. Les métadonnées (EXIF) sont **retirées** des fichiers partagés avec les clients.
- GPS enregistré uniquement au moment d'une photo, d'une signature ou d'une checklist. **Jamais de suivi continu.**

### Pas de facturation ni d'abonnement en V1.

## Règles métier

### Devis (calcul repris de la grille Excel)
- Montants stockés en **centimes (entier)**. Jamais de nombre à virgule pour l'argent.
- Ligne de prestation : `quantité × prix unitaire HT × (1 + somme des majorations cochées)`. Les majorations **s'additionnent** :
  - rétention (piscine, toit, véranda, clôture ou voiture sous l'arbre) : 30 % par défaut, modifiable (l'Excel calcule 30,01 %) ;
  - tronc de plus de 60 cm : 25 % ;
  - urgence, week-end ou jour férié : 40 %.
- Prix unitaire = « mon prix » s'il est rempli, sinon le prix conseillé de la grille. Le coefficient Réunion (1,00 par défaut) s'applique aux prix conseillés.
- Suppléments au temps : heures homme au sol (35 €/h), heures grimpeur (50 €/h), évacuation des déchets verts (60 €/m³), déplacement (forfait 45 €), location de matériel au prix réel.
- Le coût de dépôt en déchèterie sert à calculer la marge interne. Il n'est **jamais affiché au client**.
- Total HT, puis TVA arrondie au centime, puis TTC.
- Chaque devis **copie** les prix, les libellés, les coordonnées de l'entreprise et celles du client au moment de sa création. Changer la grille ne modifie jamais un devis existant.

### TVA
- Réglage par entreprise : `franchise` (pas de TVA, mention « TVA non applicable, art. 293 B du CGI ») ou `assujetti`.
- Si l'entreprise est assujettie, le taux dépend de la **zone du chantier** : Réunion (code postal 974xx) 8,5 %, hexagone 20 %. La zone est proposée selon le code postal, modifiable sur la fiche entreprise et sur chaque devis.
- **Entreprise du fondateur : franchise pour l'instant.**

### Mentions obligatoires du devis
Le mot « Devis », un numéro suivi, la date, la durée de validité (30 jours par défaut), l'identité de l'entreprise et du client, l'adresse du chantier, le détail des lignes (quantité, prix unitaire, total), HT, TVA et TTC (ou la mention de franchise), « devis gratuit », les conditions de paiement (à réception, par virement, chèque ou espèces, sans acompte par défaut) et la zone de signature « Bon pour accord ». Le modèle est verrouillé et sera relu par un comptable.
- Numérotation : `D-2026-0001` (voir `docs/modele-de-donnees.md` pour le hors-ligne).
- SIRET, assurance et autres infos légales : champs prévus mais facultatifs en V1. Ils deviendront obligatoires à l'abonnement.

### Fiche d'intervention (élagage et abattage, décret 2021-1833, art. R717-85-16 du Code rural)
- Elle est établie **avant le début des travaux** par chaque chef d'entreprise intervenante, puis datée et signée.
- Contenu : emplacement, travaux, équipements, dates de début et de fin ; croquis (accès, circulation, végétaux à traiter) ; risques propres au chantier et à son environnement ; mesures de prévention ; conduite à tenir en cas d'accident ; organisation des secours ; signatures.
- Elle est présentée aux travailleurs avant le début des travaux, et chacun signe pour en attester. Un exemplaire doit être disponible sur le chantier, donc hors-ligne sur le téléphone.
- Conservation : **2 ans** après la signature.
- Elle est pré-remplie depuis la visite et le devis. Le texte exact de l'article est à revérifier sur Légifrance avant la mise en production.

### Sécurité
- Près de lignes électriques : rappel DT-DICT sur le chantier.
- L'application aide à respecter la réglementation, mais la décision et la responsabilité restent celles de l'employeur. Ce message doit apparaître dans les écrans de sécurité.

## Conventions de code
- Expo SDK 58. Ne pas se fier à sa mémoire pour les API d'Expo : vérifier dans la documentation de la version 58.
- Ajouter une librairie avec `npx expo install <paquet>`, jamais avec `npm install`.
- Écrans dans `src/app/` (Expo Router) ; composants, logique et accès aux données hors de `src/app/`. Alias `@/` = `src/`.
- Les dossiers `ios/` et `android/` ne sont jamais modifiés à la main : réglages dans `app.json`.
- Avant de dire qu'une tâche est finie : `npm run typecheck` et `npm run build:web` doivent passer, et `npm run test:offline` (après `npx serve -s dist -l 8081`) pour tout ce qui touche au parcours terrain.
- `npm run build:web` produit `dist/` : export Expo en mode « single page » + manifeste, icônes et service worker (`scripts/build-web.mjs`, `scripts/sw-template.js`).
- Code et noms de tables en anglais. Textes de l'interface en français.
- Les migrations SQL sont versionnées dans `supabase/migrations/`, une par changement. Chaque table métier a sa politique RLS dans la même migration.
- Calcul du devis : fonction pure, testée par des tests unitaires qui reprennent l'exemple du calculateur Excel.
- Ne jamais mettre de clé secrète dans le dépôt.
