# German Ascent Platform

Crée un prototype web premium, moderne et entièrement navigable d’une plateforme digitale pour un centre d’apprentissage de la langue allemande, de niveau A1 à C1.

IMPORTANT :
Ce projet est d’abord un prototype destiné à être présenté à un chef de projet. L’objectif est de démontrer clairement l’expérience utilisateur, les fonctionnalités principales, les workflows métier et la vision globale du produit.

Ne cherche pas à construire immédiatement une infrastructure de production complexe. Priorise :

qualité UI/UX ;

navigation fonctionnelle ;

cohérence métier ;

données de démonstration réalistes ;

interactions visibles ;

dashboards crédibles ;

architecture frontend propre et facilement extensible.

Le produit doit donner l’impression d’un véritable logiciel commercial prêt à être développé davantage.

==================================================

POSITIONNEMENT DU PRODUIT
==================================================

Nom provisoire de l’application :

"Deutsch Academy"

Créer une identité visuelle moderne, premium, professionnelle et académique.

L’application doit combiner :

LMS / plateforme d’apprentissage ;

gestion des étudiants ;

gestion des professeurs ;

gestion des classes ;

cours en ligne ;

documents pédagogiques ;

devoirs ;

progression ;

examens blancs ;

paiements mensuels ;

gestion des abonnements ;

administration du centre.

L'application doit couvrir le parcours :

A1 → A2 → B1 → B2

Elle doit être pensée comme le système numérique central d’un centre de langue allemande.

==================================================
2. STYLE UI/UX

Créer une interface très professionnelle et moderne.

Direction artistique :

fond principalement blanc / gris très clair ;

bleu profond comme couleur principale ;

quelques accents rouges très subtils inspirés de l’Allemagne, sans utiliser excessivement les couleurs du drapeau ;

typographie moderne, lisible et premium ;

beaucoup d’espace blanc ;

cartes élégantes ;

bordures fines ;

ombres très légères ;

icônes simples et cohérentes ;

animations discrètes ;

aucun design excessivement coloré ;

aucun effet 3D inutile ;

aucune interface "gaming".

Inspirations de qualité UX :

Notion

Linear

Stripe Dashboard

modern LMS platforms

premium education SaaS

L’application doit être responsive desktop/tablette/mobile.

Sidebar desktop fixe.

Navigation mobile avec menu adapté.

==================================================
3. AUTHENTIFICATION

Créer un écran Login professionnel.

Champs :

Email
Password

Bouton :

"Se connecter"

Lien :

"Mot de passe oublié ?"

Ajouter une possibilité de démonstration :

"Accéder à la démo"

avec trois comptes fictifs :

Student
Teacher
Director

Ces comptes doivent permettre de présenter rapidement les différents dashboards.

==================================================
4. ROLES

Créer trois rôles principaux :

STUDENT

TEACHER

DIRECTOR

Les interfaces doivent être différentes selon le rôle.

Ne pas afficher les fonctionnalités de direction à l’étudiant.

==================================================
5. STUDENT DASHBOARD

Créer un dashboard étudiant très propre.

Header :

"Hallo, Ahmed 👋"

Sous-titre :

"Continue your German learning journey."

Afficher :

Progression globale :

A2 — 68%

Carte "Current Level"

A2
Intermediate German

Carte "Next lesson"

"Deutsch im Alltag"

Aujourd'hui
18:00 – 19:30

Bouton :

"Join class"

Carte "Monthly subscription"

Status :

ACTIVE

"Next payment: 01/10/2026"

Afficher également :

présence ;

moyenne ;

devoirs à rendre ;

prochain examen blanc ;

dernières activités.

==================================================
6. STUDENT SIDEBAR

Créer cette navigation :

Dashboard
My Courses
Calendar
Live Classes
Materials
Assignments
Exams
My Progress
Payments
Messages
Profile

==================================================
7. MY COURSES

Créer une page permettant de visualiser les niveaux :

A1
A2
B1
B2

Afficher clairement :

