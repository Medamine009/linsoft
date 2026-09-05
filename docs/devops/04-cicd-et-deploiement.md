# CI/CD, conteneurisation et déploiement

> Support de la section « DevOps et déploiement » du rapport PFE.

## 1. Chaîne d'intégration continue (GitHub Actions)

Fichier : `.github/workflows/ci.yml`. Déclenché sur `push` (main/master/develop),
`pull_request` et manuellement.

```
                    ┌──────────────────────────┐
                    │        push / PR         │
                    └────────────┬─────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
┌───────────────┐      ┌──────────────────┐      ┌────────────────┐
│ backend-tests │      │ backend-quality  │      │ frontend-tests │
│               │      │                  │      │                │
│ mvn verify    │      │ Checkstyle       │      │ Vitest         │
│  · unitaires  │      │ SpotBugs         │      │ ng build       │
│  · API/secu   │      │                  │      │                │
│  · Testcont.  │      └──────────────────┘      └───────┬────────┘
│  · JaCoCo     │                                        │
└───────┬───────┘                                        │
        │ artefact : JAR testés                          │
        └───────────────────┬────────────────────────────┘
                            ▼
             ┌──────────────────────────────┐
             │ docker-build (matrice ×10)   │
             │ docker-frontend              │
             │   1. construction image      │
             │   2. Trivy (CRITICAL/HIGH)   │
             │   3. SARIF -> onglet Security│
             │   4. push GHCR (main only)   │
             └──────────────┬───────────────┘
                            ▼
                    ┌───────────────┐
                    │  ci-summary   │  porte de qualité
                    └───────────────┘
```

### Détail des étapes

| Job | Rôle | Points notables |
|---|---|---|
| `backend-tests` | `mvn clean verify` sur les 11 modules | Vérifie d'abord que Docker répond, puis **échoue si un test d'intégration a été ignoré** — sans ce garde-fou, un runner sans Docker donnerait un pipeline vert trompeur |
| `backend-quality` | Profil `quality` | Checkstyle + SpotBugs, rapports publiés en artefact |
| `frontend-tests` | Vitest + build de production | Installe Chromium via `playwright install --with-deps` |
| `docker-build` | Matrice sur les 10 services | Réutilise les **JAR déjà testés** au lieu de recompiler : l'image publiée est exactement celle qui a passé les tests |
| `docker-frontend` | Image Angular | Build multi-stage depuis les sources |
| `ci-summary` | Verdict global | Échoue si une étape bloquante a échoué |

### Choix assumé : pas de build Maven dans les images backend

Les `Dockerfile` backend copient un JAR déjà construit. Un multi-stage
`FROM maven` par service recompilerait dix fois le même réacteur — plusieurs
dizaines de minutes en CI pour un résultat identique. Le réacteur est donc
construit **une fois**, les JAR circulent en artefact, et chaque image est
assemblée à partir du binaire validé. C'est à la fois plus rapide et plus sûr :
l'artefact testé et l'artefact publié sont le même.

Le frontend, lui, est bien multi-stage (`node:20-alpine` → `nginx-unprivileged`)
car il n'a pas ce problème de réacteur partagé.

### Secrets

Aucun identifiant n'est écrit dans le dépôt. La publication GHCR utilise le
`GITHUB_TOKEN` fourni par la plateforme. Le fichier `.env` est désormais ignoré
par Git, `.env.example` sert de modèle.

## 2. Conteneurisation

| Image | Base | Sécurité |
|---|---|---|
| 10 services backend | `eclipse-temurin:17-jre-alpine` | `chgrp -R 0 /app && chmod -R g=u /app` — indispensable sur OpenShift, qui assigne un UID aléatoire appartenant au groupe 0 |
| frontend | `nginxinc/nginx-unprivileged:alpine` | Non-root par construction, écoute sur 8080 |

Toutes les images backend embarquent un `HEALTHCHECK` interrogeant
`/actuator/health`.

### Correctif apporté

Ces `HEALTHCHECK` visaient déjà `/actuator/health`, **mais 7 services sur 10
n'embarquaient pas Actuator** : la sonde répondait 404. `docker-compose.yml`
contournait le problème avec `curl -s -o /dev/null … || exit 1`, qui **réussit
même sur un 404 ou un 401**. Aucune vérification de santé du projet ne prouvait
donc quoi que ce soit. Actuator ajouté partout via le POM parent, les six
healthchecks de contournement remplacés par de vraies vérifications.

## 3. Docker Compose

