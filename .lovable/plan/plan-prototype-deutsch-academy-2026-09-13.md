# Plan — Prototype Deutsch Academy

## Objectif

Construire un prototype EdTech premium, entièrement navigable, présentant les parcours étudiant, professeur et direction avec des données fictives réalistes et des interactions frontend visibles.

## Expérience et structure

- Créer un écran de connexion avec accès rapide aux trois rôles de démonstration.
- Mettre en place une structure commune responsive : barre latérale fixe sur desktop, menu mobile, en-tête, notifications et changement de rôle de démonstration.
- Appliquer une identité académique premium : blanc et gris clair, bleu profond, accents rouges discrets, typographie nette, cartes sobres et animations légères.
- Centraliser les composants réutilisables : boutons, cartes, badges, tableaux, onglets, formulaires, fenêtres, graphiques, calendriers et indicateurs de progression.

## Espace étudiant

- Dashboard complet avec progression A2, prochain cours, abonnement, présence, moyenne, devoirs, examen et activités.
- Parcours relié : cours → niveau A2 → modules → leçon → exercices → progression.
- Pages calendrier, classe en direct simulée, ressources filtrables, devoirs et dépôt simulé, examens et examen blanc multi-question avec résultat.
- Progression détaillée avec graphiques, paiements, messagerie et profil.
- Démonstration fonctionnelle du lien abonnement–accès : actif, en retard, suspendu, paiement simulé et restauration immédiate.

## Espace professeur

- Dashboard dédié avec classes, indicateurs et travail à corriger.
- Gestion d’une classe A2 : liste des étudiants, présence, notes et profils.
- Création de leçon simulée, correction de devoir avec note et commentaire, suivi des présences, calendrier, ressources, examens et messagerie.
- Limiter visuellement les données aux classes du professeur.

## Espace direction

- Dashboard exécutif avec étudiants, professeurs, classes, revenus, impayés, présence et examens, accompagné de graphiques.
- Gestion des étudiants avec filtres et vue Student 360 en onglets : profil, apprentissage, présence, devoirs, examens et paiements.
- Gestion des classes, niveaux, cours hiérarchiques, ressources, devoirs et calendrier.
- Gestion des examens : création, banque de questions, publication et déverrouillage visible côté étudiant.
- Gestion financière : paiements distincts des abonnements, relance, marquage payé, suspension, activation, extension et renouvellement.
- Pages professeurs, factures, rapports, paramètres, messages et journal d’audit avec contenu de démonstration crédible.

## Données et logique du prototype

- Fournir au moins 15 étudiants, 5 professeurs, 6 classes et des contenus A1 à B2.
- Définir les types métier et des services simulés séparés pour authentification, étudiants, cours, examens, paiements et notifications.
- Conserver les états de démonstration dans le navigateur pendant la session : rôle, abonnement, paiement, examen, publication, devoir et présence.
- Préparer les interfaces pour un futur branchement à une API REST et PostgreSQL, sans infrastructure complexe dans cette phase.

## Validation

- Vérifier les parcours clés sur desktop et mobile : connexion par rôle, cours, classe en direct, examen, paiement/restauration, correction professeur et Student 360.
- Vérifier les états vides, verrouillés, succès, erreurs simulées, tableaux défilants et menus mobiles.
- Ajouter des titres et descriptions adaptés aux pages principales.

## Limites de cette phase

- Vidéo, paiement, upload et messagerie restent des simulations frontend.
- Aucune donnée réelle, authentification de production ou intégration Google Meet/Jitsi n’est mise en place.