A1 — Completed
A2 — In Progress
B1 — Locked
B2 — Locked

Pour A2 :

Progress bar : 68%

Afficher :

Modules

Module 1 — Alltag
Module 2 — Arbeit
Module 3 — Reisen
Module 4 — Gesundheit
Module 5 — Kommunikation

Chaque module comporte :

progress ;

lessons ;

exercises ;

test.

Les modules doivent être cliquables.

==================================================
8. LESSON PAGE

Créer une page de cours réaliste.

Exemple :

"A2 · Module 2 · Arbeit"

Titre :

"Im Büro"

Afficher :

Video lesson
Vocabulary
Grammar
Listening
Exercises
Homework

Créer des boutons :

Watch lesson
Listen
Start exercises
Download PDF

Afficher une barre :

Lesson progress 75%

==================================================
9. MATERIALS

Créer une bibliothèque de documents.

Filtres :

Level
Module
Type

Types :

PDF
Audio
Video
Exercise

Exemples :

A2 Grammar Guide.pdf
A2 Vocabulary — Arbeit.pdf
Listening Exercise 04.mp3
German Conversation.mp4

Chaque ressource possède :

titre
niveau
type
date
taille

Bouton :

Open
Download

Ne pas utiliser de faux liens externes. Les boutons doivent générer une interaction visuelle de prototype.

==================================================
10. LIVE CLASSES

Créer une page "Live Classes".

Afficher :

Today's classes

A2 Group 2
18:00 – 19:30
Teacher: Anna Müller

Status :

Starting soon

Bouton :

"Join class"

Créer une interface de réunion simulée ressemblant à une vraie virtual classroom.

Afficher :

vidéo professeur ;

liste participants ;

chat ;

microphone ;

camera ;

screen share ;

leave meeting.

Il s'agit d'une simulation UI dans le prototype.

Ne pas développer un système vidéo propriétaire.

Prévoir dans l'architecture une future intégration Google Meet ou Jitsi.

==================================================
11. CALENDAR

Créer un calendrier semaine/mois.

Afficher :

cours ;

examens ;

devoirs ;

réunions.

Utiliser les couleurs avec sobriété.

Exemple :

Monday
18:00 — A2 German

Tuesday
18:00 — Grammar

Thursday
19:00 — Speaking

Saturday
10:00 — Mock Exam

==================================================
12. ASSIGNMENTS

Créer une page :

"Assignments"

Afficher :

Homework
Deadline
Status
Grade

Exemples :

German Email Writing
Due tomorrow
Pending

Listening Exercise
Submitted
78%

Writing Assignment
Corrected
82%

Créer une page de détail d’un devoir.

L'étudiant peut :

lire les instructions ;

voir les fichiers ;

uploader son travail ;

submit assignment.

Simulation frontend acceptable pour le prototype.

==================================================
13. EXAMS

Créer un écran très important :

"Prüfungen"

Afficher :

A1
Completed

A2
Unlocked

B1
Locked

B2
Locked

Pour A2 :

Mock Exam 01
Available

Mock Exam 02
Available

Final A2 Assessment
Locked

Afficher clairement pourquoi un examen est verrouillé.

Exemple :

"Complete 80% of the A2 course to unlock."

==================================================
14. MOCK EXAM

Créer une vraie interface de simulation d'examen.

Titre :

"A2 Mock Exam — Hören"

Afficher :

Question 01 / 20

Audio player

Question

Réponses A / B / C / D

Timer :

18:42

Boutons :

Previous
Next
Finish exam

Créer plusieurs questions afin que la navigation fonctionne.

À la fin :

Result page

Hören : 76%
Lesen : 82%
Schreiben : 68%
Sprechen : 74%

Overall : 75%

Afficher :

"Good progress"

==================================================
15. PROGRESSION

Créer une page très visuelle :

"My Progress"

Afficher :

Overall progress
68%

Skill breakdown :

Hören 72%
Lesen 81%
Schreiben 65%
Sprechen 70%
Grammatik 74%
Wortschatz 79%

