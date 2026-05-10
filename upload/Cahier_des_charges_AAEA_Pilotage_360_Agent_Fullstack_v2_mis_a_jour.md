# Cahier des charges complet — AAEA Pilotage 360

Version mise à jour : 15 modules officiels, axes stratégiques validés, stack technique cible limitée à Next.js 16 API, règles CRUD complètes et contrôle qualité anti-bugs.

Ce document est destiné à être uploadé à un agent IA fullstack afin de produire l’application de A à Z, module par module, sans déclarer une fonctionnalité terminée tant que les tests et la recette ne sont pas validés.

## 1. Nom recommandé de l’application

Nom recommandé : **AAEA Pilotage 360**.

Sous-titre : Plateforme intégrée de pilotage stratégique, PTA, MEAL, ACBF, performance et reporting institutionnel.

## 2. Finalité de l’application

L’application doit transformer le fichier maître PTA/ACBF/MEAL/Gantt/RACI/tableau de bord en une plateforme web institutionnelle centralisée. Elle doit permettre de piloter les PTA individuels, le PTA consolidé, les axes stratégiques, les livrables ACBF, les responsabilités RACI, le Gantt, les preuves, les rapports, les validations, les alertes et la performance institutionnelle.

- Gérer les PTA individuels des 28 membres de l’équipe.

- Consolider automatiquement les activités dans un PTA institutionnel unique.

- Suivre les cinq axes stratégiques validés de l’AAEA.

- Relier chaque activité aux domaines et livrables ACBF.

- Centraliser les preuves et sources de vérification.

- Produire des tableaux de bord et rapports automatiques.

- Renforcer la gouvernance, la redevabilité, la performance et la traçabilité.


## 3. Problème que l’application doit résoudre

Le suivi Excel est riche mais fragile : consolidation manuelle, risques d’erreurs, absence de workflow, preuves dispersées, tableaux de bord statiques, validation difficile, retards mal visibles et faible traçabilité. L’application doit devenir la source unique de vérité pour le pilotage institutionnel.

| Problème actuel | Solution attendue |
| --- | --- |
| Données dispersées dans plusieurs feuilles | Base applicative centralisée |
| Consolidation manuelle | PTA consolidé généré automatiquement |
| Validation non tracée | Workflow de validation et journal d’audit |
| Preuves dispersées | Bibliothèque documentaire liée aux activités et livrables |
| Retards difficiles à suivre | Alertes, Gantt et tableau de bord dynamique |
| CRUD incomplets ou API cassées | Définition stricte de terminé, tests et recette module par module |

## 4. Modules fonctionnels officiels à développer

La liste officielle contient 15 modules. Tous les modules qui manipulent des données doivent être CRUD : créer, lire, modifier, archiver/supprimer logiquement. Aucune suppression définitive ne doit être disponible hors super administration.

| N° | Module | Objectif | Objets CRUD principaux |
| --- | --- | --- | --- |
| 1 | Authentification et gestion des rôles | Sécuriser l’accès à l’application, gérer les comptes, les rôles, les permissions et les sessions. | Utilisateurs; rôles; permissions; sessions; profils; statuts actif/archivé |
| 2 | Administration organisationnelle AAEA | Gérer la structure institutionnelle de base : directions, unités, postes, membres de l’équipe et rattachements hiérarchiques. | Directions; unités; postes; membres; superviseurs; validateurs; codes PTA |
| 3 | Référentiel stratégique | Gérer les cinq axes stratégiques validés, leurs objectifs, résultats attendus, indicateurs et unités concernées. | Axes stratégiques; objectifs; résultats; indicateurs; unités concernées |
| 4 | Référentiel ACBF | Gérer les 14 domaines ACBF, les livrables attendus, les preuves attendues, les priorités et les statuts. | Domaines ACBF; livrables ACBF; preuves attendues; responsabilités; statuts de disponibilité |
| 5 | Gestion des PTA individuels | Permettre à chaque membre de créer, suivre, mettre à jour et soumettre ses activités PTA. | Activités; objectifs; tâches; livrables; dates; indicateurs; risques; contributeurs; preuves |
| 6 | PTA consolidé AAEA | Agréger automatiquement toutes les activités individuelles dans une vue institutionnelle consolidée. | Vue consolidée; filtres; regroupements; corrections autorisées; exports |
| 7 | Matrice RACI | Clarifier les responsabilités par activité ou livrable : Responsable, Autorité, Contributeurs et Informés. | RACI; responsables; validateurs; contributeurs; informés; liens activités/livrables |
| 8 | Gantt dynamique | Générer automatiquement le calendrier d’exécution d’avril à décembre 2026 à partir des dates des activités. | Planning; jalons; vues par axe, direction, responsable, priorité et statut |
| 9 | Tableau de bord | Afficher les KPI, taux d’avancement, retards, risques, preuves, activités par axe et par direction. | Indicateurs; graphiques; vues par rôle; synthèses; seuils d’alerte |
| 10 | Gestion documentaire et preuves | Centraliser les rapports, PV, photos, fichiers, liens et sources de vérification. | Fichiers; liens; versions; validations; preuves liées aux activités et livrables |
| 11 | Reporting automatique | Générer les rapports mensuels, trimestriels, ACBF, par axe, par direction et annuels. | Modèles de rapports; rapports générés; validations; exports |
| 12 | Notifications et alertes | Alerter les utilisateurs sur les retards, validations, preuves manquantes, échéances et corrections demandées. | Notifications; alertes; rappels; destinataires; statut lu/non lu |
| 13 | Journal d’audit | Assurer la traçabilité de toutes les actions sensibles dans l’application. | Logs; actions; utilisateurs; ancienne valeur; nouvelle valeur; date; entité concernée |
| 14 | Import Excel | Importer le fichier maître PTA/ACBF/MEAL existant et transformer les feuilles Excel en données applicatives. | Fichiers importés; mapping; erreurs; prévisualisation; rapport d’import |
| 15 | Exports PDF, Excel et Word | Permettre l’export des PTA, tableaux de bord, rapports, Gantt, RACI et preuves. | Exports; modèles; fichiers générés; historique des exports |

