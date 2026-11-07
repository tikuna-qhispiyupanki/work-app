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

## Identité visuelle
- Écran de démarrage animé (logo qui apparaît puis se balance, nom, barre de chargement) : `scripts/splash.html`, injecté dans `index.html` à la construction (visible avant le chargement du code), retiré par `src/pwa/splash.ts` quand l'application est prête (900 ms minimum). Respecte « Réduire les animations ».
- Logo : arbre en facettes avec un grimpeur encordé. Source : `assets/brand/logo-source.jpg` ; version nettoyée, sans le texte parasite : `assets/brand/logo.png`. Icônes générées dans `public/icons/` et `assets/images/`.
- Couleurs : principale `#0E5450` (bleu-vert du logo), fond beige du logo `#E2DFD3`, fond des écrans `#F4F2EA`. Définies dans `src/constants/theme.ts`.

## Feuille de route

1. CLAUDE.md et modèle de données ✅ (validé)
2. Socle : authentification, entreprises et rôles, synchronisation hors-ligne, photos ✅ (validé)
   - 2a. Squelette Expo (SDK 58) et écran d'accueil ✅ (validé)
   - 2b. Base locale SQLite (PowerSync web), application web installable et hors-ligne, première visite ✅ (validé sur iPhone)
   - 2b bis. Visites : « Me localiser » (GPS + adresse IGN), « Situer l'adresse », carte IGN plan/aérien et image du plan, date planifiée, modifier, supprimer, statut « faite » ✅ (validé)
   - 2b ter. Carnet clients (suggestions pendant la saisie, reprise de l'adresse de la dernière visite, fiche et historique), arbres numérotés et nommés sur la carte (et sur l'image du plan), bouton « Ajouter au calendrier » (.ics) ✅ (validé)
   - 2c-1. Serveur : tables, règles d'accès RLS, 12 tests, audit de sécurité Supabase ✅ (validé)
   - 2c-2. Connexion (e-mail + mot de passe, confirmation par e-mail), création de l'entreprise, « Mon compte » ✅ (validé sur iPhone)
   - 2c-3. Synchronisation PowerSync (téléphone ↔ serveur) ✅ (validé) : test à deux téléphones (`bash scripts/e2e.sh sync`) réussi — envoi, réception, modification croisée, hors-ligne puis retour du réseau, déconnexion/reconnexion. Instance Production : `https://6aeeb4c94d7433c80999f9fd.powersync.journeyapps.com` (Client Auth en mode manuel : JWKS `https://qtfhiehlhowbuweykyyu.supabase.co/auth/v1/.well-known/jwks.json`, audience `authenticated`). L'instance Development a été supprimée, ainsi que son compte d'accès à la base.
   - 2d. Photos : compression (1 600 px, JPEG 0,7, sans EXIF), miniature 320 px, option HD 3 200 px, file d'envoi avec reprise, stockage privé par entreprise, téléchargement par lien signé sur un autre appareil ✅ (validé)