```bash
# Prérequis : construire les JAR
cd backend && mvn clean package -DskipTests

# Démarrer toute la plateforme
docker compose up -d --build

# Suivre les journaux
docker compose logs -f registration-service

# État de santé de chaque conteneur
docker compose ps

# Reconstruire un service
docker compose build registration-service && docker compose up -d registration-service

# Arrêter (les volumes de données sont conservés)
docker compose down

# Tout supprimer, volumes compris
docker compose down -v
```

L'ordre de démarrage est piloté par `depends_on` + `condition: service_healthy` :
infrastructure → config-service → discovery → services métier → gateway → frontend.

## 4. Supervision

### Endpoints exposés (tous les services)

| Endpoint | Usage |
|---|---|
| `/actuator/health` | Agrégat — healthcheck Docker et sonde de démarrage |
| `/actuator/health/liveness` | Le processus est-il vivant ? → redémarrage du pod |
| `/actuator/health/readiness` | Peut-il servir du trafic ? → retrait du load balancer |
| `/actuator/prometheus` | Métriques Micrometer |
| `/actuator/metrics` | Métriques détaillées |

L'exposition est **restreinte** à `health,info,prometheus,metrics` :
`env`, `beans`, `heapdump` et les autres restent fermés, ce qui borne ce que les
règles `permitAll("/actuator/**")` peuvent atteindre.

Chaque métrique porte une étiquette `application=<nom du service>`, sans quoi les
séries des dix services seraient indistinguables dans Prometheus.

### Journalisation

Format console commun défini dans la configuration partagée, incluant le nom du
service — les journaux agrégés des dix conteneurs restent exploitables. Aucun mot
de passe ni jeton n'est journalisé.

## 5. Déploiement OpenShift

### Ressources par service

`Deployment`, `Service`, plus `Route` pour les composants exposés (frontend,
gateway, Keycloak). Configuration dans `ConfigMap eventify-config`, secrets dans
des `Secret` dédiés (`postgres-secret`…), stockage par `PersistentVolumeClaim`
pour PostgreSQL, MongoDB et RabbitMQ.

### Sondes — avant / après

Les manifestes utilisaient des sondes `tcpSocket`, qui ne prouvent que
l'ouverture du port : un pod dont le contexte Spring avait échoué était malgré
tout déclaré prêt et recevait du trafic. Les 21 sondes des services métier ont
été converties :

```yaml
startupProbe:
  httpGet: { path: /actuator/health, port: 8083 }
  periodSeconds: 10
  failureThreshold: 40          # ~400 s : JVM lente sur petit CPU
readinessProbe:
  httpGet: { path: /actuator/health/readiness, port: 8083 }
  periodSeconds: 15
livenessProbe:
  httpGet: { path: /actuator/health/liveness, port: 8083 }
  periodSeconds: 30
  failureThreshold: 5
```

Le choix `liveness` ≠ `readiness` est important : une base momentanément
injoignable doit retirer le pod du service (**readiness**) sans le redémarrer en
boucle (**liveness**).

### Compatibilité OpenShift

- Aucune image ne suppose l'UID 0 ; le groupe 0 possède `/app`.
- Le frontend écoute sur 8080 (port non privilégié).
- `enableServiceLinks: false` : supprime les variables `*_PORT=tcp://…` injectées
  par Kubernetes, qui écrasaient les placeholders du Config Server.
- `resources.requests` / `limits` définis sur chaque déploiement.

### Commandes

```bash
oc login --token=<jeton> --server=<api>
oc project akh901736-dev

# Dans l'ordre : secrets, configuration, infrastructure, puis services
oc apply -f openshift/01-secrets.yaml
oc apply -f openshift/02-configmap.yaml
oc apply -f openshift/10-postgres.yaml -f openshift/11-mongo.yaml \
         -f openshift/12-rabbitmq.yaml -f openshift/13-keycloak.yaml \
         -f openshift/14-mailhog.yaml
oc apply -f openshift/19-config-service.yaml
oc apply -f openshift/20-discovery-service.yaml
oc apply -f openshift/21-api-gateway.yaml
oc apply -f openshift/22-microservices.yaml
oc apply -f openshift/23-ai-service.yaml
oc apply -f openshift/30-frontend.yaml

# Contrôles
oc get pods -w
oc get routes
oc logs -f deployment/registration-service
oc describe pod -l app=registration-service   # état des sondes
```

## 6. Limites connues

- **Tests E2E Playwright** : non encore écrits. Le socle est présent (Playwright
  est déjà une dépendance du projet et le navigateur est installé en CI).
- **SonarQube** : non intégré. JaCoCo produit déjà le XML attendu par Sonar ;
  l'ajout se limiterait à un job et un token.
- **Prometheus / Grafana** : les services *exposent* les métriques, mais aucune
  instance n'est déployée. C'est le prérequis, pas la pile complète.
- **Seuil de couverture** à 0, à relever progressivement (voir document 03).