### Ordre réel de développement recommandé

| Ordre | Module | Raison |
| --- | --- | --- |
| 1 | Authentification et gestion des rôles | Base de sécurité et permissions |
| 2 | Administration organisationnelle AAEA | Nécessaire pour directions, équipe, codes PTA et validateurs |
| 3 | Référentiel stratégique | Nécessaire avant rattachement des activités aux axes |
| 4 | Référentiel ACBF | Nécessaire avant rattachement aux domaines et livrables |
| 5 | Gestion des PTA individuels | Cœur opérationnel |
| 6 | PTA consolidé AAEA | Dépend des activités individuelles |
| 7 | Gestion documentaire et preuves | Les activités doivent recevoir des preuves |
| 8 | Matrice RACI | Liée aux activités et livrables |
| 9 | Gantt dynamique | Généré depuis les dates |
| 10 | Tableau de bord | Généré depuis activités, statuts, preuves et risques |
| 11 | Notifications et alertes | Dépend des dates, statuts et validations |
| 12 | Reporting automatique | Dépend des PTA, preuves, dashboard et RACI |
| 13 | Exports PDF, Excel et Word | Dépend des rapports et vues consolidées |
| 14 | Import Excel | À ajouter après stabilisation du modèle |
| 15 | Journal d’audit | À intégrer progressivement et finaliser avant production |

## 5. Axes stratégiques officiels

| Code | Axe | Objectif | Résultats attendus | Indicateurs | Unités concernées |
| --- | --- | --- | --- | --- | --- |
| AXE 1 | Renforcement des capacités | Renforcer durablement les compétences techniques, managériales, institutionnelles et de plaidoyer des acteurs WASH. | Professionnalisation accrue, formations certifiantes, mentorat, apprentissage entre pairs et bonnes pratiques diffusées. | Nombre de professionnels formés/certifiés; taux de satisfaction; nombre de formations; nombre de bonnes pratiques diffusées. | DSMP; Coordinateurs; Connaissances; RH; MEAL |
| AXE 2 | Développement des services | Structurer et déployer une offre intégrée de services à forte valeur ajoutée pour les membres, institutions et partenaires. | Utilisation accrue des services, satisfaction renforcée, amélioration des performances des institutions appuyées. | Taux d’utilisation des services; nombre d’institutions accompagnées; satisfaction; nombre de services déployés. | DSMP; Services aux membres; Événements; Sponsoring; MEAL; Numérique; Communication |
| AXE 3 | Données et innovation | Faire de la donnée, de l’innovation et du numérique des leviers de performance, redevabilité et plaidoyer sectoriel. | Données WASH fiables, plateformes numériques sécurisées, tableaux de bord, rapports sectoriels et décisions fondées sur les données. | Nombre d’outils numériques opérationnels; fréquence des tableaux de bord; nombre de rapports produits; niveau d’utilisation des données. | MEAL; Numérique; DEx; DSMP; Communication; Coordinateurs |
| AXE 4 | Développement de partenariat | Consolider, structurer et élargir les partenariats institutionnels, techniques et financiers de l’AAEA. | Portefeuille de partenariats diversifié, ressources mobilisées, projets conjoints et collaborations structurées. | Nombre de partenariats actifs; ressources mobilisées; projets conjoints; MoU signés; niveau d’alignement stratégique. | DEx; DSMP; Sponsoring; Coordinateurs; DAF; Communication |
| AXE 5 | Gouvernance et durabilité institutionnelle | Renforcer la gouvernance, la conformité, la performance organisationnelle et la durabilité financière de l’AAEA. | Gouvernance modernisée, autonomie financière renforcée, pilotage stratégique amélioré, risques maîtrisés. | Taux d’exécution du plan stratégique; audits réalisés; rapports qualité; conformité; ressources propres; risques suivis. | DEx; DAF; Conformité & Performance; RH; Logistique; Finance; MEAL |

