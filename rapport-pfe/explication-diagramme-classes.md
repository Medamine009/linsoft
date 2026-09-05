# Diagramme de classes — explication table par table

**LINSOFT Learning Center** · Plateforme de gestion des formations et événements internes
Fichier source du diagramme : `rapport-pfe/classe.drawio`

---

## Comment lire la planche

Trois conventions à annoncer d'emblée :

- **Chaque cadre coloré est un microservice, avec sa propre base de données.** Six cadres, six bases. Un seul est relationnel (PostgreSQL), les cinq autres sont documentaires (MongoDB).
- **Trait plein** : lien à l'intérieur d'un même service.
- **Trait pointillé** : lien qui franchit une frontière de service. Il n'y a alors **aucune clé étrangère** — l'appariement se fait par identifiant.

| Microservice | Base | Classes |
|---|---|---|
| user-service | PostgreSQL | `User`, `RoleType` |
| event-service | MongoDB | `Event`, `TicketType`, `PendingChange`, `ChangeDecision` + 5 énumérations |
| registration-service | MongoDB | `Registration`, `RegistrationStatus` |
| ticket-service | MongoDB | `Ticket`, `TicketStatus` |
| feedback-service | MongoDB | `Feedback` |
| notification-service | MongoDB | `InAppMessage` |

---

## 1. user-service · PostgreSQL

### Classe `User` — 14 attributs

C'est le **profil applicatif**, et non le compte de connexion : celui-ci vit dans Keycloak.

| Attribut | Type | Rôle |
|---|---|---|
| `id` | Long | Clé technique PostgreSQL, auto-incrémentée |
| `keycloakId` | String | **Le pivot de tout le système** — le `sub` du jeton JWT |
| `email` | String | Identité, recopiée depuis Keycloak |
| `firstName` | String | Prénom |
| `lastName` | String | Nom |
| `role` | RoleType | Rôle applicatif effectif |
| `phoneNumber` | String | Information que Keycloak ne porte pas |
| `bio` | String | Parcours, expertise (affiché sur le profil) |
| `photoUrl` | String | Avatar |
| `profileComplete` | boolean | Pilote l'écran d'onboarding |
| `enabled` | Boolean | Activation / désactivation du compte par l'administrateur |
| `department` | String | Rattachement organisationnel |
| `createdAt` | LocalDateTime | Traçabilité |
| `updatedAt` | LocalDateTime | Traçabilité |

**Le point à défendre.** Pourquoi une table `User` si Keycloak gère déjà les utilisateurs ? Parce que Keycloak est un *fournisseur d'identité*, pas un référentiel métier. La photo, la biographie et le département sont des données de la plateforme.

`keycloakId` est le trait d'union entre les deux mondes — et c'est **lui**, jamais le `id` PostgreSQL, que l'on retrouve dans `Event.organizerId` et `Registration.attendeeId`.

### Énumération `RoleType`

`ADMIN` · `ORGANISATEUR` · `PARTICIPANT`

Trois rôles hiérarchisés. Le realm Keycloak attribue `PARTICIPANT` à tout le monde par défaut ; le front-end résout le rôle effectif par priorité (`ADMIN` > `ORGANISATEUR` > `PARTICIPANT`).

---

## 2. event-service · MongoDB

### Classe `Event` — 26 attributs, le cœur du modèle

Les attributs se lisent en quatre blocs.

#### a) Identité de la session

| Attribut | Type |
|---|---|
| `id` | String |
| `title` | String |
| `description` | String |
| `eventDate` | LocalDateTime |
| `location` | String |
| `category` | String |
| `type` | EventType |
| `mode` | EventMode |
| `visioLink` | String |
| `latitude` | Double |
| `longitude` | Double |

#### b) L'organisateur, dénormalisé

| Attribut | Type |
|---|---|
| `organizerId` | String (le `keycloakId`) |
| `organizerEmail` | String |
| `organizerName` | String |

Pourquoi recopier l'email et le nom ? Parce que lorsque event-service publie une notification, il doit connaître l'adresse du formateur **sans appeler user-service**. C'est un choix de duplication assumé.

#### c) La capacité

| Attribut | Type |
|---|---|
| `totalSeats` | Integer |
| `availableSeats` | Integer |

`availableSeats` se décrémente à chaque inscription approuvée, dans la même opération que le changement de statut. C'est ce qui interdit la sur-réservation.

#### d) Le cycle de modération

| Attribut | Type |
|---|---|
| `status` | EventStatus |
| `cancelReason` | String |

`cancelReason` est conservé après une annulation approuvée, pour l'afficher aux participants.

#### Champs spécifiques par type de session

