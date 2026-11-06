# Cahier des charges – Application travaux sur cordes et élagage

6 novembre 2026

## Vision et positionnement

Une application mobile et web pour les entreprises de travaux sur cordes et d'élagage, centrée sur le chantier : de la visite au devis, puis la sécurité, le suivi et le rapport client. Cible de départ : l'élagage à La Réunion, avec l'entreprise du fondateur (cordiste et élagueur) comme premier client test, puis les cordistes en France et à La Réunion.

**Promesse** : centraliser l'information, rendre les process clairs et faciliter la conformité, sans paperasse.

| Acteur | Ce qu'il fait | Ce qui manque pour nos cibles |
| --- | --- | --- |
| [Kraaft](https://www.lafabriquedunet.fr/logiciel/kraaft) | Messagerie par chantier, photos, rapports, planning, pour tout le BTP | Rien de spécifique aux cordes ni à l'élagage |
| [Kleyk](https://www.kleyk.com) | Fiche d'intervention élagage (décret 2021-1833), 7 € HT/personne/mois | Pas de devis, pas de suivi de chantier, pas les cordistes |
| [RopeLogix](https://ropelogix-marketing.pages.dev/) (Australie) | Carnet d'heures IRATA, registre matériel, plans de sauvetage, certifications | Pas de version française ni de règles françaises |
| [Petzl ePPEcentre](https://apps.apple.com/ph/app/id6466090005) | Gestion et contrôle des EPI | Pas de chantier, pas de devis |

**Différenciation** : une seule saisie sur le terrain qui produit le devis, la fiche d'intervention, la checklist de sécurité et le rapport client. Les EPI sont gérés en version légère et complètent ePPEcentre au lieu de le concurrencer.

## Périmètre et écrans

La V1 couvre l'élagage de bout en bout : visite, devis, fiche d'intervention, chantier, rapport. Le module cordiste suit sur la même base.

| Version | Contenu |
| --- | --- |
| V1 – Élagage | Visite sur place (fiche par arbre, croquis, dictée vocale), devis conforme à partir de la grille de prix, signature du client, fiche d'intervention pré-remplie, fil photos et messages par chantier, rapport client PDF/Word, équipe et certifications |
| V1 bis – Cordistes | Checklist de départ signée (deux cordes, ancrages, équipe, plan de sauvetage, EPI à jour), carnet d'heures personnel gratuit, registre EPI léger avec import Excel/ePPEcentre |
| V2 | Planning avec contrôle de la composition d'équipe, pointage des heures et export paie |
| V3 | Facturation via un logiciel agréé, abonnement et paiement en ligne |

**Écrans côté terrain (téléphone)**

1. Accueil : chantiers et visites du jour.
2. Visite : fiche par arbre (photo, essence, hauteur, intervention, contraintes), croquis, dictée.
3. Devis : lignes calculées, suppléments, signature du client.
4. Checklist de départ : équipe, ancrages, sauvetage, EPI, signature.
5. Fil du chantier : photos, notes vocales, messages.
6. Fin de journée : heures sur corde et sur site.
7. Mon carnet : heures, certifications, export PDF.

**Écrans côté bureau (web et téléphone)**

1. Tableau de bord : chantiers en cours, devis en attente, alertes (EPI, certifications).
2. Fiche chantier : client, adresse, arbres, ancrages, plan de sauvetage, kit EPI.
3. Grille de prix : prestations, suppléments, taux horaires, coefficient.
4. Rapport client : modèle avec logo, rempli depuis le fil, export PDF/Word.
5. Équipe : techniciens, rôles, certifications.
6. EPI : matériel, statut, prochain contrôle, import.

## Règles métier et réglementation

L'application traduit ces textes en contrôles et en documents pré-remplis. Elle aide l'employeur, mais la responsabilité de la sécurité reste la sienne.

| Sujet | Règle | Ce que fait l'application |
| --- | --- | --- |
| Recours aux cordes | Permis seulement si les moyens collectifs sont impossibles ou plus risqués ([R4323-64](https://www.inrs.fr/accueil/risques/chutes-hauteur/travail-encorde-acces-positionnement-cordes.html)) | Champ « justification » par chantier |
| Deux cordes et ancrages | Deux cordes ancrées séparément, note de calcul des ancrages, formation au sauvetage ([R4323-89](https://content.preventionbtp.fr/legal_prevention/4VJoQAwc7Q9dQ4B4JkPxs4)) | Checklist de départ bloquante, plan de sauvetage par chantier |
| Équipe minimum | Au moins deux travailleurs, dont un compétent en autonomie ([Éditions Tissot](https://www.editions-tissot.fr/actualite/droit-du-travail/travaux-du-btp-realises-au-moyen-de-cordes-regles-applicables)) | Alerte si l'équipe planifiée ne respecte pas la règle |
| EPI antichute | Vérification depuis moins de 12 mois au moment de l'utilisation, résultat dans le registre de sécurité, tout support accepté (arrêté du 19 mars 1993) ([Inforisque](https://dev.inforisque.fr/fiches-pratiques/documents/EPI-contre-chutes-hauteur-dans-travail-2020.pdf)) | Registre numérique, alertes avant échéance |
| Élagage et abattage | Fiche d'intervention obligatoire avant chaque chantier, avec croquis des accès et des arbres (décret 2021-1833) ([MSA](https://ssa.msa.fr/wp-content/uploads/2023/12/12350_Notice_fiche_intervention_WEB.pdf)) | Fiche générée depuis la visite et le devis |
| Lignes électriques | DT-DICT avant travaux à proximité des réseaux | Rappel dans la fiche chantier |
| Devis | Mentions obligatoires (mot « devis », date, validité, coordonnées, détail, HT/TVA/TTC, gratuit ou payant, paiement, numérotation suivie) ([Pennylane](https://www.pennylane.com/fr/fiches-pratiques/facturation/quelles-sont-les-16-mentions-obligatoires-a-mettre-sur-vos-devis)) | Modèle de devis verrouillé, relu une fois par un comptable |
| TVA | 8,5 % à La Réunion, 20 % en hexagone (taux normaux) ([impots.gouv.fr](https://www.impots.gouv.fr/portail/professionnel/questions/quels-sont-les-differents-taux-de-tva-applicables-dans-les-dom)) | Taux choisi selon l'adresse du chantier |
| Facture électronique | Émission obligatoire pour les TPE et PME au 1er septembre 2027, via une plateforme agréée ([L'Essentiel de l'Éco](https://lessentieldeleco.fr/6447-independants-la-facturation-electronique-va-tout-changer-pour-vous/)) | Pas de facturation développée en interne : transfert vers un logiciel agréé (V3) |

La grille de prix (fichier Excel séparé) fournit les prix par défaut du devis, à calibrer sur des devis réunionnais réels avant usage.

## Choix techniques

Trois décisions sont figées dès le départ parce qu'elles sont très coûteuses à changer après : hors-ligne complet, plusieurs entreprises, gestion des photos.

**Hors-ligne complet (validé)**

- Toutes les données du chantier sont écrites d'abord dans une base locale sur le téléphone (SQLite), puis synchronisées avec le serveur dès qu'il y a du réseau.
- Moteur de synchronisation compatible Supabase, par exemple PowerSync, à confirmer avec l'IA au démarrage.
- Règle de conflit : le dernier enregistrement gagne, champ par champ. Les messages et photos ne sont jamais écrasés, seulement ajoutés.
- Un indicateur visible montre ce qui n'est pas encore envoyé.

**Plusieurs entreprises (validé)**

- Chaque donnée appartient à une entreprise. L'isolement est garanti côté base de données (règles d'accès par ligne de Postgres), pas seulement dans l'application.
- Rôles : gérant, bureau, chef d'équipe, technicien, et client en lecture seule plus tard.
- Un utilisateur peut appartenir à plusieurs entreprises : un cordiste indépendant garde son carnet personnel et travaille pour plusieurs employeurs.
- Un champ « formule » existe dès le début sur chaque entreprise, inutilisé tant que l'abonnement n'est pas actif.

**Photos (solution retenue)**

1. Prise de vue dans l'application, compression immédiate sur le téléphone : 1 600 pixels sur le plus grand côté, JPEG qualité environ 70 %. C'est assez net pour un rapport et quelques centaines de Ko au lieu de plusieurs Mo (ordre de grandeur à vérifier aux tests).
2. Une miniature de 320 pixels est créée en même temps pour afficher les listes rapidement.
3. La photo est enregistrée sur le téléphone et mise en file d'attente. L'envoi se fait en arrière-plan dès qu'il y a du réseau, avec reprise automatique en cas de coupure. Option « envoi en Wi-Fi seulement ».
4. Stockage dans un espace privé par entreprise (Supabase Storage, région UE), consultable seulement par liens temporaires signés.
5. Date, heure et position GPS sont gardées dans la base, comme preuve. Elles sont retirées des fichiers envoyés aux clients.
6. Option « haute définition » ponctuelle pour un diagnostic d'arbre ou une expertise.

**Stack**

| Élément | Choix |
| --- | --- |
| Application | Expo / React Native en TypeScript, une seule base de code iOS et Android |
| Construction des versions iOS | Dans le cloud (EAS), pas besoin de Mac |
| Serveur | Supabase : Postgres, authentification, stockage, en région UE précise ([Supabase](https://supabase.com/docs/guides/security/gdpr-compliance.md)) |
| Back-office | Application web dans le même projet |
| Code | Git et GitHub, sauvegarde et historique |
| Cadre pour l'IA | Fichier de spécifications à la racine du projet (CLAUDE.md), relu à chaque session |

Point d'attention : Supabase conseille de choisir une région UE précise, car son regroupement « Europe » inclut Londres et Zurich, hors UE ([Supabase](https://supabase.com/docs/guides/platform/gdpr)).

## Cadre légal de l'éditeur

Six documents sont à préparer avant le premier client payant. Les trois derniers seront relus par un avocat. Ce qui suit est un repère, pas un avis juridique.

**Votre rôle au sens du RGPD**

- Pour les données de chantier de vos clients (photos, clients finaux, équipes), vous êtes **sous-traitant** : votre client est responsable de traitement ([Leto](https://www.leto.legal/guides/rgpd-et-saas)). La CNIL a précisé ce partage dans une fiche du 28 mai 2026 ([Donneespersonnelles.fr](https://www.donneespersonnelles.fr/rgpd-editeur-saas)).
- Pour vos propres traitements (comptes utilisateurs, facturation de l'abonnement, prospection, statistiques d'usage), vous êtes **responsable de traitement**.

| Document | Obligatoire ? | Contenu clé |
| --- | --- | --- |
| Mentions légales (site et application) | Oui, LCEN article 1-1 ([LegalPlace](https://www.legalplace.fr/guides/mentions-legales/)) | Identité de l'éditeur, adresse, SIREN, contact, hébergeur. Absence punie jusqu'à 1 an de prison et 75 000 € d'amende ([Captain Contrat](https://www.captaincontrat.com/contrats-commerciaux-cgv/cgv-cgu-cga/tout-savoir-sur-les-conditions-generales-dutilisation-dune-application-mobile)) |
| Politique de confidentialité | Oui (RGPD) | Données collectées, finalités, durées de conservation, droits des personnes, sous-traitants |
| Registre des traitements | Oui, article 30(2) pour un sous-traitant | Liste des traitements faits pour vos clients |
| CGU | Non obligatoires, mais recommandées ([Indy](https://www.indy.fr/guide/creation-entreprise/etapes/cgu-application-mobile/)) | Règles d'usage, limitation de responsabilité |
| CGV / contrat SaaS | Oui dès que vous vendez | Abonnement, disponibilité, support, réversibilité des données, responsabilité |
| Accord de sous-traitance (DPA) | Oui, article 28 du RGPD, annexé au contrat ([Swim Legal](https://www.swim.legal/blog/modele-contrat-saas-rgpd)) | Objet et durée du traitement, sécurité, confidentialité, sous-traitants ultérieurs, violations, sort des données en fin de contrat |

**Vos propres sous-traitants**

- Liste publique et à jour : Supabase (hébergement), service de dictée/IA, envoi d'e-mails et de SMS, puis paiement en V3. Chaque ajout est signalé aux clients, qui peuvent s'y opposer ([Orbiq](https://www.orbiqhq.com/fr/reglementations-ue/rgpd-article-28)).
- Signer le DPA de Supabase, disponible en libre-service ([Supabase](https://supabase.com/docs/guides/security/gdpr-compliance)).
- Supabase est une société américaine : même en région UE, certains clients pourront demander un hébergeur européen. Garder le code portable (Postgres standard) laisse cette porte ouverte.
- Dictée vocale : choisir un fournisseur qui ne réutilise pas les enregistrements pour entraîner ses modèles.

**Points propres à votre application**

- **Responsabilité sécurité** : clause claire dans les CGV. L'application aide à respecter la réglementation, mais ne remplace ni l'évaluation des risques ni la décision de l'employeur. Une assurance RC professionnelle d'éditeur est à envisager.
- **Géolocalisation des salariés** : enregistrer la position seulement au moment d'une photo, d'une signature ou d'une checklist, jamais en suivi continu, et en informer les salariés. Recommandation de prudence, à faire confirmer.
- **Clients finaux des entreprises** (particuliers qui reçoivent un devis) : fournir à vos clients un texte d'information prêt à intégrer à leurs devis.
- **Durées de conservation** : à fixer par type de document (devis, fiches d'intervention, registre EPI, photos) avec un juriste, et à appliquer automatiquement dans l'application.

## Modèle économique

L'abonnement est reporté : rien n'est facturé pendant le développement et la phase pilote. Une seule précaution dès maintenant : le champ « formule » sur chaque entreprise, pour activer l'abonnement plus tard sans refonte.

| Formule (provisoire) | Utilisateurs | Prix HT / mois |
| --- | --- | --- |
| Carnet cordiste | 1 technicien | Gratuit |
| Solo | 1 à 2 | 19 € |
| Équipe | jusqu'à 10 | 59 € |
| Entreprise | jusqu'à 30 | 129 € |
| Au-delà de 30 | – | Sur devis |

Repère de marché : Kleyk facture 7 € HT par personne et par mois pour la seule fiche d'intervention ([Kleyk](https://www.kleyk.com)).

**À traiter avant le premier client payant**

- [ ] Paiement en ligne (Stripe) sur le site web.
- [ ] Vérifier les règles d'Apple et de Google sur les abonnements vendus hors application.
- [ ] Tarif fondateur pour les entreprises pilotes.

## Plan d'action

Critère de réussite du test : faire tous ses devis d'élagage avec l'application pendant un mois, sans revenir au papier.

**Avant de coder**

- [ ] Calibrer la grille de prix sur 3 à 5 devis réunionnais réels.
- [ ] Faire relire le modèle de devis par un comptable (mentions, TVA, franchise).
- [ ] Faire passer le questionnaire de validation à 2 ou 3 entreprises.
- [ ] Choisir le nom, vérifier qu'il est libre (INPI, nom de domaine, stores), déposer la marque.
- [ ] Fixer le temps disponible par semaine et le budget mensuel.
- [ ] Ouvrir les comptes : GitHub, Supabase (région UE), Expo, développeur Apple et Google.

**Pendant la V1**

- [ ] Créer le fichier de spécifications (CLAUDE.md) à partir de ce cahier des charges.
- [ ] Poser d'abord le socle : base locale et synchronisation, entreprises et rôles, photos.
- [ ] Construire le parcours visite, devis, fiche d'intervention.
- [ ] Ajouter le fil du chantier et le rapport client.
- [ ] Utiliser l'application sur ses propres chantiers dès que le devis fonctionne.

**Avant d'ouvrir à d'autres entreprises**

- [ ] Mentions légales, politique de confidentialité, CGU en ligne.
- [ ] CGV et accord de sous-traitance relus par un avocat.
- [ ] DPA Supabase signé, liste des sous-traitants publiée.
- [ ] Registre des traitements tenu à jour.

## Sources

- [Kraaft – La Fabrique du Net](https://www.lafabriquedunet.fr/logiciel/kraaft)
- [Kleyk](https://www.kleyk.com)
- [RopeLogix](https://ropelogix-marketing.pages.dev/)
- [ePPEcentre by Petzl – App Store](https://apps.apple.com/ph/app/id6466090005)
- [INRS – Travail encordé](https://www.inrs.fr/accueil/risques/chutes-hauteur/travail-encorde-acces-positionnement-cordes.html)
- [OPPBTP – Article R4323-89](https://content.preventionbtp.fr/legal_prevention/4VJoQAwc7Q9dQ4B4JkPxs4)
- [Éditions Tissot – Travaux sur cordes](https://www.editions-tissot.fr/actualite/droit-du-travail/travaux-du-btp-realises-au-moyen-de-cordes-regles-applicables)
- [Inforisque – EPI contre les chutes de hauteur](https://dev.inforisque.fr/fiches-pratiques/documents/EPI-contre-chutes-hauteur-dans-travail-2020.pdf)
- [MSA – Fiche d'intervention élagage](https://ssa.msa.fr/wp-content/uploads/2023/12/12350_Notice_fiche_intervention_WEB.pdf)
- [Pennylane – Mentions obligatoires d'un devis](https://www.pennylane.com/fr/fiches-pratiques/facturation/quelles-sont-les-16-mentions-obligatoires-a-mettre-sur-vos-devis)
- [impots.gouv.fr – TVA dans les DOM](https://www.impots.gouv.fr/portail/professionnel/questions/quels-sont-les-differents-taux-de-tva-applicables-dans-les-dom)
- [L'Essentiel de l'Éco – Facturation électronique](https://lessentieldeleco.fr/6447-independants-la-facturation-electronique-va-tout-changer-pour-vous/)
- [Supabase – GDPR compliance](https://supabase.com/docs/guides/security/gdpr-compliance)
- [Supabase – GDPR et régions](https://supabase.com/docs/guides/platform/gdpr)
- [Leto – RGPD et SaaS](https://www.leto.legal/guides/rgpd-et-saas)
- [Donneespersonnelles.fr – RGPD éditeur SaaS 2026](https://www.donneespersonnelles.fr/rgpd-editeur-saas)
- [Swim Legal – Contrat SaaS et DPA](https://www.swim.legal/blog/modele-contrat-saas-rgpd)
- [Orbiq – RGPD article 28](https://www.orbiqhq.com/fr/reglementations-ue/rgpd-article-28)
- [LegalPlace – Mentions légales](https://www.legalplace.fr/guides/mentions-legales/)
- [Captain Contrat – CGU d'une application mobile](https://www.captaincontrat.com/contrats-commerciaux-cgv/cgv-cgu-cga/tout-savoir-sur-les-conditions-generales-dutilisation-dune-application-mobile)
- [Indy – CGU application mobile](https://www.indy.fr/guide/creation-entreprise/etapes/cgu-application-mobile/)
