# Modèle de données – V1 élagage

## En deux mots

Les données sont rangées dans des **tables**, comme les onglets d'un classeur Excel. Chaque ligne est une fiche : un client, un arbre, un devis…
Les tables sont reliées entre elles. Un devis appartient à une visite, une visite à un client, et tout appartient à une **entreprise**.

La même structure existe à deux endroits :
- sur le **téléphone** (SQLite) : on y écrit toujours en premier, même sans réseau ;
- sur le **serveur** (Supabase / Postgres) : c'est la copie de référence, partagée avec l'équipe et le bureau.

```
Entreprise ──┬── Membres (utilisateur + rôle)
             ├── Grille de prix ── Prestations
             ├── Clients
             │     └── Visites ──┬── Arbres
             │                   ├── Croquis
             │                   └── Devis ── Lignes de devis
             │                          │ (signé)
             │                          ▼
             └──────────────────── Chantiers ──┬── Équipe du chantier
                                               ├── Fiche d'intervention ── Signatures des intervenants
                                               ├── Messages (fil)
                                               └── Rapport client
Photos : rattachées à un arbre, une visite, un chantier ou un message.
```

## Colonnes communes à toutes les tables

| Colonne | Rôle |
| --- | --- |
| `id` | Identifiant unique (UUID) créé sur le téléphone, donc utilisable hors-ligne |
| `company_id` | Entreprise propriétaire, qui sert à l'isolement entre entreprises |
| `created_at`, `updated_at` | Dates de création et de modification. `updated_at` sert à « le dernier gagne » |
| `created_by` | Utilisateur qui a créé la ligne |
| `deleted_at` | Suppression « douce » : la ligne est masquée, pas effacée. Les suppressions se synchronisent ainsi sans perte |

Les montants sont en **centimes** (`_cents`, nombres entiers) et les pourcentages en **points de base** (`_bp` : 3 000 = 30 %). On évite ainsi les erreurs d'arrondi.

## Les tables

### Comptes et entreprises

**profiles**, une ligne par personne : `user_id` (compte de connexion), `full_name`, `phone`.

**companies**, l'entreprise :
- `name`, `legal_form`, `siret`, `address`, `postal_code`, `city`, `phone`, `email`, `logo_photo_id` (facultatifs en V1) ;
- `insurance_name`, `insurance_policy`, `insurance_area` (facultatifs en V1) ;
- `vat_regime` : `franchise` ou `assujetti` ;
- `default_vat_zone` : `reunion` ou `hexagone` ;
- `quote_validity_days` (30), `quote_payment_terms` (texte), `quote_deposit_bp` (0) ;
- `formule` : `pilote`, inutilisé en V1.

**memberships**, le lien entre une personne et une entreprise : `user_id`, `company_id`, `role` (`gerant` | `bureau` | `chef_equipe` | `technicien`), `active`. Une personne peut avoir plusieurs lignes, donc plusieurs entreprises.

**certifications** (écran Équipe) : `user_id`, `company_id`, `type` (CQP, IRATA, CATSC, SST…), `obtained_on`, `expires_on`, `document_photo_id`.

### Grille de prix (importée depuis l'Excel)

**price_grids**, une version de la grille : `name`, `imported_at`, `is_active`, et les paramètres de l'onglet « Paramètres » :
- `rate_climber_cents` (5 000), `rate_ground_cents` (3 500), `travel_flat_cents` (4 500) ;
- `waste_per_m3_cents` (6 000), `waste_cost_per_m3_cents` (200, coût interne) ;
- `coef_bp` (10 000 = coefficient 1,00) ;
- `surcharge_retention_bp` (3 000), `surcharge_big_trunk_bp` (2 500), `surcharge_urgent_bp` (4 000).

