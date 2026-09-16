# Prompt Cursor — préparation complète de German Academy pour la démonstration et le déploiement

Tu es l’ingénieur principal responsable de finaliser cette application **German Academy** pour une démonstration au chef de projet demain et pour un déploiement fiable. Travaille directement dans le dépôt actuel. Commence par lire `AGENTS.md`, `README.md`, `roadmap.md`, `docs/`, `package.json`, les routes, services, migrations Supabase et modifications Git locales. Respecte les changements non commités existants. Ne réécris jamais l’historique Git, ne force-push pas et n’utilise ni rebase ni amend sur des commits déjà publiés, car le projet est synchronisé avec Lovable.

Ne te limite pas à proposer un plan : inspecte, implémente, teste et termine tout ce qui est raisonnablement nécessaire pour obtenir une application cohérente, démontrable et déployable. Avance par petites étapes sûres et conserve toujours une application fonctionnelle. Ne remplace pas l’architecture existante si elle peut être corrigée. Utilise React 19, TanStack Start, React Query, Supabase, TypeScript et les composants UI déjà présents.

## Objectif produit

Livrer une plateforme centrale pour une académie de langues couvrant :

- administration des étudiants, professeurs, classes, cours et comptes ;
- authentification par e-mail, confirmation, connexion et récupération du mot de passe ;
- attribution des étudiants et classes aux professeurs ;
- cours, bibliothèque, documents, devoirs, présence et progression ;
- examens blancs pour chaque niveau ;
- réunions Jitsi avec chat et partage d’écran ;
- paiements manuels avec dépôt et validation d’un justificatif ;
- notifications d’impayés et rappels ;
- identité du centre et langues configurables ;
- stockage Supabase privé, contrôlé et économique.

L’application doit présenter des données cohérentes, des états de chargement, des états vides, des erreurs compréhensibles et des confirmations pour les actions sensibles. Aucun bouton visible ne doit être factice pendant la démonstration. Si une intégration externe ne peut pas être finalisée sans identifiants, construis son adaptateur, son état de configuration et une expérience de repli claire, sans simuler une réussite.

## Priorité absolue : paiements manuels avec justificatif

Il n’y aura **aucun paiement en ligne** et aucune intégration Stripe ou passerelle bancaire.

Construis le parcours suivant comme source de vérité unique dans Supabase :

1. L’étudiant voit le montant, la période, la date d’échéance, les coordonnées/instructions de paiement et le statut de son abonnement.
2. Après avoir effectué un virement ou dépôt externe, il dépose un **avis d’opération** : PDF, JPG, PNG ou WebP, avec référence facultative, date de l’opération, montant déclaré et commentaire.
3. Le fichier est stocké dans un bucket Supabase privé avec limite de taille, chemin non devinable et accès signé. L’étudiant ne peut lire que ses propres justificatifs. Le professeur n’y accède pas. L’administration peut les consulter.
4. La soumission crée une demande au statut `pending_review`. Elle ne donne jamais accès automatiquement.
5. L’administration dispose d’une file de vérification avec aperçu/téléchargement sécurisé, étudiant, période, montant attendu, montant déclaré, date, référence et historique.
6. L’administration peut marquer la demande `approved` ou `rejected`. Un rejet exige un motif visible par l’étudiant. Une approbation doit être transactionnelle et idempotente : elle marque le paiement comme payé, met à jour facture et abonnement, définit la période d’accès, crée une notification et écrit un audit log.
7. Tant que le justificatif est en attente ou rejeté, l’accès académique reste bloqué si l’abonnement n’est pas actif. Les pages administratives de profil, paiement et support restent accessibles afin que l’étudiant puisse corriger son dossier.
8. L’étudiant voit immédiatement le statut `À payer`, `En vérification`, `Payé`, `Rejeté` ou `En retard`, avec la raison du rejet et la possibilité de déposer un nouveau justificatif.
9. Supprime le parcours simulé `PaymentService.pay()`, les factures inventées dans `localStorage` et toute possibilité de modifier localement le statut d’abonnement. L’accès doit provenir exclusivement de Supabase.
10. Prévois les protections contre double validation, double justificatif actif, changement de fichier après validation et accès à un fichier appartenant à un autre étudiant.

Crée les migrations additives nécessaires. Ne modifie pas rétroactivement les migrations déjà appliquées. Mets à jour les types générés ou les types applicatifs, services, query keys, hooks, écrans et politiques RLS. Utilise une fonction SQL/RPC sécurisée pour l’approbation et le rejet. Les fonctions `SECURITY DEFINER` doivent fixer `search_path`, vérifier explicitement le rôle administrateur et révoquer l’exécution publique.