Afficher également un historique mensuel de progression.

Créer un graphique élégant.

Afficher :

Current level : A2
Target : B1

==================================================
16. PAYMENTS

Créer un véritable dashboard de démonstration des mensualités.

Page :

"Payments"

Afficher :

Current subscription

A2 Monthly Program
1,200 MAD / month

Status :

ACTIVE

Next payment :

01 October 2026

Historique :

September 2026
1,200 MAD
PAID

August 2026
1,200 MAD
PAID

Créer un bouton :

"Pay now"

Créer également un scénario visuel de paiement en retard.

Exemple :

Payment overdue

"Your access will be limited if payment is not completed."

Boutons :

Pay now

==================================================
17. ACCESS CONTROL DEMO

Le prototype doit démontrer visuellement le concept très important :

PAYMENT → ACCESS

Créer un système simulé.

Lorsque subscription = ACTIVE :

courses accessibles ;

materials accessibles ;

live classes accessibles ;

exams accessibles.

Lorsque subscription = SUSPENDED :

afficher les contenus avec un overlay :

"Access restricted"

"Your monthly subscription is inactive."

Bouton :

"Renew subscription"

Cette logique doit fonctionner visuellement dans le prototype.

==================================================
18. MESSAGES

Créer une messagerie interne.

Conversations :

Anna Müller — Teacher
Administration
A2 Group

Permettre :

envoyer message ;

écrire texte ;

joindre fichier.

Créer une interface moderne proche d'un chat professionnel.

==================================================
19. PROFILE

Créer :

Profile

Photo
Name
Email
Phone
Current level
Class
Teacher

Afficher également :

Learning statistics

Attendance
Average grade
Completed lessons

==================================================
20. TEACHER DASHBOARD

Créer un dashboard complètement différent.

Header :

"Good morning, Anna"

Afficher :

My classes
A1 Group 1
A2 Group 2
B1 Group 1

Statistics :

Students : 42
Classes today : 3
Assignments to grade : 8
Average attendance : 91%

==================================================
21. TEACHER SIDEBAR

Dashboard
My Classes
Calendar
Lessons
Materials
Assignments
Exams
Attendance
Messages
Profile

==================================================
22. TEACHER CLASS PAGE

Créer :

"A2 Group 2"

Students : 15

Afficher tableau :

Student
Attendance
Progress
Average
Status

Exemple :

Ahmed
94%
76%
81%
Active

Créer boutons :

View profile
Attendance
Grades

==================================================
23. TEACHER LESSON MANAGEMENT

Le professeur doit pouvoir :

Create lesson

Ajouter :

Title
Level
Module
Description
Video
PDF
Audio
Exercises

Bouton :

Publish lesson

Pour le prototype, les interactions peuvent être simulées avec des états frontend.

==================================================
24. TEACHER ASSIGNMENTS

Afficher :

Assignments to grade

Student
Assignment
Submitted
Grade

Créer une page de correction.

Le professeur peut :

voir la réponse ;

attribuer une note ;

écrire feedback ;

Mark as graded.

==================================================
25. TEACHER ATTENDANCE

Créer un système de présence.

Pour chaque cours :

Present
Absent
Late
Excused

Afficher statistiques de présence.

==================================================
26. DIRECTOR DASHBOARD

C'est le dashboard le plus important après celui étudiant.

Créer un dashboard professionnel de direction.

Header :

"Administration Dashboard"

Cards :

Active Students
243

Teachers
18

Classes
16

Monthly Revenue
184,500 MAD

Outstanding Payments
12

Average Attendance
91%

Mock Exams Completed
137

Créer des graphiques :

Students by level

Revenue monthly

Attendance

Exam performance

==================================================
27. DIRECTOR SIDEBAR

Dashboard
Students
Teachers
Classes
Courses
Levels
Materials
Assignments
Exams
Payments
Invoices
Calendar
Messages
Reports
Settings
Audit Logs

==================================================
28. STUDENT MANAGEMENT

Créer une table professionnelle.

