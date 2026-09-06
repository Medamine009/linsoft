# Guide de test et d'exploitation — LINSOFT Learning Center

> Marche à suivre complète pour démarrer la plateforme, la peupler, tout tester
> et vérifier la chaîne DevOps. Chaque section indique **ce que vous devez
> obtenir** : si le résultat diffère, c'est un problème à signaler.

---

## 0. Prérequis

| Outil | Version | Vérification |
|---|---|---|
| Docker Desktop | 24+ | `docker --version` |
| Java (JDK) | 17 | `java -version` |
| Maven | 3.9+ | `mvn -version` |
| Node.js | 20 (LTS) | `node --version` |
| Git | 2.4+ | `git --version` |

> **Note sur Node.js :** votre poste utilise actuellement la version 25, une
> version impaire non LTS. Tout fonctionne, mais npm affiche des avertissements
> `EBADENGINE`. Ils sont sans conséquence ici.

### Configuration initiale

```bash
cp .env.example .env
```

Renseignez `GEMINI_API_KEY` si vous voulez l'assistant IA. **Sans clé, tout le
reste de la plateforme fonctionne** ; seul le chatbot renvoie un message
expliquant qu'il n'est pas configuré.

---

## 1. Démarrer la plateforme

```bash
# 1. Construire les archives JAR (les images Docker les copient)
cd backend && mvn clean package -DskipTests && cd ..

# 2. Démarrer les 16 conteneurs
docker compose up -d --build
```

Le démarrage complet prend **3 à 5 minutes** : Keycloak importe son realm, puis
les services s'enregistrent auprès d'Eureka.

### Vérifier que tout est sain

```bash
docker compose ps
```

**Attendu :** tous les conteneurs en `running`, ceux qui déclarent un
healthcheck en `healthy`.

```bash
# Santé de chaque service (doit répondre UP)
for p in 8888 8761 8080 8081 8082 8083 8084 8086 8087 8088; do
  echo -n "port $p : "; curl -s http://localhost:$p/actuator/health | head -c 40; echo
done
```

> Sous PowerShell :
> ```powershell
> 8888,8761,8080,8081,8082,8083,8084,8086,8087,8088 | ForEach-Object {
>   "$_ : " + (Invoke-RestMethod "http://localhost:$_/actuator/health").status }
> ```

**Attendu :** dix fois `UP`.

Si un service reste indisponible, consultez ses journaux :
```bash
docker compose logs -f registration-service
```

---

## 2. Peupler la base avec le jeu de données de test

```powershell
powershell -ExecutionPolicy Bypass -File scripts/seed-test-data.ps1
```

Le script est **rejouable** : il efface puis recrée les données. Toutes les dates
sont calculées par rapport à l'instant d'exécution, donc le scénario reste
valide quel que soit le jour.

**Attendu en fin d'exécution :**
```
35 inscription(s) validee(s) — aucune incoherence
events=8   registrations=35   notifications=84   feedbacks=5
```

### Comptes créés — mot de passe `Linsoft2026!`

| Rôle | Identifiant | À utiliser pour |
|---|---|---|
| **Administrateur** | `s.benamor` | Modération, certificats, statistiques |
| **Formateur** | `k.haddad` | Création et gestion de sessions |
| **Participant** | `y.gharbi` | **Couvre les 5 états de certificat** |

Autres participants : `i.mansour`, `m.chaabane`, `r.bouzid`, `w.jaziri`,
`s.khelifi`, `h.ferchichi` — même mot de passe.

> Les comptes historiques (`admin@pfe.com`, `participant@pfe.com`,
> `akh901736@gmail.com`…) **conservent leur mot de passe d'origine** : le script
> n'y touche pas.

---

## 3. Tester l'application manuellement

Ouvrez **http://localhost:4200**, cliquez sur « Accéder à la plateforme » (écran
d'accueil animé), puis sur « Se connecter ».

### 3.1 Parcours participant — connectez-vous en `y.gharbi`

Allez dans **Mes inscriptions**. Ce compte a été construit pour montrer les cinq
états simultanément :

| Session | Progression attendue | Certificat attendu |
|---|---|---|
| Red Hat RH124 | 25 % — À venir | Non disponible |
| Linux Foundation LFCA | 25 % — À venir | Non disponible |
| AWS SAA-C03 | **75 % — En cours** | Non disponible |
| Ansible EX294 | 100 % — Terminée | **En préparation** |
| Kubernetes CKA | 100 % — Terminée | **En attente de validation** |
| Sécurité des conteneurs | 100 % — Terminée | **Disponible** + bouton PDF |