| Attribut | Concerne |
|---|---|
| `level` | Formation, Workshop |
| `duration` | Formation, Workshop |
| `prerequisites` | Formation, Workshop |
| `speaker` | Conférence |
| `certification` | Formation |

Ils sont nullables : le formulaire de création n'affiche que ceux du type choisi.

### Classe `«Embeddable» TicketType` — 3 attributs

| Attribut | Type |
|---|---|
| `name` | String |
| `price` | Double |
| `quota` | Integer |

Une session peut proposer plusieurs tarifs. Lorsqu'ils existent, la capacité totale devient la somme des quotas et le prix affiché est le plus bas des types.

### Classe `«Embeddable» PendingChange` — 20 attributs

**La classe à expliquer lentement.** C'est la demande de l'organisateur *en attente de décision*. Elle se lit en deux moitiés.

#### Métadonnées de la demande

| Attribut | Type | Rôle |
|---|---|---|
| `type` | ChangeType | UPDATE ou CANCEL |
| `reason` | String | Motif — obligatoire pour une annulation |
| `requestedBy` | String | `keycloakId` de l'organisateur |
| `requestedByName` | String | Nom lisible, pour l'écran de modération |
| `requestedAt` | LocalDateTime | Horodatage du dépôt |

#### Valeurs proposées (modification uniquement)

`title`, `description`, `eventDate`, `location`, `category`, `mode`, `visioLink`, `totalSeats`, `level`, `duration`, `prerequisites`, `speaker`, `certification`, `latitude`, `longitude`

**Le principe fondamental.** Ces champs dupliquent ceux d'`Event`, et c'est voulu : la session publiée garde ses valeurs, les valeurs proposées attendent à côté. **Rien ne change au catalogue tant que l'administrateur n'a pas approuvé.**

Un champ à `null` signifie « inchangé » — l'organisateur n'a pas à renvoyer la totalité de la session.

### Classe `«Embeddable» ChangeDecision` — 4 attributs

| Attribut | Type | Rôle |
|---|---|---|
| `type` | ChangeType | Nature de la demande jugée |
| `outcome` | DecisionOutcome | APPROVED ou REJECTED |
| `reason` | String | Motif que portait la demande |
| `decidedAt` | LocalDateTime | Date de la décision |

Conserve l'issue de la dernière demande tranchée. **Sans elle, un refus effacerait simplement la demande** et l'organisateur ne pourrait pas distinguer « refusée » de « jamais envoyée ». L'avis disparaît lorsqu'il en prend acte.

### Les cinq énumérations d'event-service

| Énumération | Valeurs | À retenir |
|---|---|---|
| `EventType` | FORMATION, WORKSHOP, CONFERENCE, EVENEMENT | `EVENEMENT` correspond aux données héritées |
| `EventMode` | PRESENTIEL, EN_LIGNE, HYBRIDE | Conditionne l'affichage de `visioLink` |
| `EventStatus` | PENDING, APPROVED, REJECTED, **CANCELLED** | `CANCELLED` = annulation approuvée par l'admin |
| `ChangeType` | UPDATE, CANCEL | Nature de la demande |
| `DecisionOutcome` | APPROVED, REJECTED | Verdict de l'administrateur |

---

## 3. registration-service · MongoDB

### Classe `Registration` — 15 attributs

**Le point le plus important de tout le diagramme.** Trois blocs.

#### a) Les identifiants

| Attribut | Type |
|---|---|
| `eventId` | String |
| `attendeeId` | String |

Ce sont des **chaînes de caractères, pas des relations**. registration-service ne peut faire aucune jointure avec les autres bases.

#### b) L'état de l'inscription

| Attribut | Type |
|---|---|
| `status` | RegistrationStatus |
| `registrationDate` | LocalDateTime |
| `checkedIn` | boolean |
| `checkedInAt` | LocalDateTime |
| `reminderSent` | boolean |
| `qrCodeTicket` | String |
| `ticketType` | String |
| `ticketPrice` | Double |

#### c) Les copies dénormalisées

| Attribut | Type |
|---|---|
| `eventTitle` | String |
| `eventLocation` | String |
| `eventDateStr` | String |
| `attendeeName` | String |

**La question du jury, et la réponse.**

> « Pourquoi recopier le titre de l'événement au lieu de faire une jointure ? »

Parce qu'il n'existe pas de jointure possible entre deux bases MongoDB distinctes. Afficher une liste de cinquante inscriptions imposerait cinquante appels HTTP à event-service. On accepte une duplication maîtrisée pour supprimer un couplage à la lecture — le compromis classique en architecture microservices : cohérence forte contre disponibilité et performance.

### Énumération `RegistrationStatus`

`PENDING` · `CONFIRMED` · `CANCELLED` · `REJECTED`