## Gestion des comptes et autorisations

- Le public ne peut créer qu’un compte étudiant.
- Seule l’administration peut créer un compte professeur ou administrateur.
- La création administrative d’un utilisateur Auth doit passer par une Supabase Edge Function utilisant la clé de service uniquement côté serveur.
- L’administration peut suspendre, réactiver, archiver et demander la suppression d’un compte.
- Favorise l’archivage pour préserver paiements, audits et historique scolaire. Une suppression définitive doit être explicite, confirmée et compatible avec les contraintes de conservation.
- Un professeur ne peut consulter que ses classes, étudiants, devoirs, présences et réunions attribués.
- Un étudiant ne peut consulter que ses propres données et les contenus auxquels son niveau, sa classe et son abonnement donnent accès.
- Corrige les politiques RLS dont le `WITH CHECK` permet à n’importe quel professeur de créer un devoir ou une séance de présence pour une classe non attribuée.
- Ajoute des tests RLS avec au minimum deux étudiants, deux professeurs et deux classes afin de prouver l’isolation.

## Fonctionnalités à rendre intégralement démontrables

### Administration

- Dashboard avec étudiants actifs, abonnements à vérifier, impayés, classes, réunions à venir et stockage utilisé.
- CRUD cohérent des étudiants, professeurs, classes, cours et inscriptions.
- Recherche, filtres, pagination raisonnable, états vides et messages de succès/erreur.
- Consultation 360° d’un étudiant : identité, classe, niveau, paiement, accès, devoirs, présence, progression et examens.
- Journal d’audit pour les actions sensibles.

### Professeur

- Liste limitée aux élèves et classes attribués.
- Gestion des présences, devoirs, corrections, ressources et sessions Jitsi de ses classes.
- Aucun accès aux justificatifs bancaires ni aux données financières confidentielles.

### Étudiant

- Dashboard cohérent avec niveau, classe, progression, prochaines échéances et réunions.
- Consultation des cours, documents, bibliothèque, devoirs, résultats et examens accessibles.
- Blocage académique clair lorsque l’abonnement est inactif, sans bloquer paiement, profil et assistance.

### Jitsi et enregistrements

- Les réunions réelles doivent permettre chat et partage d’écran.
- Finalise le chemin JaaS/JWT via Edge Function si les secrets sont disponibles. Aucun secret dans `VITE_*`.
- Pour l’enregistrement, prépare un modèle et un service propres : session, URL/objet de stockage, durée, taille, date d’expiration et statut.
- Les membres de la classe peuvent consulter un enregistrement autorisé. Seule l’administration peut le supprimer.
- Si le fournisseur d’enregistrement n’est pas configuré, affiche clairement « enregistrement non configuré » et masque les actions impossibles. Ne prétends jamais qu’une réunion est enregistrée.

### Bibliothèque et annonces

- Organise le contenu avec des catégories explicites : cours, livres, PDF, audio/vidéo, offres d’emploi, démarches administratives, universités, Ausbildung, travail et annonces générales.
- Ajoute publication, expiration, visibilité, niveau, langue, auteur et pièce jointe.
- Les contenus expirés ne doivent plus apparaître aux étudiants.

### E-mail et WhatsApp

- Conserve les notifications internes comme canal toujours disponible.
- Prépare une file d’envoi avec modèle, canal, destinataire, statut, nombre de tentatives, erreur et horodatage.
- Les rappels d’impayés doivent être idempotents et respecter les préférences de notification.
- Branche l’e-mail ou WhatsApp seulement si les identifiants fournisseur existent. Sinon, fournis un adaptateur clairement non configuré et documente les variables requises.
- Aucun succès d’envoi fictif.

### Identité et langues

- L’administration peut modifier le nom, le logo et les informations publiques du centre.
- Le logo est stocké proprement et le changement apparaît dans toute l’application.
- Centralise les traductions. Les langues activées viennent des paramètres, avec français comme repli fiable.
- Préserve correctement RTL pour l’arabe et prépare l’ajout de l’allemand et de l’espagnol sans recopier tous les composants.

## Stockage Supabase