## 6. Domaines ACBF officiels

| N° | Domaine ACBF |
| --- | --- |
| 1 | Governance & Organizational Structure |
| 2 | Strategic & Operational Planning |
| 3 | Program & Project Management |
| 4 | Monitoring, Evaluation, Accountability & Learning — MEAL |
| 5 | Human Resources & Leadership |
| 6 | Financial Management & Compliance |
| 7 | Administrative & Operational Systems |
| 8 | ICT, Digital Systems & Infrastructure |
| 9 | Communications, Advocacy & Visibility |
| 10 | Membership & Stakeholder Management |
| 11 | Sustainability, Resource Mobilization & Partnerships |
| 12 | Legal & Compliance |
| 13 | Research and Knowledge Management |
| 14 | Optional / Supporting Documents |

## 7. Équipe AAEA et codes PTA

| Code PTA | Nom et prénoms | Poste | Direction / unité |
| --- | --- | --- | --- |
| DEX | François Olivier Gosso | Directeur Exécutif | Cabinet Direction Exécutive |
| DSMP | Moussa Seck | Directeur Services aux Membres et des Programmes | Direction des Services aux Membres et des Programmes |
| DAF | Olivier Gnanpa | Directeur Administration et Finance | Direction Administrative et Financière |
| CONF | Christian ZOCLI | Responsable Conformité & Performance | Cabinet Direction Exécutive |
| MEAL | Alexandre KANGA | Responsable Données et Suivi-évaluation | Cabinet Direction Exécutive |
| NUM | Nicaise KOUAKOU | Responsable Développement Numérique et Innovation | Cabinet Direction Exécutive |
| COM | Stephanie Nzickonan | Responsable Communication | Cabinet Direction Exécutive |
| ADX | Mariam Ba Coulibaly | Assistante du Directeur Exécutif | Cabinet Direction Exécutive |
| ASS | Valentin Yao | Coordonnateur Senior Assainissement | Direction des Services aux Membres et des Programmes |
| EAU | Dr Hemez Kouassi | Coordonnateur Eau | Direction des Services aux Membres et des Programmes |
| GEN | Dr Leticia Ackun | Coordonnatrice Senior Genre et Réseaux | Direction des Services aux Membres et des Programmes |
| KNOW | Djalia Umutangampundu | Responsable projets, gestion et partage de connaissances | Direction des Services aux Membres et des Programmes |
| MEMB | Micheline Lawson | Responsable événements et services aux membres | Direction des Services aux Membres et des Programmes |
| SPON | Kalou Aimé Digbeu | Responsable Expositions et sponsoring | Direction des Services aux Membres et des Programmes |
| PROJASS | Julian Musime | Chargé de projets assainissement | Direction des Services aux Membres et des Programmes |
| ASM | Khady Dankoulou | Assistante DSMP Services aux Membres | Direction des Services aux Membres et des Programmes |
| ASPP | Benedicte Kanga | Assistante DSMP Programmes, Projets et Partenariats | Direction des Services aux Membres et des Programmes |
| RH | Emmanuel Kouadio | Responsable des ressources humaines | Direction Administrative et Financière |
| ARH | Corine Assienin | Assistante Ressources Humaines | Direction Administrative et Financière |
| FIN | Sonia Nguessan | Responsable comptable et finance | Direction Administrative et Financière |
| TRES | Vanessa Tihi | Comptable Senior en charge de la Trésorerie | Direction Administrative et Financière |
| ACF | Franc Mabio | Assistant comptable | Direction Administrative et Financière |
| ATRES | Edwidge Gueu | Assistante comptable volet trésorerie | Direction Administrative et Financière |
| AGR | Théodora Kouakou | Assistante comptable services aux membres et AGR | Direction Administrative et Financière |
| LOG | Amos Yao | Responsable Logistique et Achats | Direction Administrative et Financière |
| CLOG | Abdoulaye Fadiga | Chargé Logistique et Achats | Direction Administrative et Financière |
| CHAUF1 | Mathieu Kouakou | Chauffeur | Direction Administrative et Financière |
| CHAUF2 | Dominique Diézahi | Chauffeur | Direction Administrative et Financière |

