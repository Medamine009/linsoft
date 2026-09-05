# Analyse de l'existant — Testing & DevOps

> État des lieux réalisé avant toute modification, conformément à la démarche
> « analyser puis planifier puis implémenter ». Chaque constat ci-dessous a été
> vérifié sur le dépôt et sur la stack en fonctionnement, pas déduit.

## 1. Architecture constatée

### Backend — 10 services Spring Boot 3.2.4 / Java 17

| Service | Port | Persistance | Rôle |
|---|---|---|---|
| `config-service` | 8888 | — | Spring Cloud Config (source de vérité de la configuration) |
| `discovery-service` | 8761 | — | Eureka |
| `api-gateway` | 8080 | — | Spring Cloud Gateway, route `/api/**` |
| `user-service` | 8081 | **PostgreSQL** `user_db` | Profils collaborateurs + admin Keycloak |
| `event-service` | 8082 | MongoDB `event_db` | Catalogue, modération, demandes de changement |
| `registration-service` | 8083 | MongoDB `registration_db` | Inscriptions, avancement, certificats |
| `notification-service` | 8084 | MongoDB `notification_db` | Consommateur RabbitMQ, email + in-app |
| `feedback-service` | 8086 | MongoDB `feedback_db` | Avis et notes |
| `ticket-service` | 8087 | MongoDB `ticket_db` | QR codes (ZXing) |
| `ai-service` | 8088 | — | Google Gemini (chatbot, analyse des avis) |

### Infrastructure

Keycloak 23 (realm `pfe-events`, rôles `ADMIN` / `ORGANISATEUR` / `PARTICIPANT`),
RabbitMQ 3, MongoDB 6, PostgreSQL 15, MailHog. Orchestration par
`docker-compose.yml` (stack complète, `depends_on` + healthchecks).

### Frontend

Angular 20 standalone, template CoreUI, `keycloak-angular`, Leaflet.
Build de test : **`@angular/build:unit-test` avec Vitest + Playwright browser mode**
(et non Karma/Jasmine — point important pour la stratégie de test).

### Communication inter-services

- Synchrone : `RestTemplate` + `DiscoveryClient` (résolution Eureka), propagation
  manuelle du jeton JWT (`EventEnrichmentService`, `UserEnrichmentService`, `EventSeatUpdater`).
- Asynchrone : RabbitMQ, un exchange, publication depuis `registration-service` et
  `event-service`, consommation par `notification-service`.

---

## 2. Constats — problèmes identifiés

### 2.1 Tests (critique)

| Périmètre | État |
|---|---|
| Services backend **sans aucun test** | `user-service`, `notification-service`, `api-gateway`, `ai-service`, `config-service`, `discovery-service` (6/10) |
| Services avec tests | `registration-service` (12), `event-service` (1), `feedback-service` (1), `ticket-service` (1) |
| Tests de **contrôleur** | aucun |
| Tests de **sécurité / rôles** | aucun |
| Tests d'**intégration** (base réelle) | aucun |
| Tests de **messagerie** RabbitMQ | aucun |
| **Testcontainers** | absent de tous les `pom.xml` |
| Tests **E2E** | absents |
| Couverture mesurée | **aucune** (pas de JaCoCo) |

Côté frontend, ~45 fichiers `.spec.ts` existent **mais ce sont exclusivement les
specs du template CoreUI** (`views/base`, `views/buttons`, `views/forms`,
`views/widgets`, `components/docs-*`). **Aucun** composant métier n'est testé :
`admin`, `user`, `organizer`, `events`, `registrations`, `checkin`, `profile`,
`api.service`, `auth.guard`, `role.guard`, `shared/role.ts`.

### 2.2 Configuration Maven

Le `backend/pom.xml` n'est **qu'un agrégateur** : il déclare `<modules>` mais
aucun `<parent>` pour les services. Chaque service hérite directement de
`spring-boot-starter-parent` et **redéclare** `java.version`, `spring-cloud.version`
et l'import du BOM Spring Cloud. Conséquence : aucun endroit où brancher JaCoCo,
Surefire/Failsafe ou les outils qualité sans les dupliquer 10 fois.

### 2.3 Supervision et santé (critique pour OpenShift)

**7 services sur 10 n'embarquent pas `spring-boot-starter-actuator`** :
`discovery-service`, `event-service`, `feedback-service`, `notification-service`,
`registration-service`, `ticket-service`, `user-service`.

Conséquences vérifiées :

- Les `Dockerfile` de ces services déclarent
  `HEALTHCHECK ... curl -fsS http://localhost:PORT/actuator/health` → **404**,
  donc le healthcheck de l'image est cassé.
- `docker-compose.yml` contourne le problème avec
  `curl -s -o /dev/null http://localhost:PORT/ || exit 1`, qui **réussit même sur
  un 404 ou un 401** : le healthcheck ne prouve rien.
- Aucune distinction *liveness* / *readiness* → les manifestes OpenShift ne
  peuvent pas décrire correctement le cycle de vie des pods.
- **Aucun Micrometer / endpoint Prometheus** nulle part : pas de métriques.

### 2.4 CI/CD

**Aucun pipeline.** `.github/` ne contient que des scripts utilitaires
(`java-upgrade/hooks/scripts/recordToolUse.*`), pas de workflow. Donc : pas de
build automatisé, pas de tests automatisés, pas d'analyse qualité, pas de scan de
vulnérabilités, pas de publication d'images.

### 2.5 Sécurité

- **`.env` versionné contient une vraie clé API Google Gemini** (53 caractères).
  Un secret réel dans le dépôt : à révoquer et à externaliser.
- `openshift/01-secrets.yaml` : à auditer pour la même raison.
- Les endpoints Actuator, une fois ajoutés, tomberont sous
  `anyRequest().authenticated()` → il faudra explicitement ouvrir
  `/actuator/health` sinon les sondes échoueront en 401.

### 2.6 Docker

Points **déjà corrects** (à préserver) : le `Dockerfile` frontend est multi-stage
et tourne en non-root (`nginx-unprivileged`) ; les images backend appliquent
`chgrp -R 0 /app && chmod -R g=u /app`, ce qui est la bonne pratique OpenShift
(UID aléatoire dans le groupe 0).

Points à améliorer : les images backend sont **mono-stage et exigent un
`mvn package` préalable** — le build n'est donc pas reproductible depuis un
`docker build` seul, ce qui bloque une CI propre.

### 2.7 Environnement local

`git` **n'est pas installé** sur la machine de développement et le dossier de
travail n'est pas un dépôt Git. Voir la note de blocage dans le plan.

---

## 3. Ce qui fonctionne bien et ne sera pas touché

- L'architecture microservices et le découpage fonctionnel.
- Le flux d'approbation (inscription → validation admin → certificat).
- La configuration centralisée par Config Server.
- Le realm Keycloak (fragile à l'import : à ne pas régénérer).
- Le jeu de données de test (`scripts/seed-test-data.ps1`).