**À vérifier :**
- le bouton « Télécharger le PDF » n'apparaît **que** sur la dernière ligne ;
- cliquez dessus : un PDF s'ouvre, portant le nom du titulaire, l'intitulé de la
  session et une référence ;
- la barre de progression affiche les quatre jalons, et « Présence validée »
  apparaît barrée en rouge lorsque le participant n'a pas émargé.

### 3.2 Parcours administrateur — connectez-vous en `s.benamor`

**Gestion des certificats** (menu de gauche) :

- **Attendu :** « 2 session(s) terminée(s) — 10 certificat(s) à traiter ».
- Les certificats sont groupés par session, avec deux actions par participant.
- Cliquez sur **Garder en attente** : le statut passe à « En attente de
  validation » et porte votre nom.
- Cliquez sur **Envoyer le certificat** : la ligne disparaît de la file et
  apparaît dans « Certificats délivrés ».

**Vérification croisée :** reconnectez-vous en `y.gharbi` — le certificat que
vous venez d'envoyer est désormais téléchargeable.

> Pour revenir à l'état initial, relancez simplement le script de seed.

### 3.3 Vérifier le cloisonnement des rôles

Connecté en `y.gharbi` (participant), saisissez dans la barre d'adresse :

```
http://localhost:4200/admin
http://localhost:4200/users
```

**Attendu :** vous êtes détourné vers votre espace. Vous ne devez jamais voir la
console d'administration.

### 3.4 Notifications et courriels

Cliquez sur l'icône enveloppe en haut à droite : la boîte contient uniquement
**vos** messages. Les courriels émis sont visibles sur **http://localhost:8025**
(MailHog).

---

## 4. Lancer les tests automatisés

### 4.1 Tests backend — 195 tests

```bash
cd backend

mvn test      # unitaires + API/sécurité (rapide, sans infrastructure)
mvn verify    # + tests d'intégration Testcontainers + couverture + seuil
```

**Attendu :** `BUILD SUCCESS`, 11 modules.

> **Sur ce poste précis**, les tests Testcontainers s'affichent en `Skipped` :
> Docker Desktop y refuse l'accès au socket au client Java (erreur HTTP 400 sur
> `/info`, indépendamment du pipe ou de la version d'API). Ce n'est pas un
> défaut du code — **ils s'exécutent réellement en intégration continue**, et le
> pipeline échoue si l'un d'eux est ignoré alors que Docker est disponible.

Rapports de couverture :
```
backend/<service>/target/site/jacoco/index.html
```

Le seuil est de **40 % par module**. Pour vérifier qu'il bloque réellement :
```bash
mvn -pl feedback-service verify -Djacoco.line.coverage=0.90
```
**Attendu :** `Rule violated … BUILD FAILURE`.

### 4.2 Analyse statique

```bash
cd backend && mvn -Pquality verify -DskipTests
```
Rapports : `target/checkstyle-result.xml`, `target/spotbugsXml.xml`.

### 4.3 Tests frontend — 82 tests

```bash
cd frontend
npm ci --legacy-peer-deps
npx playwright install chromium   # première fois uniquement
npm run test-ci
```

**Attendu :** `Test Files 51 passed (51)` / `Tests 82 passed (82)`.

### 4.4 Tests de bout en bout — 14 scénarios

**Prérequis : plateforme démarrée et jeu de données semé.**

```bash
cd frontend
npm run e2e            # sans interface
npm run e2e:headed     # en observant le navigateur
npm run e2e:report     # rapport HTML après coup
```

**Attendu :** `14 passed`, en 3 à 4 minutes.

### 4.5 Regénérer les captures du rapport

```bash
cd frontend && npm run captures
```
Les images sont écrites dans `rapport-pfe/captures/` et remplacent les
précédentes — elles reflètent donc toujours l'état réel de l'application.

---

## 5. Supervision

```bash
docker compose --profile monitoring up -d
```

| Outil | URL | Accès |
|---|---|---|
| Prometheus | http://localhost:9090 | — |
| Grafana | http://localhost:3000 | `admin` / `admin` |

**À vérifier dans Prometheus** — menu *Status → Targets* : **11 cibles** (les dix
services plus Prometheus lui-même), toutes en `UP`.

**Dans Grafana** — le tableau de bord « LINSOFT — Vue plateforme » est déjà
provisionné (dossier *LINSOFT Learning Center*). Il affiche la disponibilité, la
charge, le taux d'erreur, le temps de réponse, la mémoire, les threads et le CPU.

> Le panneau « Taux d'erreur HTTP 5xx » vide est **normal** : il signifie qu'il
> n'y a aucune erreur serveur.

Requête utile en ligne de commande :
```bash
curl 'http://localhost:9090/api/v1/query?query=up{job="microservices"}'
```