3. Grille de prix : import du fichier Excel ✅ (validé) : tables `price_grids` / `price_items` (migration 4, tests RLS 17-19), lecture du .xlsx (`src/domain/xlsx.ts`, `fflate`), recalcul identique à Excel (`src/domain/pricing.ts`, `grid-import.ts`, tests unitaires sur le vrai fichier), écran « Grille de prix » (Mon compte), synchronisée entre appareils (`bash scripts/e2e.sh grid`).
4. Visite et devis ← **en cours**
   - 4a. Fiche arbre complète (mesures, intervention de la grille avec suggestion selon la hauteur, quantité, contraintes, heures et m³, photos de l'arbre, estimation), arbre ajoutable sans carte (hors-ligne), estimation de la visite ✅ (validé) — migration 5, moteur `src/domain/quote-calc.ts` (exemple du calculateur Excel au centime près), `tree-estimate.ts`, écran `src/app/arbres/[id].tsx`, test `tree-sheet`.
   - 4a bis. Zoom « loupe » jusqu'au niveau 21 (IGN s'arrête à 19 : agrandissement ×2/×4), carte des arbres plus haute ; fiches clients (création directe, particulier/professionnel, appeler/SMS/e-mail/itinéraire, retrait du carnet) ✅ (validé) — test `clients-manage`.
   - 4b. Devis ✅ (validé, test `quote` complet, numérotation hors-ligne comprise) : migration 6 (`quotes`, `quote_lines`, `quote_counters`, `reserve_quote_numbers`, verrouillage par déclencheurs après finalisation ; tests RLS 20-25), `src/domain/quote-build.ts` (= calculateur Excel), `src/db/quotes.ts`, réserve de numéros hors-ligne (`src/sync/quote-numbers.ts`, table locale `quote_number_pool`), écrans « Devis » et « Fiche entreprise ».
   - 4c. Ligne offerte (geste commercial, migration 7, hors total, valeur affichée) ; signature du client au doigt (`src/components/signature-pad.web.tsx`, photo « signature » JPEG, nom, date, GPS, statut « signé ») ou refus ; PDF du devis avec jsPDF (`src/pdf/quote-pdf.ts`, mentions obligatoires, signature, partage iPhone ou téléchargement) ✅ (validé) — tests unitaires `quote-pdf`, test `quote-sign`.
   - 4d. Croquis à main levée (page blanche quadrillée, sur l'image du plan, sur une photo de la visite ; 5 couleurs, 3 épaisseurs, annuler ; retouche = nouvelle version, l'ancienne masquée) : photo `kind = 'croquis'` (`src/components/sketch-editor.web.tsx`, écran `src/app/croquis.tsx`) ✅ (validé) — test `sketch`. Pas de table `sketches` séparée : l'image suffit (les traits ne sont pas gardés).
   - 4e. Ergonomie ✅ (validé) : barre d'onglets en bas (`src/app/(tabs)/` : Accueil = tableau de bord, Visites avec recherche et filtres, Devis avec filtres, Clients, Plus = fiche entreprise, grille, synchronisation, déconnexion) ; pastille de synchronisation dans l'en-tête (`src/components/sync-pill.tsx`, détail sur `/synchro`) ; page visite en onglets (Infos · Arbres · Photos · Croquis · Devis, `Segmented`) avec menu « ⋯ » (`ActionMenu`) ; lignes de devis compactes (un appui pour modifier) ; icônes Ionicons (`src/components/icon.tsx`) à la place des émojis dans les boutons. Les onglets inactifs sont masqués (`display: none`) pour VoiceOver et les tests.
   - 4f. Import du carnet de clients (à valider) : fichier Excel (.xlsx) ou CSV (point-virgule ou virgule, UTF-8 ou Windows-1252), écran `src/app/clients/import.tsx` (bouton « Importer » du carnet). Moteur pur `src/domain/client-import.ts` : ligne des titres trouvée seule, colonnes devinées puis modifiables, téléphones remis au format « 0692 12 34 56 » (+262, 0 perdu par Excel), société → professionnel, doublons repérés (même téléphone, même e-mail, ou même nom et code postal — dans le carnet ou deux fois dans le fichier) et laissés de côté, aperçu, import en une seule écriture (`importClients`). Modèle CSV téléchargeable. Tests unitaires `client-import`, test `client-import` (fichiers fictifs `tests/fixtures/clients*`).
   - 4g. Signature à distance (à valider) : lien personnel `…/signer/<jeton>` envoyé par SMS, e-mail, WhatsApp (partage iPhone) ; page publique `src/app/signer/[token].tsx` (sans base locale ni compte : `RootLayout` bascule sur `PublicLayout`, client Supabase anonyme sans session) ; le client lit le devis, coche « J'ai lu et j'accepte », signe au doigt ou refuse (motif) et télécharge son exemplaire PDF. Signature électronique simple (eIDAS) : nom, date du serveur, IP, navigateur, empreinte SHA-256 du devis, texte d'acceptation. Table `quote_sign_requests` (migrations 9 à 11, tests RLS 26-33), `src/db/sign-requests.ts`, `src/components/remote-sign.tsx` (carte « Faire signer à distance », preuve affichée), preuve imprimée sur le PDF. Test `quote-remote` (`SANS_REGLES=1` saute ce qui dépend des règles PowerSync).
   - Ensuite : étape 5.
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
  - Projet : `arboject`, réf. `qtfhiehlhowbuweykyyu` (offre gratuite). URL et clé publique : `src/config/supabase.ts`. (L'autre projet du compte, à Londres, n'a rien à voir avec Arboject : ne pas y toucher.)
  - Migrations : `supabase/migrations/`, appliquées dans l'ordre via l'API de gestion Supabase (`POST /v1/projects/<réf>/database/query`). Le jeton `sbp_` du fondateur est enregistré comme secret réseau de l'environnement « work-app » : jamais dans le code. Toujours tester d'abord en local (`supabase/README.md`), puis relancer `supabase/tests/rls_test.sql` et l'audit de sécurité (`/v1/projects/<réf>/advisors/security`) après chaque migration.
  - Fonctions internes des règles d'accès dans le schéma `private` (non exposé). Remarques d'audit acceptées : `public.create_company` appelable par un utilisateur connecté (voulu) ; « leaked password protection » (vérification des mots de passe volés), à activer quand l'offre le permettra.
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
- File d'envoi avec reprise après coupure (`src/sync/uploader.ts`, table locale `upload_queue`, essais espacés jusqu'à 1 h). Version web : l'envoi n'a lieu que quand l'application est ouverte. **Option « Wi-Fi seulement » impossible dans Safari** (le navigateur ne dit pas si on est en Wi-Fi ou en 4G) : elle viendra avec la version App Store.
- Chemins : `photos/{company_id}/{photo_id}.jpg` et `…_min.jpg` (miniature). Migration `20261107000003_stockage_photos.sql` ; tests 13 à 16 de `rls_test.sql`.
- Supabase refuse la suppression directe des fichiers en SQL : les tests nettoient par l'API de stockage (`scripts/cleanup-storage.py`, clé d'administration lue à la volée, jamais écrite).
- Déconnexion refusée tant que des photos attendent l'envoi ; après déconnexion, les fichiers du téléphone sont effacés (ils sont sur le serveur).
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