## 8. Règles CRUD transversales

- Chaque entité doit avoir Create, Read list, Read detail, Update, Archive/Soft delete lorsque pertinent.

- Les données archivées ne doivent pas apparaître par défaut dans les listes.

- Chaque formulaire doit valider les champs obligatoires avant enregistrement.

- Chaque route API doit contrôler les permissions.

- Chaque action sensible doit alimenter le journal d’audit.

- Chaque module doit être testé avec données réelles ou seeds réalistes.

- Aucun bouton frontend ne doit exister sans API connectée et testée.

- Une activité validée doit être verrouillée sauf réouverture par validateur ou administrateur.


## 9. Statuts et priorités

| Type | Valeurs autorisées |
| --- | --- |
| Statuts des activités | Non démarré; En cours; Réalisé; En retard; Suspendu; À reprogrammer |
| Priorités | Haute; Moyenne; Basse |
| Directions | Cabinet Direction Exécutive; Direction des Services aux Membres et des Programmes; Direction Administrative et Financière |

## 10. Champs obligatoires d’une activité PTA

| Champ |
| --- |
| Code PTA |
| Responsable principal |
| Direction / unité |
| Axe stratégique principal |
| Axe secondaire |
| Domaine ACBF |
| Livrable ACBF associé |
| Objectif annuel |
| Activité PTA |
| Tâches détaillées |
| Livrable attendu |
| Contributeurs |
| Validateur |
| Date début |
| Date fin |
| Priorité |
| Indicateur de performance |
| Source de vérification |
| Statut |
| Taux d’avancement |
| Risque / contrainte |
| Commentaires |

## 11. Stack technique cible

La stack technique à mentionner dans le cadrage est volontairement limitée à :

**Next.js 16 API**

L’agent fullstack doit développer les routes API sécurisées, les interfaces connectées, la persistance des données, les validations, les tests, les exports et les workflows en cohérence avec cette cible technique.

## 12. Schéma simplifié de la base de données

L’agent doit proposer et implémenter un modèle de données cohérent. Les tables minimales attendues sont :

- users

- roles

- permissions

- sessions

- departments

- staff_members

- strategic_axes

- acbf_domains

- acbf_deliverables

- annual_workplans

- activities

- activity_contributors

- evidence_files

- raci_matrix

- gantt_items

- dashboard_indicators

- report_templates

- reports

- notifications

- audit_logs

- imports

- exports

- settings


### Champs minimaux de la table activities

| Champ | Description |
| --- | --- |
| id | À implémenter et tester |
| activity_code | À implémenter et tester |
| responsible_id | À implémenter et tester |
| department_id | À implémenter et tester |
| primary_axis_id | À implémenter et tester |
| secondary_axis_id | À implémenter et tester |
| acbf_domain_id | À implémenter et tester |
| acbf_deliverable_id | À implémenter et tester |
| annual_objective | À implémenter et tester |
| title | À implémenter et tester |
| detailed_tasks | À implémenter et tester |
| expected_deliverable | À implémenter et tester |
| validator_id | À implémenter et tester |
| start_date | À implémenter et tester |
| end_date | À implémenter et tester |
| priority | À implémenter et tester |
| performance_indicator | À implémenter et tester |
| verification_source | À implémenter et tester |
| status | À implémenter et tester |
| progress_rate | À implémenter et tester |
| risk_description | À implémenter et tester |
| comments | À implémenter et tester |
| validation_status | À implémenter et tester |
| created_by | À implémenter et tester |
| updated_by | À implémenter et tester |
| created_at | À implémenter et tester |
| updated_at | À implémenter et tester |
| deleted_at | À implémenter et tester |

## 13. Parcours utilisateurs principaux

### Directeur Exécutif

- Consulter le tableau de bord global.

- Voir l’avancement par direction et par axe.