---

## 6. Chaîne d'intégration continue

Le pipeline s'exécute automatiquement à chaque `git push`.

**Consultez-le ici :** https://github.com/Medamine009/linsoft/actions

**Attendu :** **17 tâches vertes**.

| Tâche | Rôle |
|---|---|
| Backend — tests et couverture | 195 tests + Testcontainers + JaCoCo |
| Backend — analyse statique | Checkstyle + SpotBugs |
| SonarCloud | Ignorée tant que `SONAR_TOKEN` n'est pas défini |
| Frontend — tests et build | 82 tests + build de production |
| Images Docker (× 10) + frontend | Construction, scan Trivy, publication GHCR |
| Tests E2E | Plateforme complète + 14 scénarios |
| Synthèse | Verdict global |

### Activer SonarCloud (facultatif)

1. Créez un projet sur https://sonarcloud.io ;
2. dans **Settings → Secrets and variables → Actions** du dépôt :
   - secret `SONAR_TOKEN`
   - variables `SONAR_ORGANIZATION` et `SONAR_PROJECT_KEY`.

Le job s'activera seul à la poussée suivante. Tant que le secret est absent, il
est **ignoré** et ne fait pas échouer le pipeline.

### Rendre les images publiques (facultatif)

Les paquets GHCR sont privés par défaut. Pour les rendre publics :
profil GitHub → **Packages** → paquet → *Package settings* → *Change visibility*.

---

## 7. Déploiement OpenShift

```bash
oc login --token=<jeton> --server=<api>
oc project akh901736-dev

# Secrets — en démonstration :
oc apply -f openshift/01-secrets.yaml
# …ou, pour un déploiement réel (mots de passe aléatoires, hors Git) :
./openshift/create-secrets.sh

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
```

**Contrôles :**
```bash
oc get pods -w                                  # tous en Running / 1-1 Ready
oc get routes                                   # URL publique du frontend
oc describe pod -l app=registration-service     # état des sondes
```

Les sondes interrogent `/actuator/health/liveness` et `/health/readiness` : un
service dont la base est momentanément injoignable est retiré du trafic
(*readiness*) sans être redémarré en boucle (*liveness*).

---

## 8. Commandes de gestion courantes

```bash
docker compose ps                      # état des conteneurs
docker compose logs -f <service>       # suivre les journaux
docker compose restart <service>       # redémarrer un service
docker compose down                    # arrêter (données conservées)
docker compose down -v                 # tout supprimer, volumes compris
```

Après une modification du code backend :
```bash
cd backend && mvn -pl <service> package -DskipTests && cd ..
docker compose build <service> && docker compose up -d <service>
```

---

## 9. Générer le rapport PDF

Le chapitre DevOps se trouve dans `rapport-pfe/chapitre-devops.tex`, inclus
depuis `main.tex`. Les captures sont dans `rapport-pfe/captures/`.

```bash
cd rapport-pfe
pdflatex main.tex && pdflatex main.tex   # deux passes : sommaire et références
```

Sans installation LaTeX locale :
```bash
docker run --rm -v "${PWD}:/work" -w /work texlive/texlive:latest \
  pdflatex -interaction=nonstopmode main.tex
```

---

## 10. En cas de problème

| Symptôme | Cause probable | Correction |
|---|---|---|
| `503` sur `/api/...` | Service pas encore enregistré dans Eureka | Attendre ~60 s après le démarrage |
| Le seed échoue à l'authentification | Keycloak pas encore prêt | Vérifier `http://localhost:8085` puis relancer |
| Tests E2E en échec | Jeu de données absent ou modifié | Relancer le script de seed |
| Testcontainers ignorés | Docker Desktop bloque le client Java | Sans effet local ; ils tournent en CI |
| Chatbot indisponible | `GEMINI_API_KEY` absente | Renseigner la clé dans `.env` |
| Pipeline rouge | Voir l'onglet Actions | Les journaux indiquent l'étape fautive |

---

## 11. Points à connaître

- **Les paquets GHCR sont privés** par défaut : la publication réussit, mais
  l'image n'est pas récupérable anonymement.
- **`openshift/01-secrets.yaml` contient des mots de passe de démonstration**,
  publics puisque versionnés. Utilisez `create-secrets.sh` pour tout déploiement
  réel.
- **`user-service` (41 %) et `ai-service` (42 %)** sont les modules les moins
  couverts : ce sont les prochains chantiers si vous relevez le seuil à 50 %.
- **Aucun tableau de bord Grafana supplémentaire** n'est fourni au-delà de celui
  provisionné ; les métriques permettent d'en construire d'autres.