- Tous les buckets sensibles restent privés.
- Utilise des URL signées de courte durée.
- Applique limites de taille et types MIME côté bucket et côté interface.
- Définis une convention de chemins par centre, utilisateur, classe et ressource.
- Ajoute les métadonnées de taille et type lorsque nécessaire.
- Prévois quotas, rétention et purge des fichiers orphelins, justificatifs remplacés et anciens enregistrements.
- Évite les duplications et ne charge pas les vidéos complètes dans les listes.
- Ajoute une vue d’administration de la consommation du stockage si les informations sont accessibles.

## Architecture et qualité

- Supabase est l’unique source de vérité métier. `localStorage` ne doit conserver que des préférences UI non sensibles, comme la langue.
- Élimine les imports directs de `mock-data` dans les parcours réels. Les données de démonstration doivent être des seeds séparés et explicitement activés.
- Découpe les composants métier trop volumineux par domaine et responsabilité, sans refonte visuelle inutile.
- Standardise les services, erreurs, query keys, invalidations React Query et contrôles d’accès.
- Corrige les avertissements React Hooks qui peuvent produire des valeurs périmées.
- Ajoute une configuration QueryClient raisonnable pour retry, stale time et erreurs.
- Vérifie accessibilité clavier, contrastes, labels de formulaires, responsive mobile/desktop et RTL.
- Préserve le design premium actuel et uniformise les libellés encore en anglais lorsque l’interface est en français ou en arabe.

## MCP Supabase

Si le MCP Supabase est déjà disponible dans Cursor, utilise-le pour inspecter le schéma, vérifier les migrations, exécuter les contrôles et tester les politiques. Ne contourne jamais les migrations versionnées : toute modification structurelle doit aussi exister dans `supabase/migrations`.

S’il n’est pas configuré, ne bloque pas le travail. Prépare les fichiers nécessaires et ajoute dans la documentation une procédure courte pour le connecter au bon projet avec le principe du moindre privilège. Ne place jamais la clé `service_role` dans le code frontend, les logs ou un fichier commité.

## Validation obligatoire

Exécute et corrige, dans cet ordre :

1. installation reproductible avec le lockfile choisi par le projet ;
2. vérification TypeScript ;
3. lint, sans introduire de nouveaux avertissements ;
4. tests Vitest ;
5. tests SQL/RLS et migrations Supabase dans un environnement local ou de test ;
6. build de production ;
7. parcours manuels sur mobile et desktop pour étudiant, professeur et administration.

Ajoute des tests utiles pour les règles critiques : autorisations, approbation/rejet du justificatif, accès académique, examens et isolation des fichiers. Ne crée pas de tests qui recopient simplement l’implémentation.

## Scénario de démonstration final

Prépare des comptes de démonstration documentés et un jeu de données cohérent, sans secrets réels. Le scénario doit pouvoir montrer :

1. connexion administrateur ;
2. création ou consultation d’un professeur et d’un étudiant ;
3. attribution à une classe ;
4. étudiant bloqué pour paiement manquant ;
5. dépôt d’un avis d’opération par l’étudiant ;
6. justificatif visible dans la file administrative mais accès toujours bloqué ;
7. validation par l’administration ;
8. notification reçue et accès étudiant rétabli ;
9. professeur voyant uniquement l’étudiant attribué ;
10. création et ouverture d’une session Jitsi ;
11. consultation d’un document de bibliothèque ;
12. passage d’un examen blanc et affichage du résultat.

## Livrables attendus

- application corrigée et fonctionnelle ;
- migrations Supabase additives et politiques RLS ;
- Edge Functions nécessaires ou adaptateurs explicitement non configurés ;
- tests automatisés des règles critiques ;
- `.env.example` complet sans secret ;
- `docs/deployment-checklist.md` avec configuration Supabase, Auth URLs, Storage, Jitsi/JaaS, e-mail, WhatsApp, migrations, build, déploiement et rollback ;
- `docs/demo-script.md` avec le scénario de démonstration et les comptes de test ;
- mise à jour de `README.md` indiquant clairement ce qui est réel, ce qui nécessite un fournisseur externe et comment lancer le projet ;
- rapport final listant les fichiers modifiés, migrations ajoutées, validations réussies, limitations restantes et actions manuelles exactes avant déploiement.

Ne déploie pas, ne pousse pas et ne modifie pas le projet Supabase de production sans autorisation explicite. Prépare tout jusqu’au point où la seule étape restante est l’application contrôlée des migrations et le déploiement. Si le temps est limité, sécurise et termine d’abord le scénario de démonstration ci-dessus, puis les fonctionnalités secondaires. Ne marque jamais une fonctionnalité comme terminée si le bouton est décoratif, si les données sont mockées dans le parcours réel ou si l’action réussit seulement dans l’interface.