- Consulter les retards, risques et livrables critiques.

- Valider les rapports institutionnels.

- Télécharger les synthèses et exports.


### Responsable MEAL

- Contrôler le PTA consolidé.

- Vérifier indicateurs, sources et preuves.

- Générer les rapports mensuels et trimestriels.

- Identifier les preuves manquantes et retards.

- Préparer les synthèses de pilotage.


### Responsable individuel

- Consulter son PTA.

- Créer ou modifier ses activités.

- Mettre à jour statuts et taux d’avancement.

- Joindre des preuves.

- Soumettre à validation.


### Validateur

- Recevoir une notification.

- Vérifier l’activité et les preuves.

- Approuver, rejeter ou demander correction.

- Ajouter un commentaire.

- Verrouiller l’activité validée.


## 14. Méthode de construction par l’agent IA fullstack

- Ne jamais développer toute l’application en une seule étape.

- Développer module par module selon l’ordre recommandé.

- Pour chaque module : modèle, API, UI, permissions, validations, tests, rapport de validation.

- Ne pas passer au module suivant sans validation humaine du module actuel.

- Créer des seeds réalistes : axes, domaines ACBF, équipe, rôles, activités exemples.

- Mettre en place une recette fonctionnelle complète en staging avant production.


## 15. MVP recommandé

### MVP 1 — Version minimale utile

- Authentification.

- Administration organisationnelle.

- Référentiel stratégique.

- Référentiel ACBF.

- PTA individuels.

- PTA consolidé.

- Dashboard simple.

- Gantt simple.

- Exports simples.


### MVP 2 — Version institutionnelle

- Workflow de validation.

- Gestion documentaire et preuves.

- RACI interactive.

- Notifications.

- Alertes de retard.

- Rapports mensuels et trimestriels.

- Journal d’audit.

- Gestion des risques.


### MVP 3 — Version avancée

- Assistant IA interne.

- Recommandations MEAL.

- Analyse des retards.

- Observatoire WASH.

- Benchmarking.

- Portail membres.

- Modules formations, événements et partenariats.

- Export PowerPoint automatique.


## 16. Définition de terminé

Un module n’est pas terminé parce que le code est généré. Un module est terminé uniquement si les API, interfaces, CRUD, permissions, validations, tests et scénarios utilisateurs fonctionnent réellement.

| Contrôle obligatoire | Statut attendu |
| --- | --- |
| Modèle de données créé | OK |
| Migration exécutée | OK |
| Seeds disponibles | OK |
| API Create testée | OK |
| API Read list testée | OK |
| API Read detail testée | OK |
| API Update testée | OK |
| API Archive testée | OK |
| Formulaire création testé | OK |
| Formulaire édition testé | OK |
| Liste frontend testée | OK |
| Détail frontend testé | OK |
| Filtres testés | OK |
| Permissions testées | OK |
| Validation des champs testée | OK |
| Gestion des erreurs testée | OK |
| Journal d’audit testé | OK |
| Tests automatiques passés | OK |
| Bugs connus documentés | OK |

## 17. Scénarios de recette fonctionnelle

- Créer une activité PTA, la lier à AXE 3, à un domaine ACBF, puis vérifier son apparition dans le PTA individuel, le PTA consolidé, le Gantt et le tableau de bord.

- Soumettre une activité à validation, vérifier les preuves, valider, puis contrôler le verrouillage et le journal d’audit.

- Créer une activité en retard, vérifier son classement automatique dans les alertes, le dashboard et le rapport des retards.

- Exporter un PTA consolidé en Excel, un rapport en Word/PDF et un Gantt en fichier exploitable.

- Tester les droits : un lecteur ne modifie rien, un responsable modifie son périmètre, un validateur valide son périmètre, un administrateur gère tout.


## 18. Recommandation stratégique

Commencer par un MVP interne robuste centré sur PTA + MEAL + ACBF + Dashboard + Preuves + Reporting. Ensuite seulement, élargir vers la plateforme intelligente : observatoire WASH, benchmarking, portail membres, formations, événements, partenariats et IA.


## 19. Prompt maître à donner à l’agent fullstack

