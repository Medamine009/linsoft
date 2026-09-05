# 🚀 Guide de déploiement OpenShift — EVENTIFY

Ce guide t'explique pas à pas comment déployer EVENTIFY sur un cluster OpenShift
(LINSOFT, Developer Sandbox, ou OpenShift Local).

---

## 🎯 Vue d'ensemble

```
┌──────────────────────────────────────────────────────┐
│           OpenShift Project : eventify               │
│                                                      │
│  ┌──────────┐   ┌────────────┐   ┌──────────────┐   │
│  │ frontend │ → │ api-gateway│ → │ microservices│   │
│  │ (nginx)  │   │   (8080)   │   │ (8 services) │   │
│  └────┬─────┘   └────────────┘   └──────┬───────┘   │
│       │ Route                            │           │
│       │                                  ▼           │
│       │      Eureka │ Mongo │ Postgres │ RabbitMQ   │
│       │      Keycloak (Route) │ MailHog            │
│       ▼                                              │
│  https://eventify-<namespace>.apps.<cluster>         │
└──────────────────────────────────────────────────────┘
```

---

## 📋 Prérequis

1. **Compte OpenShift** :
   - **Sandbox Red Hat** (recommandé, gratuit) : <https://developers.redhat.com/developer-sandbox>
   - OU cluster LINSOFT (demande l'accès à ton encadrant)
2. **CLI `oc`** installée :
   - Télécharge depuis <https://mirror.openshift.com/pub/openshift-v4/clients/ocp/>
   - Ajoute `oc.exe` au PATH
3. **Docker** installé (pour builder les images)
4. **Compte Docker Hub** (pour pousser les images) :
   - Crée-toi un compte gratuit sur <https://hub.docker.com>
   - Choisis un username (ex: `tonusername`)
5. **JARs backend buildés** :
   ```bash
   cd backend
   mvn clean package -DskipTests
   ```

---

## 🗂️ Structure des fichiers livrés

```
pfe_event_management/
├── backend/
│   ├── discovery-service/Dockerfile
│   ├── api-gateway/Dockerfile
│   ├── user-service/Dockerfile
│   ├── event-service/Dockerfile
│   ├── registration-service/Dockerfile
│   ├── notification-service/Dockerfile
│   ├── ticket-service/Dockerfile
│   └── feedback-service/Dockerfile
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── .dockerignore
├── docker-compose.full.yml      # test full-stack en local
└── openshift/
    ├── 01-secrets.yaml
    ├── 02-configmap.yaml
    ├── 10-postgres.yaml
    ├── 11-mongo.yaml
    ├── 12-rabbitmq.yaml
    ├── 13-keycloak.yaml
    ├── 14-mailhog.yaml
    ├── 20-discovery-service.yaml
    ├── 21-api-gateway.yaml
    ├── 22-microservices.yaml
    └── 30-frontend.yaml
```

---

## 🏗️ Étape 1 — Construire les images Docker

Dans `pfe_event_management/`, lance le build de toutes les images :

```bash
# 1) S'assurer que les JARs sont à jour
cd backend
mvn clean package -DskipTests
cd ..

# 2) Builder les 9 images (8 backend + 1 frontend)
# Remplace "tonusername" par ton username Docker Hub partout
docker build -t tonusername/eventify-discovery:latest    backend/discovery-service
docker build -t tonusername/eventify-gateway:latest      backend/api-gateway
docker build -t tonusername/eventify-user:latest         backend/user-service
docker build -t tonusername/eventify-event:latest        backend/event-service
docker build -t tonusername/eventify-registration:latest backend/registration-service
docker build -t tonusername/eventify-notification:latest backend/notification-service
docker build -t tonusername/eventify-ticket:latest       backend/ticket-service
docker build -t tonusername/eventify-feedback:latest     backend/feedback-service
docker build -t tonusername/eventify-frontend:latest     frontend
```

> 💡 **Astuce** : tu peux scripter ça dans `build-images.ps1` ou `build-images.sh`.

---

## 📤 Étape 2 — Pousser les images sur Docker Hub

```bash
docker login                  # Identifie-toi avec ton compte Docker Hub

# Pousse toutes les images
docker push tonusername/eventify-discovery:latest
docker push tonusername/eventify-gateway:latest
docker push tonusername/eventify-user:latest
docker push tonusername/eventify-event:latest
docker push tonusername/eventify-registration:latest
docker push tonusername/eventify-notification:latest
docker push tonusername/eventify-ticket:latest
docker push tonusername/eventify-feedback:latest
docker push tonusername/eventify-frontend:latest
```

---

## ✏️ Étape 3 — Mettre à jour les noms d'images dans les manifests

Dans le dossier `openshift/`, **remplace** `eventify/<service>:latest` par
`tonusername/eventify-<service>:latest` partout.

Exemple via PowerShell :
```powershell
Get-ChildItem openshift\*.yaml | ForEach-Object {
  (Get-Content $_.FullName) -replace 'eventify/(\S+):latest', 'tonusername/eventify-$1:latest' | Set-Content $_.FullName
}
```

Ou via `sed` (Linux/Mac) :
```bash
find openshift -name "*.yaml" -exec sed -i 's|eventify/|tonusername/eventify-|g' {} \;
```

---

## 🔑 Étape 4 — Se connecter à OpenShift

```bash
# 1) Récupère ta commande de login depuis la console OpenShift
#    Profil (en haut à droite) → "Copy login command" → "Display Token"
# 2) Colle-la dans ton terminal :
oc login --token=<TON_TOKEN> --server=<URL_API_CLUSTER>

# 3) Crée le projet
oc new-project eventify
```

---

## 🚢 Étape 5 — Déployer l'infra

```bash
# Secrets et config
oc apply -f openshift/01-secrets.yaml
oc apply -f openshift/02-configmap.yaml

# Bases de données
oc apply -f openshift/10-postgres.yaml
oc apply -f openshift/11-mongo.yaml

# Messaging + mail
oc apply -f openshift/12-rabbitmq.yaml
oc apply -f openshift/14-mailhog.yaml

# Keycloak
oc apply -f openshift/13-keycloak.yaml
```

Attends ~1 minute que tout soit prêt, puis :
```bash
oc get pods                    # tous doivent être Running
```

---

## 🔧 Étape 6 — Configurer Keycloak avec la bonne URL publique

```bash
# 1) Récupère l'URL de la Route Keycloak
KEYCLOAK_HOST=$(oc get route keycloak -o jsonpath='{.spec.host}')
echo "Keycloak URL: https://$KEYCLOAK_HOST"

# 2) Patche le deployment Keycloak pour qu'il connaisse sa propre URL
oc set env deployment/keycloak KC_HOSTNAME_URL=https://$KEYCLOAK_HOST
oc rollout restart deployment/keycloak

# 3) Patche la ConfigMap avec l'issuer correct
oc patch configmap eventify-config --type=merge -p \
  "{\"data\":{\"KEYCLOAK_ISSUER_URI\":\"https://$KEYCLOAK_HOST/realms/pfe-events\"}}"
```

> 💡 Va sur `https://<keycloak-host>`, connecte-toi en admin/admin, et **crée le realm `pfe-events`**
> (avec les 3 rôles ADMIN/ORGANISATEUR/PARTICIPANT et au moins un utilisateur de test).
> Tu peux importer le realm depuis ton Keycloak local si tu en as un export JSON.

---

## 🎯 Étape 7 — Déployer les microservices et le frontend

```bash
# Eureka d'abord, attendre qu'il soit Ready
oc apply -f openshift/20-discovery-service.yaml
oc wait --for=condition=ready pod -l app=discovery-service --timeout=180s

# Gateway
oc apply -f openshift/21-api-gateway.yaml
oc wait --for=condition=ready pod -l app=api-gateway --timeout=180s

# Les 6 microservices métier
oc apply -f openshift/22-microservices.yaml

# Frontend
oc apply -f openshift/30-frontend.yaml
```

---

## ✅ Étape 8 — Vérifier que tout marche

```bash
# Tous les pods doivent être Running
oc get pods

# Récupère l'URL publique de l'app
oc get route eventify
```

→ Ouvre l'URL https://eventify-eventify.apps.\<cluster\> dans ton navigateur — **EVENTIFY est en ligne** ! 🎉

---

## 🐛 Dépannage

### Un pod reste en `Pending`
```bash
oc describe pod <nom-du-pod>
```
→ Cherche les `Events`. Souvent : pas assez de CPU/RAM (cluster saturé).

### Un pod redémarre en boucle (`CrashLoopBackOff`)
```bash
oc logs <nom-du-pod>
```
→ Cherche l'erreur. Causes fréquentes :
- Mauvais `KEYCLOAK_ISSUER_URI` (token rejeté)
- Bases pas encore prêtes (relance le pod : `oc delete pod <nom>`)
- `imagePullBackOff` : ton image n'est pas pushed ou le nom est faux

### Modifier un secret ou une configmap après coup
```bash
oc edit configmap eventify-config
oc rollout restart deployment <nom-du-deployment>
```

### Voir les logs en temps réel
```bash
oc logs -f deployment/api-gateway
```

---

## 🧹 Tout supprimer

```bash
oc delete project eventify
```

---

## 📚 Pour aller plus loin

- **Routes HTTPS** : OpenShift gère automatiquement le TLS edge (déjà configuré).
- **Scaling** : `oc scale deployment api-gateway --replicas=3`
- **Monitoring** : la console OpenShift a déjà Prometheus + Grafana intégrés.
- **CI/CD** : on peut ajouter un pipeline Tekton ou GitHub Actions qui builde et push automatiquement.

---

**Bonne soutenance ! 🎓**