**price_items**, une ligne par prestation de l'onglet « Tarifs de base » : `grid_id`, `label` (« Élagage d'entretien – arbre 5 à 10 m »), `category` (Élagage, Palmier, Haie, Abattage, Souche, Forfait), `unit` (arbre, mètre linéaire, souche, jour), `suggested_price_cents`, `my_price_cents` (vide = prix conseillé), `height_min_m` et `height_max_m` (pour proposer la bonne ligne selon la hauteur de l'arbre), `sort_order`.

À l'import d'un nouveau fichier, on crée une **nouvelle version**. Les anciens devis gardent leurs prix.

### Clients et visites

**clients** : `kind` (`particulier` | `professionnel`), `name`, `phone`, `email`, `address`, `postal_code`, `city` (adresse du client, pour la facturation), `notes`.
Le carnet clients et l'historique sont calculés à partir des visites (et plus tard des devis et des chantiers) liées au client : pas de table d'historique séparée.

**visits**, la visite sur place :
- `client_id`, `visited_at` (date et heure prévues, modifiables) ;
- `site_address`, `site_postal_code`, `site_city`, `site_lat`, `site_lng`, `site_accuracy_m` (précision du GPS ; vide si la position vient de l'adresse) ;
- `vat_zone` (déduite du code postal 974xx, modifiable) ;
- `access_notes` (accès, stationnement, portail), `notes`, `dictation_text` ;
- `near_power_lines` (oui/non, qui déclenche le rappel DT-DICT) ;
- `status` (`prevue` | `faite`) ;
- suppression : `deleted_at` (suppression « douce », avec confirmation).
- Image du plan : une ligne `photos` avec `owner_type = 'visit'` et `kind = 'plan'`.

**trees**, une fiche par arbre :
- `visit_id`, `number` (1, 2, 3… repris sur la carte, le plan et le croquis ; jamais réutilisé après suppression) ;
- `lat`, `lng` (position placée sur la carte ou au GPS) ;
- `species` (nom ou essence : « Manguier », « Filao côté piscine »…), `height_m`, `trunk_diameter_cm` (étape 4) ;
- `intervention` (prestation choisie, lien vers `price_items`), `quantity` ;
- contraintes cochées : `retention` (piscine, toit…), `big_trunk` (> 60 cm), `urgent`, `slope` (pente ou ravine), `far_disposal` (portage), `power_lines` ;
- `estimated_ground_hours`, `estimated_climber_hours`, `waste_m3` ;
- `notes` (repère pour l'équipe : « au fond à droite du portail »).

**sketches**, le croquis : `visit_id`, `kind` (`page_blanche` | `sur_photo`), `base_photo_id`, `drawing` (les traits, enregistrés comme texte), `rendered_photo_id` (image finale, utilisée dans la fiche d'intervention et le rapport).

### Devis

**quotes** :
- `visit_id`, `client_id`, `number` (« D-2026-0001 », attribué à la finalisation) ;
- `status` : `brouillon` → `finalise` → `signe` (ou `refuse` / `expire`) ;
- `issued_on`, `valid_until` ;
- `vat_regime`, `vat_zone`, `vat_rate_bp` (0, 850 ou 2 000), **copiés** au moment de la finalisation ;
- `company_snapshot` et `client_snapshot` (copie figée des coordonnées) ;
- `subtotal_ht_cents`, `vat_cents`, `total_ttc_cents` ;
- `payment_terms`, `deposit_bp`, `free_quote` (oui) ;
- signature : `signed_at`, `signer_name`, `signature_photo_id`, `signed_lat`, `signed_lng`. Ces champs sont écrits une seule fois, puis le devis est verrouillé.

**quote_lines** :
- `quote_id`, `position` ;
- `kind` : `prestation` | `heures_sol` | `heures_grimpeur` | `evacuation` | `deplacement` | `location` | `libre` ;
- `tree_id` (facultatif), `price_item_id` (facultatif) ;
- `label`, `unit`, `quantity`, `unit_price_ht_cents` (copiés) ;
- `retention`, `big_trunk`, `urgent`, `surcharge_bp` (somme des majorations), `total_ht_cents`, `note`.

**quote_number_counters** (serveur) : `company_id`, `year`, `last_number`.

> **Numérotation hors-ligne.** Le numéro doit se suivre sans trou. Comme on peut finaliser un devis sans réseau, chaque téléphone **réserve à l'avance un petit bloc de numéros** (par exemple 10) quand il a du réseau. Avec un seul utilisateur, les numéros se suivent parfaitement. À plusieurs téléphones, l'ordre peut légèrement différer de l'ordre chronologique, mais sans trou ni doublon. Point à faire valider par le comptable.

### Chantier et fiche d'intervention

**jobs**, le chantier, créé à la signature du devis :
- `quote_id`, `client_id`, `visit_id`, copie de l'adresse du chantier ;
- `planned_start`, `planned_end`, `status` (`a_planifier` | `planifie` | `en_cours` | `termine`) ;
- `lead_user_id` (chef d'équipe) ;
- `rope_justification` (pourquoi les cordes plutôt qu'une nacelle) ;
- `dt_dict_required`, `dt_dict_done_on` ;
- `rescue_plan` (texte), `nearest_hospital`, `emergency_numbers`.

**job_members**, l'équipe du chantier : `job_id`, `user_id`, `role_on_job`.

**intervention_sheets**, la fiche d'intervention (art. R717-85-16) :
- `job_id`, `version` ;
- 1° `location`, `works_description`, `equipment` (liste), `start_date`, `end_date` ;
- 2° `sketch_id` ;
- 3° `risks` (liste à cocher et texte libre : lignes électriques, voirie, bâtiments, pente, insectes, météo…) ;
- 4° `prevention_measures` ;
- 5° `accident_procedure` ;
- 6° `rescue_organisation` (alerte, accès des secours, moyens de descente de la victime) ;
- `signed_by`, `signed_at`, `signature_photo_id` ;
- `retain_until` (signature + 2 ans).

Une fiche signée n'est plus modifiable. Pour corriger, on crée une nouvelle version.

**intervention_sheet_acks** (uniquement ajoutée) : `sheet_id`, `user_id`, `acknowledged_at`, `signature_photo_id`. Chaque intervenant atteste ainsi que la fiche lui a été présentée.

### Fil du chantier et rapport

**messages** (uniquement ajoutés) : `job_id`, `author_id`, `kind` (`texte` | `vocal` | `photo`), `body`, `audio_path`, `photo_id`.

**photos** (uniquement ajoutées) :
- `owner_type` (`tree` | `visit` | `job` | `message`…) et `owner_id` ;
- `kind` (`photo` | `plan` | `croquis` | `signature`), `mime_type` ;
- `storage_path`, `thumb_path`, `width`, `height`, `bytes`, `is_hd` ;
- `taken_at`, `lat`, `lng`, `author_id` ;
- `caption`, `include_in_report`.

**reports**, le rapport client : `job_id`, `title`, `summary`, `selected_photo_ids`, `generated_pdf_path`, `generated_docx_path`, `generated_at`.

### Tables seulement sur le téléphone (jamais envoyées)

**upload_queue**, la file d'envoi des photos : `photo_id`, `local_file`, `local_thumb`, `attempts`, `last_error`, `status` (`en_attente` | `en_cours` | `envoyee`).

**settings** : `wifi_only_uploads`, entreprise active.

## Qui voit quoi (règles RLS)

| Rôle | Peut voir | Peut modifier |
| --- | --- | --- |
| Gérant | Tout ce qui concerne son entreprise | Tout, y compris l'entreprise, la grille de prix et les membres |
| Bureau | Tout ce qui concerne son entreprise | Clients, visites, devis, chantiers, rapports, grille de prix |
| Chef d'équipe | Clients, visites, devis, chantiers | Visites, devis, fiches d'intervention, messages, photos |
| Technicien | Les chantiers où il est dans l'équipe, et leur fiche | Messages, photos, sa propre signature de fiche |

Règle de base, appliquée par la base de données elle-même : **on ne voit une ligne que si l'on est membre actif de l'entreprise `company_id` de cette ligne**. Les photos suivent la même règle grâce au dossier `{company_id}/` du stockage.

## Règles de synchronisation

| Type de donnée | En cas de modification sur deux téléphones |
| --- | --- |
| Fiches (client, arbre, visite, chantier, brouillon de devis) | Le dernier gagne, **champ par champ** |
| Devis signé, fiche d'intervention signée | Verrouillés : plus de modification possible |
| Messages, photos, signatures, attestations | Uniquement ajoutés : rien n'est écrasé |

## Points ouverts

- Numérotation des devis hors-ligne (bloc réservé) : validée par le fondateur, à confirmer avec le comptable.
- Texte exact de l'article R717-85-16 : à revérifier sur Légifrance.
- Durées de conservation autres que celle de la fiche d'intervention (2 ans) : à fixer avec un juriste.
