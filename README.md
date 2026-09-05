# 🎉 Eventify — Plateforme de gestion d'événements

Application web full-stack moderne pour la création, la gestion et la réservation d'événements,
bâtie sur une architecture **microservices Spring Boot** et un frontend **Angular 21** avec authentification **Keycloak**.

---

## 🏗️ Architecture

```
                       ┌──────────────────┐
                       │   Angular 21     │  (port 4200)
                       │   Frontend       │
                       └────────┬─────────┘
                                │ HTTPS + JWT (Keycloak)
                                ▼
                       ┌──────────────────┐
                       │   API Gateway    │  (port 8080)
                       │  Spring Cloud GW │
                       └────────┬─────────┘
                                │ lb://
        ┌───────────────────────┼─────────────────────────────┐
        ▼                       ▼                             ▼
┌──────────────┐      ┌──────────────┐              ┌──────────────┐
│ user-service │      │ event-service│              │ registration │
│   (8081)     │      │    (8082)    │  ───────────▶│   (8083)     │
│   Postgres   │      │   MongoDB    │              │   MongoDB    │
└──────────────┘      └──────────────┘              └──────┬───────┘
                                                            │ publish
                                                            ▼ RabbitMQ
                          ┌───────────────────────────────────────┐
                          │                                       │
                ┌─────────▼─────────┐                  ┌──────────▼──────────┐
                │   notification    │                  │       ticket        │
                │    (8084)         │                  │       (8087)        │
                │   SMTP→MailHog    │                  │  ZXing QR codes     │
                └───────────────────┘                  └─────────────────────┘

                ┌──────────────┐    ┌──────────────┐
                │  feedback    │    │  discovery   │
                │   (8086)     │    │  service     │
                │   MongoDB    │    │  Eureka 8761 │
                └──────────────┘    └──────────────┘

   Infra Docker:  PostgreSQL · MongoDB · RabbitMQ · Keycloak · MailHog
```

### Pattern event-driven (RabbitMQ)

```
User clicks "Réserver" → registration-service POST /api/registrations
                          │
                          ├─ saves to MongoDB
                          ├─ fetches user info (HTTP + JWT propagation)
                          ├─ fetches event info (HTTP + JWT propagation)
                          └─ publishes JSON on exchange "event.exchange"
                                       │
                                       ▼
                          notification-service @RabbitListener
                                       │
                                       ├─ generates HTML email
                                       └─ sends via SMTP → MailHog
                                            (or real SMTP in prod)
```

---

## 🧱 Stack technique

### Backend (Java 17, Spring Boot 3.2.4, Spring Cloud 2023.0.1)
| Service | Port | DB | Description |
|---|---|---|---|
| `discovery-service` | 8761 | – | **Eureka** : registre de services |
| `api-gateway` | 8080 | – | Spring Cloud Gateway (reactive), validation JWT, CORS |
| `user-service` | 8081 | PostgreSQL | CRUD users, auto-sync JWT, upgrade rôle Keycloak |
| `event-service` | 8082 | MongoDB | CRUD événements |
| `registration-service` | 8083 | MongoDB | Inscriptions, **publisher RabbitMQ** |
| `notification-service` | 8084 | – | **Listener RabbitMQ**, emails HTML via Spring Mail |
| `ticket-service` | 8087 | MongoDB | **Génération QR codes ZXing** (PNG) |
| `feedback-service` | 8086 | MongoDB | Reviews & ratings 1-5 étoiles |

### Frontend (Angular 21 standalone components)
- **CoreUI** (template de base, fortement customisé)
- **Keycloak-angular** pour l'auth
- **HTTP interceptor** pour injecter le Bearer JWT
- **Command palette `⌘K`** custom (style Linear)
- **Dark mode** persistent
- **Bento grid layouts** style Apple / Vercel

### Infrastructure (Docker Compose)
- **PostgreSQL 15** — user-service
- **MongoDB 6** — event, registration, ticket, feedback
- **RabbitMQ 3 management** — bus event-driven
- **Keycloak 23** — IAM + JWT
- **MailHog** — SMTP de dev (UI sur `http://localhost:8025`)

