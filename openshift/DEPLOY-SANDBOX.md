# Déploiement sur Red Hat Developer Sandbox

Guide pas-à-pas pour déployer **LINSOFT Learning Center** sur un cluster OpenShift
(Red Hat Developer Sandbox, gratuit).

---

## ⚠️ À savoir avant de commencer (contraintes du Sandbox)

- **Quota mémoire ≈ 7 Gio** et **nombre de pods limité**. La stack complète (16 services)
  **ne rentre pas**. On déploie un **sous-ensemble** avec des ressources réduites
  (voir §6 « Alléger l'empreinte »).
- **Pas de droits admin** sur le cluster : on utilise le projet fourni (`<user>-dev`).
- **Impossible de pousser des images locales** dans le registre interne du Sandbox
  → on passe par **Quay.io** (gratuit, repos publics).

---

## 0. Comptes & outils (à faire maintenant)

1. **Sandbox** : https://developers.redhat.com/developer-sandbox → *Start your sandbox*
   (compte Red Hat gratuit) → lance le sandbox, ouvre la **console web**.
2. **CLI `oc`** : dans la console → menu `?` (en haut) → *Command line tools* →
   télécharge `oc` pour Windows, décompresse, et ajoute le dossier au `PATH`.
   Vérifie : `oc version --client`.
3. **Se connecter** : console → clique ton nom (haut-droite) → *Copy login command* →
   *Display token* → copie la commande `oc login --token=sha256~... --server=https://...`
   et colle-la dans PowerShell.
4. Vérifie : `oc whoami` puis `oc project` (ton projet ressemble à `tonuser-dev`).
5. **Quay.io** : https://quay.io → crée un compte gratuit → `docker login quay.io`.

---

## 1. Construire et pousser les images sur Quay.io

Les images Docker locales existent déjà (la stack tourne en local). Au besoin,
reconstruis-les d'abord :

```powershell
# (si besoin) recompiler les JAR backend puis (re)builder toutes les images
# cd backend ; mvn -q -DskipTests package ; cd ..
docker compose build
```

Puis pousse-les sur Quay avec le script fourni (remplace `TONUSER` par ton compte Quay) :

```powershell
./openshift/push-images.ps1 -QuayUser TONUSER
```

> Après le 1er push, va sur **quay.io** et passe chaque dépôt en **Public**
> (Repository Settings → Make Public). Sinon le cluster ne pourra pas les tirer
> sans *pull secret*.

---

## 2. Pointer les manifestes vers tes images Quay

Les manifestes utilisent `eventify/<service>`. Réécris-les vers `quay.io/TONUSER/<service>` :

```powershell
Get-ChildItem openshift\*.yaml | ForEach-Object {
  (Get-Content $_ -Raw) -replace 'image:\s*eventify/', 'image: quay.io/TONUSER/' |
    Set-Content $_ -Encoding utf8
}
```

*(Fais-le une seule fois. Garde une copie si tu veux pouvoir revenir en arrière.)*

---

## 3. Déployer — dans l'ordre

L'ordre respecte les dépendances : **infra → config → discovery → gateway → services → front**.

```powershell
# 3.1 Secrets + configuration partagée
oc apply -f openshift/01-secrets.yaml
oc apply -f openshift/02-configmap.yaml

# 3.2 Infrastructure (bases, messagerie, auth, mail)
oc apply -f openshift/10-postgres.yaml
oc apply -f openshift/11-mongo.yaml
oc apply -f openshift/12-rabbitmq.yaml

# Keycloak importe le realm pfe-events depuis un ConfigMap — à créer AVANT :
oc create configmap keycloak-realm `
  --from-file=pfe-events-realm.json=keycloak/realm/pfe-events-realm.json
oc apply -f openshift/13-keycloak.yaml

oc apply -f openshift/14-mailhog.yaml

# Attends que Keycloak soit prêt
oc rollout status deployment/keycloak --timeout=300s

# 3.3 Config Server puis Discovery (Eureka)
oc apply -f openshift/19-config-service.yaml
oc rollout status deployment/config-service --timeout=300s
oc apply -f openshift/20-discovery-service.yaml
oc rollout status deployment/discovery-service --timeout=300s

# 3.4 Gateway + microservices + frontend
oc apply -f openshift/21-api-gateway.yaml
oc apply -f openshift/22-microservices.yaml
oc apply -f openshift/30-frontend.yaml
```

Suivi en direct :

```powershell
oc get pods            # tous les pods
oc get pods -w         # en continu
oc logs deploy/api-gateway -f   # logs d'un service
```

---

## 4. Keycloak : renseigner l'URL publique (issuer)

Les JWT sont validés contre l'**issuer** Keycloak. Après déploiement, récupère l'URL
publique de la Route Keycloak et mets à jour le ConfigMap, puis redémarre les services :

```powershell
$KC = oc get route keycloak -o jsonpath='{.spec.host}'
oc patch configmap eventify-config --type merge `
  -p "{""data"":{""KEYCLOAK_ISSUER_URI"":""https://$KC/realms/pfe-events""}}"

oc rollout restart deployment config-service
oc rollout restart deployment api-gateway user-service event-service `
  registration-service notification-service ticket-service feedback-service
```

> Vérifie aussi dans Keycloak que le client `pfe-events-api` a bien la nouvelle URL du
> front dans *Valid Redirect URIs* / *Web Origins* (voir §5).

---

## 5. Récupérer l'URL de l'application

```powershell
oc get route eventify -o jsonpath='{.spec.host}'
```

Ouvre `https://<cette-url>`. Ajoute cette URL dans Keycloak (realm `pfe-events`,
client public du front) → *Valid redirect URIs* : `https://<url>/*` et *Web origins* :
`https://<url>`.

