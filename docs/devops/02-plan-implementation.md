# Plan d'implémentation — Testing & DevOps

Ordre choisi pour que chaque phase s'appuie sur la précédente et reste
vérifiable : **la fondation d'abord** (sans elle, ni couverture, ni sondes, ni CI
ne sont possibles), les tests ensuite, l'automatisation en dernier.

## Phase 1 — Fondation build & supervision

| # | Action | Pourquoi |
|---|---|---|
| 1.1 | `backend/pom.xml` devient un **vrai parent** (hérite de `spring-boot-starter-parent`, les 10 services héritent de lui) | Seul moyen de brancher JaCoCo / Surefire / Failsafe / qualité **une fois** au lieu de 10 |
| 1.2 | Propriétés et BOM (Spring Cloud, **Testcontainers**) centralisés | Supprime la duplication constatée en 2.2 |
| 1.3 | **Actuator + Micrometer/Prometheus** sur les 10 services | Corrige les healthchecks cassés (2.3), ouvre les sondes OpenShift et les métriques |
| 1.4 | Ouverture de `/actuator/health` et `/actuator/prometheus` dans chaque `SecurityConfig` | Sans cela les sondes reçoivent 401 |
| 1.5 | Correction des `HEALTHCHECK` Docker et des healthchecks Compose | Un healthcheck qui passe sur un 404 ne prouve rien |
| 1.6 | `.env.example` + retrait du secret réel du dépôt | Secret exposé (2.5) |

**Critère de sortie :** `mvn clean verify` passe sur les 10 modules, la stack
Docker redémarre, `/actuator/health` répond `UP` sur chaque service.

## Phase 2 — Tests backend

| # | Action |
|---|---|
| 2.1 | Tests unitaires métier (Mockito) sur `user-service`, `notification-service`, `event-service`, `registration-service` : cas nominal, entrée invalide, règle métier violée, exception, cas limite |
| 2.2 | Tests de contrôleur `@WebMvcTest` + `MockMvc` : codes HTTP, validation, corps de réponse, erreurs |
| 2.3 | Tests de **sécurité** : `spring-security-test`, jetons JWT simulés par rôle, vérification qu'un `PARTICIPANT` ne peut pas atteindre un endpoint `ADMIN`, 401 sans jeton |
| 2.4 | Tests d'**intégration Testcontainers** : MongoDB, PostgreSQL, RabbitMQ — repositories réels, publication/consommation de messages réelle |
| 2.5 | JaCoCo : rapports HTML + XML, seuil de couverture sur le code métier |

## Phase 3 — Tests frontend & E2E

| # | Action |
|---|---|
| 3.1 | Tests Vitest sur le code métier : `ApiService`, `shared/role.ts`, `shared/participation.ts`, `auth.guard`, `role.guard`, `NotifsService` |
| 3.2 | Tests de composants critiques : espace participant (suivi + certificat), tableau de bord admin (file des certificats) |
| 3.3 | **Playwright** (déjà présent en devDependency) : connexion par rôle, création de session, inscription, restriction de rôle |

## Phase 4 — Qualité, CI/CD, OpenShift, documentation

| # | Action |
|---|---|
| 4.1 | Checkstyle + SpotBugs, configurés pour être **informatifs** et non bloquants au départ |
| 4.2 | **GitHub Actions** : checkout → cache → qualité → tests unitaires → tests d'intégration → tests front → build → couverture → images Docker → **Trivy** → publication **GHCR** |
| 4.3 | Dockerfiles backend **multi-stage** (build Maven dans l'image) pour un build reproductible en CI |
| 4.4 | Manifestes OpenShift : sondes `liveness`/`readiness` sur Actuator, `resources`, Secrets, ConfigMaps |
| 4.5 | Documentation README + dossier `docs/devops` exploitable dans le rapport PFE |

---

## Point de blocage à traiter par l'utilisateur

**`git` n'est pas installé sur cette machine et le dossier de travail n'est pas
un dépôt Git.** Je ne peux donc ni cloner, ni comparer, ni pousser vers
`https://github.com/Medamine009/linsoft.git`.

L'implémentation est donc réalisée **sur la copie locale**, qui contient le
projet complet. Deux options pour la rapatrier :

1. Installer Git (`winget install --id Git.Git`), puis initialiser/rattacher le
   dépôt et pousser — je peux préparer les commandes.
2. Copier les fichiers modifiés dans votre clone habituel et pousser depuis là.

Aucune écriture vers GitHub ne sera tentée sans votre accord explicite.