### Localisation et cartes
- Service : **IGN Géoplateforme** (`data.geopf.fr`), gratuit et sans compte, qui couvre La Réunion. Adresses : `/geocodage/search` et `/geocodage/reverse`. Cartes : WMTS `PLANIGNV2` (plan) et `ORTHOIMAGERY.ORTHOPHOTOS` (vue aérienne). Mention « © IGN » obligatoire sur les cartes et les images.
- Le GPS marche sans réseau. L'adresse et la carte ont besoin du réseau : il faut toujours prévoir le cas hors-ligne avec un message clair.
- L'image du plan (JPEG 1 200 × 800 avec un repère et les coordonnées) est une ligne de `photos` (`kind = 'plan'`). Son fichier est gardé dans IndexedDB (`src/files/local-files.ts`). Une seule image de plan active par visite : l'ancienne est masquée.

### Connexion et entreprise active
- Supabase Auth, e-mail + mot de passe (8 caractères minimum), **confirmation par e-mail obligatoire** (choix du fondateur). Flux « implicit » : les liens d'e-mail marchent même ouverts dans Safari plutôt que dans l'application installée.
- E-mails : l'expéditeur gratuit de Supabase envoie en anglais, au plus 2 e-mails par heure, et **seulement aux adresses des membres de l'organisation Supabase**. Avant d'ouvrir à d'autres entreprises : brancher un service d'envoi d'e-mails (SMTP) et traduire les modèles en français.
- Écrans gardés par `Stack.Protected` (`src/app/_layout.tsx`) : non connecté → `/connexion` ; connecté sans entreprise → `/entreprise` ; sinon l'application.
- Entreprise active et utilisateur : `src/auth/session.tsx`, mémorisés sur le téléphone pour s'ouvrir hors-ligne. Toute nouvelle donnée prend `currentIds()` (`src/auth/current.ts`) : jamais d'identifiant d'entreprise écrit en dur.
- Données créées avant la première connexion (identifiants provisoires `LOCAL_COMPANY_ID` / `LOCAL_USER_ID`) : rattachées à l'entreprise à la connexion. **À l'étape 2c-3, l'envoi au serveur doit aussi remplacer ces identifiants provisoires dans les opérations en attente.**
- Déconnexion : **refusée tant qu'une modification n'est pas envoyée** (sinon elle serait perdue) ; une fois tout envoyé, les données du téléphone sont effacées (`disconnectAndClear`) et reviennent du serveur à la reconnexion.
- Envoi (`src/sync/connector.ts`) : les identifiants provisoires `LOCAL_COMPANY_ID` / `LOCAL_USER_ID` sont remplacés au moment de l'envoi. Les refus définitifs du serveur (codes 22xxx, 23xxx, 42501) sont mis de côté et affichés dans « Mon compte » au lieu de bloquer la file. Les dates venant du serveur ont un espace au lieu du « T » : toujours les lire avec `toDate()` (`src/domain/dates.ts`).
- Sous-traitant RGPD à déclarer : **PowerSync** (copie des données synchronisées), en plus de Supabase.
- Tests : la synchronisation garde une connexion ouverte, donc ne jamais attendre `networkidle` dans Playwright. Aides communes dans `tests/helpers/login.cjs` : `tab(p, nom)` (onglets), `menu(p, menu, action)` (menu « ⋯ »), `syncState(p, /texte/)` (état lu dans l'aria-label de la pastille).
- Tests de bout en bout : `npm run test:e2e` (`scripts/e2e.sh`) crée un compte de test temporaire dans Supabase, lance tous les tests, puis supprime le compte et ses données. Le nettoyage supprime dans l'ordre des dépendances (photos → arbres → visites → clients → grille → entreprise) et **signale tout échec** : à mettre à jour à chaque nouvelle table. Les tests partagent le même compte : chaque test doit cibler ses propres données (nom de client unique), jamais « la première ligne trouvée ».

### Calendrier
- Maintenant : fichier `.ics` par visite (`src/domain/calendar.ts`), avec un UID stable `visite-<id>@arboject` et des rappels la veille et 1 h avant. Sur iPhone, il s'ouvre par un lien `data:text/calendar` ; sur ordinateur, il se télécharge.
- Après 2c : **abonnement de calendrier** (URL webcal servie par le serveur, avec un jeton secret par utilisateur), qui suit automatiquement les visites et les chantiers.

### Sécurité
- Près de lignes électriques : rappel DT-DICT sur le chantier.
- L'application aide à respecter la réglementation, mais la décision et la responsabilité restent celles de l'employeur. Ce message doit apparaître dans les écrans de sécurité.

## Conventions de code
- Expo SDK 58. Ne pas se fier à sa mémoire pour les API d'Expo : vérifier dans la documentation de la version 58.
- Ajouter une librairie avec `npx expo install <paquet>`, jamais avec `npm install`.
- Écrans dans `src/app/` (Expo Router) ; composants, logique et accès aux données hors de `src/app/`. Alias `@/` = `src/`.
- Les dossiers `ios/` et `android/` ne sont jamais modifiés à la main : réglages dans `app.json`.
- Avant de dire qu'une tâche est finie : `npm run typecheck` et `npm run build:web` doivent passer, puis `npm run test:unit` et `npm run test:e2e` (après `npx serve -s dist -l 8081`).
- Ajout de librairie : `npx expo install` a besoin de api.expo.dev (bloqué dans l'environnement cloud) ; pour une librairie 100 % JavaScript sans lien avec la version d'Expo, `npm install` convient.
- Composants qui utilisent le navigateur (DOM, canvas, IndexedDB) : fichier `.web.tsx`, plus un fichier `.tsx` de même interface pour le natif.
- Environnement cloud de travail : « work-app » (accès réseau à data.geopf.fr, au site GitHub Pages, à docs.expo.dev, à la MSA, à Légifrance, au projet Supabase, à docs.powersync.com et à l'instance PowerSync).
- Règles de synchronisation : `powersync/sync-config.yaml`, vérifiées par `npm run check:sync`, collées dans le tableau de bord PowerSync (Sync Streams → Deploy).
- `npm run build:web` produit `dist/` : export Expo en mode « single page » + manifeste, icônes et service worker (`scripts/build-web.mjs`, `scripts/sw-template.js`).
- Code et noms de tables en anglais. Textes de l'interface en français.
- Les migrations SQL sont versionnées dans `supabase/migrations/`, une par changement. Chaque table métier a sa politique RLS dans la même migration.
- Calcul du devis : fonction pure, testée par des tests unitaires qui reprennent l'exemple du calculateur Excel.
- Tests unitaires : `npm run test:unit` (Node, sans compilation : `tests/unit/ts-resolve.mjs` résout « @/ » et les imports sans extension). Dans les fichiers de `src/domain/`, importer les types avec `import type`.
- Grille de prix : le prix conseillé est **recalculé** depuis les données brutes du fichier (fourchette, base HT/TTC, coefficient) avec la formule Excel, et comparé au résultat d'Excel (écart signalé). Une nouvelle importation crée une nouvelle version active ; l'ancienne reste en archive. La grille de départ est copiée de `docs/` vers `public/` à la construction.
- Après tout ajout de table synchronisée : mettre à jour `powersync/sync-config.yaml` (`npm run check:sync`), puis demander au fondateur de le recoller dans PowerSync (Sync Streams → Deploy) **avant** de mettre en ligne l'écran qui l'utilise : une table absente des règles est effacée du téléphone après envoi (les données restent sur le serveur).
- Remise à zéro du compteur de devis (migration 8) : `quote_counters.epoch` (« série ») augmente ; chaque téléphone compare sa réserve à `quote_counter_epoch()` et jette les numéros d'une ancienne série. Supprimer des devis finalisés exige `session_replication_role = replica` le temps de la suppression ; les fichiers de signature se suppriment par l'API de stockage (`scripts/cleanup-storage.py --paths`). Fait le 07/11/2026 pour l'entreprise du fondateur (3 devis d'essai supprimés).
- Remarques d'audit acceptées aussi : `quote_for_signature` et `decide_quote_signature` appelables sans compte (voulu : page du client, protégée par le jeton secret) ; `quote_counters` sans règle (accès seulement par `reserve_quote_numbers`, qui vérifie les droits) et `reserve_quote_numbers` appelable par un utilisateur connecté.
- Nettoyage des tests : `session_replication_role = replica` seulement pour supprimer les devis finalisés (sinon les suppressions en cascade d'`auth` sont aussi désactivées et laissent des orphelins).
- PDF : jsPDF et ses polices standard ne connaissent pas les espaces fines (U+202F, utilisées par `toLocaleString('fr-FR')`), les flèches ni les émojis : toujours passer le texte par `pdfText()`. Logo de l'entreprise : photo `kind = 'logo'` (800 px, JPEG sur fond blanc pour les PNG transparents), `companies.logo_photo_id`, copié dans le devis finalisé et imprimé en haut à gauche du PDF.
- Ne jamais mettre de clé secrète dans le dépôt.