---

## 6. Alléger l'empreinte (indispensable sur le Sandbox ~7 Gio)

Si des pods restent en `Pending` faute de mémoire (`oc describe pod <nom>` →
*Insufficient memory*), réduis la voilure :

- **Ne déploie pas** les services non essentiels à la démo : `ai-service` (chatbot),
  `ticket-service`, `feedback-service`, et `mailhog`. Cœur suffisant pour démontrer :
  discovery, config, gateway, user, event, registration, notification, keycloak,
  postgres, mongo, rabbitmq, frontend.
- **Baisse la mémoire** de chaque service Java (dans les manifestes) :
  - `JAVA_OPTS` → `-Xms128m -Xmx256m`
  - `resources.requests.memory` → `256Mi`, `resources.limits.memory` → `384Mi`
- Garde `replicas: 1` partout.

---

## 7. Dépannage rapide

| Symptôme | Cause probable | Action |
|---|---|---|
| Pod `ImagePullBackOff` | Repo Quay privé ou nom d'image faux | Rendre le repo **public**, vérifier `oc get deploy -o yaml \| findstr image` |
| Pod `Pending` | Pas assez de mémoire (quota) | Voir §6, supprimer des services |
| `CrashLoopBackOff` au démarrage | config-service pas encore prêt | Attendre ; les services réessaient. `oc logs` pour confirmer |
| 401/403 sur `/api/**` | issuer Keycloak faux | Refaire §4 (patch configmap + rollout) |
| 503 sur le front | gateway ne trouve pas les services (Eureka) | Vérifier que les services sont `Registered` dans Eureka (`oc logs deploy/discovery-service`) |

---

## Remarques

- Le **config-service** (Spring Cloud Config) sert toute la configuration (Eureka,
  Keycloak, Mongo, routes du gateway). Il doit être déployé **avant** les autres
  (fichier `19-config-service.yaml`).
- Les valeurs des `Secret` sont des mots de passe de démonstration — à ne jamais
  utiliser en production.