### Sécurité
- **Keycloak** realm `pfe-events` avec 3 rôles : `ADMIN`, `ORGANISATEUR`, `PARTICIPANT`
- **JWT** validé sur chaque microservice (`spring-security-oauth2-resource-server`)
- **JwtAuthConverter** custom : extrait les `realm_access.roles` en `ROLE_*`
- **JWT propagation** inter-services (registration-service → user-service / event-service)
- **API Gateway** : autorise `OPTIONS /**` pour CORS preflight
- **Role-based access** : `@hasRole('ADMIN')`, `@hasAnyRole('ORGANISATEUR', 'ADMIN')`, etc.

---

## 🚀 Lancement rapide

### Prérequis
- **Docker Desktop**
- **Java 17** (testé avec Eclipse Adoptium / Microsoft OpenJDK)
- **Maven 3.9+**
- **Node 20+** (testé avec Node 25)

### Démarrage en 1 commande
```powershell
.\launch.ps1
```

Le script :
1. Lance les 5 conteneurs Docker (Postgres, MongoDB, RabbitMQ, Keycloak, MailHog)
2. Démarre Eureka (8761), attend 12s
3. Démarre Gateway (8080), attend 6s
4. Démarre les 6 autres microservices en parallèle
5. Lance Angular sur 4200

### Arrêt
```powershell
.\stop.ps1
```

### Lancement manuel
```powershell
docker compose up -d
cd backend && mvn clean package -DskipTests
cd discovery-service && java -jar target/*.jar &
# attendre 12s
cd ../api-gateway && java -jar target/*.jar &
# ... idem pour les autres
cd ../../frontend && npm install && npm start
```

---

## 🌐 URLs

| Service | URL |
|---|---|
| **Application web** | http://localhost:4200 |
| Eureka dashboard | http://localhost:8761 |
| Keycloak admin | http://localhost:8085 (admin/admin) |
| RabbitMQ management | http://localhost:15672 (guest/guest) |
| **MailHog UI (voir les emails)** | http://localhost:8025 |
| Swagger UI (user) | http://localhost:8081/swagger-ui.html |
| Swagger UI (event) | http://localhost:8082/swagger-ui.html |
| Swagger UI (registration) | http://localhost:8083/swagger-ui.html |
| Swagger UI (ticket) | http://localhost:8087/swagger-ui.html |
| Swagger UI (feedback) | http://localhost:8086/swagger-ui.html |

---

## 👥 Comptes de test (mot de passe **`Test123!`**)

| Utilisateur | Rôle | Accès |
|---|---|---|
| `admin-user` | `ADMIN` | Console admin, gestion users, modération events |
| `organisateur-user` | `ORGANISATEUR` | Création / édition d'événements, stats |
| `participant-user` | `PARTICIPANT` | Découverte, réservation, favoris, billets, avis |

---

## ✨ Fonctionnalités clés

### Pour le **Participant**
- 🔍 **Explorer** : grille d'événements avec filtres avancés (catégorie, prix max, date)
- ❤️ **Favoris** persistés (localStorage)
- 🎫 **Mes billets** : portefeuille numérique avec **vrai QR code** (ZXing PNG)
- 🪟 **Modal détails** événement avec description, lieu, capacité, **section reviews & notation**
- ⭐ **Notation** 1-5 étoiles + commentaire après inscription
- 📧 **Email de confirmation** auto à chaque réservation (visible dans MailHog)
- 👤 **Profil éditable** : photo, bio, téléphone, etc.

### Pour l'**Organisateur**
- ✏️ Création d'événements avec catégorie, places, prix, description
- 📊 **Dashboard** avec stats agrégées (revenus, inscriptions, taux remplissage)
- 📅 Vue calendrier mensuel
- 🔔 Notifications auto envoyées aux participants

### Pour l'**Admin**
- 🛡️ Console avec KPI globaux (users, events, inscriptions)
- 👥 Gestion utilisateurs avec recherche / filtre / tri
- 🗓️ Modération d'événements
- 📋 Liste des inscriptions **enrichies** (vrai nom, vrai titre event)