```text
Tu es un agent IA fullstack senior chargé de construire l’application AAEA Pilotage 360.

OBJECTIF GÉNÉRAL
Construire une application web institutionnelle complète, sécurisée, modulaire et entièrement CRUD permettant de transformer le fichier maître PTA/ACBF/MEAL/Gantt/RACI/tableau de bord de l’AAEA en une plateforme numérique de pilotage institutionnel.

STACK TECHNIQUE CIBLE
Next.js 16 API

RÈGLE FONDAMENTALE
Tous les modules qui manipulent des données doivent être CRUD : Create, Read list, Read detail, Update, Archive/Soft delete. Aucune suppression définitive ne doit être proposée hors super administration. Aucun module ne peut être déclaré terminé sans API fonctionnelle, interface connectée, persistance en base, contrôle des droits, tests CRUD, gestion des erreurs et validation utilisateur.

MODULES OFFICIELS À DÉVELOPPER
1. Authentification et gestion des rôles
2. Administration organisationnelle AAEA
3. Référentiel stratégique
4. Référentiel ACBF
5. Gestion des PTA individuels
6. PTA consolidé AAEA
7. Matrice RACI
8. Gantt dynamique
9. Tableau de bord
10. Gestion documentaire et preuves
11. Reporting automatique
12. Notifications et alertes
13. Journal d’audit
14. Import Excel
15. Exports PDF, Excel et Word

AXES STRATÉGIQUES OFFICIELS À UTILISER
AXE 1 — Renforcement des capacités : renforcer durablement les compétences techniques, managériales, institutionnelles et de plaidoyer des acteurs WASH.
AXE 2 — Développement des services : structurer et déployer une offre intégrée de services à forte valeur ajoutée pour les membres, institutions et partenaires.
AXE 3 — Données et innovation : faire de la donnée, de l’innovation et du numérique des leviers de performance, redevabilité et plaidoyer sectoriel.
AXE 4 — Développement de partenariat : consolider, structurer et élargir les partenariats institutionnels, techniques et financiers de l’AAEA.
AXE 5 — Gouvernance et durabilité institutionnelle : renforcer la gouvernance, la conformité, la performance organisationnelle et la durabilité financière de l’AAEA.

DOMAINES ACBF À UTILISER
1. Governance & Organizational Structure
2. Strategic & Operational Planning
3. Program & Project Management
4. Monitoring, Evaluation, Accountability & Learning — MEAL
5. Human Resources & Leadership
6. Financial Management & Compliance
7. Administrative & Operational Systems
8. ICT, Digital Systems & Infrastructure
9. Communications, Advocacy & Visibility
10. Membership & Stakeholder Management
11. Sustainability, Resource Mobilization & Partnerships
12. Legal & Compliance
13. Research and Knowledge Management
14. Optional / Supporting Documents

DIRECTIONS AUTORISÉES
1. Cabinet Direction Exécutive
2. Direction des Services aux Membres et des Programmes
3. Direction Administrative et Financière

STATUTS DES ACTIVITÉS
Non démarré; En cours; Réalisé; En retard; Suspendu; À reprogrammer.

PRIORITÉS
Haute; Moyenne; Basse.

MÉTHODE OBLIGATOIRE
1. Lire le cahier des charges complet avant de coder.
2. Ne pas développer toute l’application en une seule fois.
3. Commencer par le module 1 uniquement.
4. Pour chaque module, produire : modèle de données, routes API, écrans frontend, règles de permissions, validations, tests, matrice CRUD et rapport de validation.
5. Ne pas passer au module suivant sans validation humaine explicite.
6. Chaque route API doit être testée.
7. Chaque bouton frontend doit être connecté à une vraie API.
8. Chaque formulaire doit valider les champs obligatoires.
9. Chaque action sensible doit être journalisée dans audit_logs.
10. Chaque activité validée doit être verrouillée.
11. Les dashboards doivent être calculés depuis les données réelles.
12. Les imports doivent produire un rapport d’erreurs.
13. Les exports doivent être testés avec des données réelles.
14. Les données archivées ne doivent pas apparaître par défaut.
15. Tu n’as pas le droit d’écrire “terminé” si une route API n’est pas testée, si un CRUD manque, si un bouton n’est pas connecté, si une permission n’est pas vérifiée ou si les tests ne passent pas.

DÉFINITION DE TERMINÉ POUR CHAQUE MODULE
Pour chaque module, fournir obligatoirement :
A. Fonctionnalités développées
B. Modèle de données
C. Routes API
D. Écrans frontend
E. Matrice CRUD
F. Règles de permission
G. Tests effectués
H. Résultats des tests
I. Bugs corrigés
J. Bugs restants, s’il y en a
K. Décision : validé ou non validé

COMMENCE MAINTENANT PAR LE MODULE 1 — Authentification et gestion des rôles.
Ne développe pas les autres modules tant que le module 1 n’est pas validé.
```