Columns :

Student
Level
Class
Progress
Attendance
Subscription
Status

Exemples :

Ahmed Benali
A2
A2-G2
68%
94%
Active
Active

Créer filtres :

Level
Class
Subscription
Status

Bouton :

Add student

==================================================
29. STUDENT DETAIL — 360°

Créer une page complète :

Student 360

Profile

Learning
Attendance
Assignments
Exams
Payments

Afficher toute l'information d'un étudiant dans des onglets.

Très important :
montrer que l'administration possède une vue globale de l'étudiant.

==================================================
30. CLASS MANAGEMENT

Créer :

Classes

A1-G1
A1-G2
A2-G1
A2-G2
B1-G1
B2-G1

Chaque classe possède :

Level
Teacher
Students
Schedule
Room / Online

==================================================
31. COURSE MANAGEMENT

Direction peut gérer :

A1
A2
B1
B2

Créer modules et lessons.

Afficher une structure hiérarchique :

A2
→ Module
→ Unit
→ Lesson
→ Materials
→ Exercises

==================================================
32. EXAM MANAGEMENT

Créer une interface direction pour :

Create Exam

Select:

Level
Skill
Questions
Duration
Passing score

Afficher :

A1 Mock Exam 01
A2 Mock Exam 01
B1 Mock Exam 02
B2 Mock Exam 01

Créer une banque de questions.

==================================================
33. PAYMENT MANAGEMENT

Créer un dashboard financier.

Cards :

Revenue this month
Paid
Pending
Overdue

Table :

Student
Amount
Due date
Status

Créer actions :

View
Mark paid
Send reminder
Suspend access

==================================================
34. ACCESS / SUBSCRIPTION MANAGEMENT

Créer une page permettant à la direction de voir :

Student
Subscription
Start
End
Status

Actions :

Activate
Suspend
Extend
Renew

La logique suivante doit être clairement représentée :

ACTIVE → FULL ACCESS

PAST DUE → WARNING

SUSPENDED → RESTRICTED ACCESS

==================================================
35. AUDIT LOGS

Créer une page :

Audit Logs

Exemples :

Admin activated Ahmed's subscription
Teacher Anna published A2 lesson
Director changed A2 exam status
Admin recorded payment
Student submitted assignment

Afficher :

User
Action
Date
Time

==================================================
36. NOTIFICATIONS

Créer des notifications réalistes :

"Your German class starts in 30 minutes."

"Your payment is due in 3 days."

"Your teacher corrected your assignment."

"A2 Mock Exam 02 is now available."

==================================================
37. DEMO DATA

Créer suffisamment de données fictives pour que les dashboards paraissent réels.

Étudiants :

au moins 15

Professeurs :

au moins 5

Classes :

A1-G1
A1-G2
A2-G1
A2-G2
B1-G1
B2-G1

Créer des cours et ressources sur les quatre niveaux.

Utiliser des noms réalistes mais clairement fictifs.

==================================================
38. WORKFLOWS À DÉMONTRER

Le prototype doit démontrer au minimum les workflows suivants :

WORKFLOW 1

Student login
→ Dashboard
→ My Course
→ Lesson
→ Exercise
→ Progress

WORKFLOW 2

Student
→ Calendar
→ Live Class
→ Join meeting

WORKFLOW 3

Student
→ Exam
→ Mock Exam
→ Questions
→ Result

WORKFLOW 4

Student
→ Payment
→ Active subscription
→ Full access

WORKFLOW 5

Student
→ Payment overdue
→ Access restricted
→ Renew subscription

WORKFLOW 6

Teacher
→ Class
→ Attendance
→ Assignment
→ Grade student

WORKFLOW 7

Director
→ Student
→ Student 360
→ Payments
→ Progress
→ Attendance

WORKFLOW 8

Director
→ Exam Management
→ Create exam
→ Publish
→ Student exam becomes unlocked.

==================================================
39. IMPORTANT BUSINESS LOGIC

Même si certaines fonctionnalités sont simulées frontend dans ce prototype, elles doivent être pensées avec ces règles :