### Pages communes
- 🌙 **Dark mode** toggle (persistant)
- ⌘K **Command palette** pour navigation rapide
- 🌐 Login Keycloak unifié avec page d'accueil **/welcome**
- 📱 Responsive design (mobile-first)

---

## 🧪 Tester le flux event-driven (impressionnant pour la démo)

1. Login `participant-user / Test123!`
2. Aller sur **Explorer** → cliquer une carte → **Réserver maintenant**
3. Ouvrir **http://localhost:8025** (MailHog)
4. Voir l'email **"✅ Inscription confirmée — [Nom event]"** apparaître en temps réel
5. Côté Eventify, aller dans **Mes billets** → admirer le **vrai QR code** scanné !

Pipeline déclenché :
```
Click Réserver
  → registration-service.registerForEvent()
  → publish event sur RabbitMQ "event.exchange"
  → notification-service.handle()
  → enrichissement (HTTP user-service + event-service)
  → EmailService.sendHtml() → SMTP MailHog
```

---


## 🧪 Tests, qualité et DevOps

Documentation détaillée dans [`docs/devops/`](docs/devops/) :

| Document | Contenu |
|---|---|
| [01 — Analyse de l'existant](docs/devops/01-analyse-existant.md) | État des lieux et problèmes identifiés |
| [02 — Plan d'implémentation](docs/devops/02-plan-implementation.md) | Phases et critères de sortie |
| [03 — Stratégie de test](docs/devops/03-strategie-de-test.md) | Pyramide de test, ce que chaque test protège |
| [04 — CI/CD et déploiement](docs/devops/04-cicd-et-deploiement.md) | GitHub Actions, Docker, OpenShift, supervision |

### Lancer les tests

```bash
# Backend — tests unitaires (rapide, sans infrastructure)
cd backend && mvn test

# Backend — chaîne complète : unitaires + intégration (Testcontainers) + couverture
cd backend && mvn verify

# Backend — analyse statique (Checkstyle + SpotBugs)
cd backend && mvn -Pquality verify -DskipTests

# Frontend — première fois seulement : installer le navigateur de test
cd frontend && npx playwright install chromium

# Frontend — tests unitaires
cd frontend && npm run test-ci
```

Rapports de couverture : `backend/<service>/target/site/jacoco/index.html`.
Seuil actif : **30 % par module**, vérifié par `mvn verify`.

Les tests d'intégration (`*IT.java`) démarrent de vraies bases via
**Testcontainers** : aucune base locale à lancer. Ils s'ignorent automatiquement
si aucun démon Docker n'est joignable, et s'exécutent réellement en CI.

### Supervision

Chaque service expose `/actuator/health`, `/actuator/health/liveness`,
`/actuator/health/readiness` et `/actuator/prometheus`.

```bash
curl http://localhost:8083/actuator/health/readiness
curl http://localhost:8083/actuator/prometheus | head
```

### Supervision (Prometheus + Grafana)

Les métriques sont exposées par tous les services ; la pile de collecte démarre
à la demande, derrière un profil Compose :

```bash
docker compose --profile monitoring up -d
```

| Outil | URL | Accès |
|---|---|---|
| Prometheus | http://localhost:9090 | — |
| Grafana | http://localhost:3000 | `admin` / `admin` (surchargeable via `.env`) |

La source de données Grafana est provisionnée automatiquement.
### Intégration continue

`.github/workflows/ci.yml` — tests backend (unitaires, API/sécurité, intégration),
analyse statique, tests et build frontend, construction des 11 images Docker,
analyse de vulnérabilités **Trivy** (remontée dans l'onglet *Security*) et
publication sur **GHCR** sur la branche principale.

### Configuration et secrets

```bash
cp .env.example .env      # puis renseigner les valeurs
```

`.env` est ignoré par Git. **Aucun identifiant ne doit être versionné.**

## 📁 Structure du projet

```
pfe_event_management/
├── backend/
│   ├── pom.xml                     # Parent POM (reactor)
│   ├── discovery-service/          # Eureka server
│   ├── api-gateway/                # Spring Cloud Gateway
│   ├── user-service/               # Postgres CRUD + Keycloak admin
│   ├── event-service/              # MongoDB events
│   ├── registration-service/       # Inscriptions + RabbitMQ publisher
│   ├── notification-service/       # RabbitMQ listener + Mail
│   ├── ticket-service/             # ZXing QR generation
│   └── feedback-service/           # Reviews & ratings
├── frontend/
│   ├── src/app/
│   │   ├── layout/                 # Shell custom (sidebar, topbar, cmdk)
│   │   ├── views/
│   │   │   ├── dashboard/          # Dashboard adaptatif par rôle
│   │   │   ├── user/               # Espace participant + modal détails
│   │   │   ├── organizer/          # Studio créateur
│   │   │   ├── admin/              # Console admin
│   │   │   ├── events/             # CRUD événements
│   │   │   ├── users/              # Gestion utilisateurs
│   │   │   ├── registrations/      # Inscriptions enrichies
│   │   │   ├── profile/            # Page profil éditable
│   │   │   └── welcome/            # Landing page non-authentifié
│   │   ├── services/
│   │   │   └── api.service.ts      # Single source for all HTTP calls
│   │   ├── auth.interceptor.ts     # Injection automatique du JWT
│   │   ├── role.guard.ts           # Protection des routes par rôle
│   │   └── keycloak.config.ts
├── docker-compose.yml              # Infra Docker
├── launch.ps1                      # Démarrage 1 clic
├── stop.ps1                        # Arrêt 1 clic
└── README.md
```

---

## 🔧 Variables d'environnement supportées

Toutes les configs sont surchargeables via env vars (utile pour Docker / Kubernetes / prod) :

| Variable | Défaut | Description |
|---|---|---|
| `SERVER_PORT` | varies | Port du service |
| `EUREKA_URL` | `http://localhost:8761/eureka/` | URL Eureka |
| `KEYCLOAK_ISSUER_URI` | `http://localhost:8085/realms/pfe-events` | Issuer JWT |
| `MONGODB_URI` | `mongodb://localhost:27017/<db>` | Connection Mongo |
| `RABBITMQ_HOST` | `localhost` | RabbitMQ host |
| `RABBITMQ_PORT` | `5672` | RabbitMQ port |
| `RABBITMQ_USER` / `_PASSWORD` | `guest` / `guest` | Credentials |
| `MAIL_HOST` | `localhost` | SMTP host (MailHog en dev) |
| `MAIL_PORT` | `1025` | SMTP port |
| `MAIL_FROM` | `noreply@eventify.local` | Adresse expéditeur |

---

## 🛠️ Roadmap (améliorations futures)

- [ ] Upload d'images d'événement (MinIO / S3)
- [ ] Géolocalisation + carte Leaflet
- [ ] WebSocket pour notifications in-app temps réel
- [ ] PWA installable + service worker
- [ ] Paiement Stripe sandbox
- [ ] i18n FR / EN / AR
- [ ] Codes promo & early bird tickets
- [ ] Tests unitaires & e2e (Vitest + Playwright)
- [ ] Pipeline CI/CD GitHub Actions
- [ ] Monitoring Prometheus + Grafana
- [ ] Tracing distribué Zipkin / Jaeger

---

## 🎓 Projet PFE — Notes pédagogiques

Ce projet illustre les concepts suivants :
- **Architecture microservices** avec service discovery (Eureka)
- **API Gateway pattern** (routing, CORS, JWT validation)
- **Event-Driven Architecture** (RabbitMQ pub/sub, async messaging)
- **OAuth 2.0 / OIDC** avec Keycloak (Authorization Code + JWT)
- **JWT propagation** entre microservices
- **Polyglot persistence** (Postgres + MongoDB selon le service)
- **DDD léger** (entities, services, repositories, controllers)
- **Front-end moderne** (Angular standalone, signals, RxJS)
- **Design system custom** (CSS variables, dark mode, bento layouts)
- **Documentation API** via Swagger / OpenAPI
- **Containerization** via Docker Compose

---

## 📄 Licence

Projet académique — Étudiant : DELL, Université, 2026.