**Toute inscription naît en `PENDING`.** C'est une demande soumise à validation de l'administrateur, jamais une confirmation immédiate.

---

## 4. ticket-service · MongoDB

### Classe `Ticket` — 7 attributs

| Attribut | Type |
|---|---|
| `id` | String |
| `registrationId` | String |
| `eventId` | String |
| `attendeeId` | String |
| `qrCode` | String |
| `status` | TicketStatus |
| `issuedAt` | LocalDateTime |

Matérialise le justificatif de présence. Cardinalité **1 — 0..1** avec `Registration` : une inscription confirmée peut donner un code de présence, une demande en attente non.

### Énumération `TicketStatus`

`VALID` · `USED` · `CANCELLED`

Le passage à `USED` a lieu au scan à l'entrée de la session, et c'est lui qui débloque le certificat de participation.

---

## 5. feedback-service · MongoDB

### Classe `Feedback` — 6 attributs

| Attribut | Type |
|---|---|
| `id` | String |
| `eventId` | String |
| `userId` | String |
| `rating` | int (1 à 5) |
| `comment` | String |
| `createdAt` | LocalDateTime |

Volontairement minimale. C'est cette collection que le service d'intelligence artificielle analyse pour produire le sentiment global d'une session.

---

## 6. notification-service · MongoDB

### Classe `InAppMessage` — 7 attributs

| Attribut | Type |
|---|---|
| `id` | String |
| `recipientEmail` | String |
| `subject` | String |
| `message` | String |
| `senderRole` | String |
| `read` | boolean |
| `createdAt` | LocalDateTime |

**Une subtilité à signaler.** Le destinataire est identifié par son **email**, et non par son `keycloakId`. Raison : ce service reçoit des diffusions vers des listes d'adresses (annulation de session, communication de l'administrateur) et n'a pas besoin de résoudre une identité pour livrer un message.

---

## 7. Les liens, un par un

### Compositions internes à event-service (trait plein)

| Lien | Cardinalité | Lecture |
|---|---|---|
| `Event` → `TicketType` | 1 — 0..* | Une session porte ses tarifs |
| `Event` → `PendingChange` | 1 — **0..1** | Une seule demande en cours à la fois |
| `Event` → `ChangeDecision` | 1 — 0..1 | La dernière décision, jusqu'à acquittement |

Le `0..1` sur `PendingChange` **est une règle métier**, pas un hasard : deux demandes concurrentes sur la même session seraient ingérables pour l'administrateur. Le serveur refuse explicitement une seconde demande.

### Liens inter-services (trait pointillé)

| Lien | Cardinalité | Appariement |
|---|---|---|
| `User` → `Event` | 1 — 0..* | `Event.organizerId = User.keycloakId` |
| `User` → `Registration` | 1 — 0..* | `Registration.attendeeId = User.keycloakId` |
| `Event` → `Registration` | 1 — 0..* | `Registration.eventId = Event.id` |
| `Registration` → `Ticket` | 1 — 0..1 | `Ticket.registrationId = Registration.id` |
| `User` → `Feedback` | 1 — 0..* | `Feedback.userId = User.keycloakId` |
| `Event` → `Feedback` | 1 — 0..* | `Feedback.eventId = Event.id` |
| `User` → `InAppMessage` | 1 — 0..* | `InAppMessage.recipientEmail = User.email` |

---

## 8. Les trois questions que le jury posera

### « Où est l'intégrité référentielle ? »

Il n'y en a pas au sens relationnel, et c'est le prix de l'indépendance des services. Elle est assurée **applicativement** : on ne crée une inscription qu'après avoir vérifié l'existence de l'événement, et l'ajustement des places disponibles est atomique.

### « Pourquoi `PendingChange` duplique-t-elle les champs d'`Event` ? »

Pour que la session publiée reste intacte pendant l'instruction de la demande. Les collaborateurs déjà inscrits continuent de voir les bonnes informations jusqu'à l'approbation. C'est exactement ce que l'on attend d'un circuit de validation.

### « Pourquoi une base relationnelle pour les utilisateurs et documentaire pour le reste ? »

**Persistance polyglotte.** L'utilisateur a un schéma stable et des contraintes d'unicité (`email`, `keycloakId`) : le relationnel convient. L'événement a un schéma variable selon le type de session — une formation porte une certification, une conférence un intervenant — et des structures imbriquées (`TicketType`, `PendingChange`) : le documentaire convient.

---

## Récapitulatif chiffré

| | Nombre |
|---|---|
| Microservices représentés | 6 |
| Entités persistées | 6 |
| Classes imbriquées (`Embeddable`) | 3 |
| Énumérations | 8 |
| Attributs au total | 98 |
| Associations inter-services | 7 |
| Compositions internes | 3 |