Un étudiant appartient à un niveau.

Un étudiant peut être inscrit à une classe.

Une classe possède un professeur.

Une classe contient plusieurs cours.

Une subscription détermine l'accès aux fonctionnalités payantes.

Les examens sont associés à un niveau.

Les examens peuvent être locked/unlocked.

Le niveau suivant n'est pas automatiquement accessible sans conditions.

Les professeurs ne peuvent gérer que leurs classes.

La direction possède une vue globale.

L'accès aux données sensibles doit être basé sur les rôles.

Les paiements et abonnements doivent être deux concepts distincts.

==================================================
40. DESIGN SYSTEM

Créer des composants réutilisables :

Button
Card
Modal
Table
Badge
Tabs
Dropdown
Input
Select
Progress bar
Toast
Dialog
Sidebar
Navbar
Calendar
Chart
File card
Lesson card
Exam card

Créer une vraie cohérence entre toutes les pages.

==================================================
41. RESPONSIVE

Le prototype doit fonctionner proprement sur :

Desktop
Tablet
Mobile

La sidebar devient un menu mobile.

Les tableaux doivent devenir scrollables ou responsive.

Les cards doivent se réorganiser correctement.

==================================================
42. MICRO-INTERACTIONS

Ajouter des interactions discrètes :

hover ;

loading ;

progress animation ;

success toast ;

modal ;

confirmation ;

lock/unlock animation ;

payment status change ;

exam completion.

Ne pas surcharger l'interface.

==================================================
43. ARCHITECTURE CODE

Utiliser :

React
TypeScript
Tailwind CSS

Créer une architecture propre et modulaire.

Séparer clairement :

components
pages
layouts
data
types
services
hooks
utils

Ne pas mettre toute la logique dans un seul fichier.

Créer des types pour :

User
Student
Teacher
Course
Lesson
Class
Assignment
Exam
Question
Subscription
Payment
Notification

==================================================
44. FUTURE BACKEND

Préparer le frontend afin qu'il puisse plus tard être connecté à :

PostgreSQL

Backend :

Spring Boot ou autre API REST.

Prévoir des services abstraits pour :

AuthService
StudentService
CourseService
ExamService
PaymentService
NotificationService

Pour l'instant, utiliser des données mockées propres.

==================================================
45. CE QUI DOIT ÊTRE VISIBLE AU CHEF DE PROJET

La démonstration doit immédiatement faire comprendre que le produit permet de gérer :

les étudiants ;

les professeurs ;

les niveaux A1-B2 ;

les cours ;

les documents ;

les cours en ligne ;

les devoirs ;

les examens blancs ;

la progression ;

les paiements ;

les abonnements ;

les restrictions d'accès ;

les classes ;

les présences ;

l'administration.

L'application doit donner une impression de produit sérieux, scalable et commercialisable.

==================================================
46. PRIORITÉ ABSOLUE

Ne crée pas simplement beaucoup de pages statiques.

Les pages doivent être reliées entre elles.

Un clic doit réellement permettre de poursuivre le workflow.

Exemple :

Dashboard
→ My Courses
→ A2
→ Module
→ Lesson
→ Exercise
→ Progress

Et :

Payments
→ Pay now
→ Payment success
→ Subscription active
→ Access restored

Et :

Exams
→ A2
→ Mock Exam
→ Exam interface
→ Submit
→ Result

Et :

Director
→ Students
→ Student 360
→ Payments / Learning / Attendance / Exams

==================================================
47. FINAL UI QUALITY

Le résultat final doit ressembler à une vraie plateforme EdTech premium et non à un template générique.

L'interface doit être :

clean
professional
modern
coherent
fast
minimal
premium
credible

Priorité :
UX > animations
cohérence > quantité
lisibilité > décoration

Créer un prototype suffisamment abouti pour être présenté à un chef de projet et servir ensuite de base à une spécification technique complète.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/1f855ab8-e556-4edd-a755-6126f8f27f4b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
