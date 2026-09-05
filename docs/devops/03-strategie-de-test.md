# Stratégie de test

> Support de la section « Tests et qualité » du rapport PFE.

## 1. Pyramide de test retenue

```
                 ┌──────────────────────┐
                 │   E2E (Playwright)   │   parcours complets, navigateur réel
                 ├──────────────────────┤
                 │  Intégration (IT)    │   Testcontainers : Mongo, Postgres, RabbitMQ
                 ├──────────────────────┤
                 │  API / Sécurité      │   MockMvc + jetons JWT simulés par rôle
                 ├──────────────────────┤
                 │      Unitaires       │   JUnit 5 + Mockito (règles métier)
                 └──────────────────────┘
```

Chaque étage répond à une question différente : *la règle métier est-elle juste ?*
(unitaire), *l'API applique-t-elle bien les droits ?* (API/sécurité), *le code
parle-t-il correctement à l'infrastructure réelle ?* (intégration), *le parcours
utilisateur fonctionne-t-il de bout en bout ?* (E2E).

## 2. Séparation unitaire / intégration

La convention de nommage pilote l'exécution, via le POM parent :

| Suffixe | Plugin Maven | Contenu | Commande |
|---|---|---|---|
| `*Test.java` | Surefire (phase `test`) | Rapide, sans infrastructure | `mvn test` |
| `*IT.java` | Failsafe (phase `verify`) | Testcontainers, Docker requis | `mvn verify` |

Cette séparation permet une boucle de retour courte en développement et une
validation complète en intégration continue, sans dupliquer la configuration.

## 3. Tests unitaires — ce qui est réellement vérifié

Les tests visent les règles qui, si elles cassaient, produiraient un défaut
visible par l'utilisateur.

### `registration-service` — cœur métier

| Test | Règle protégée |
|---|---|
| `registerForEvent_rejectsDoubleRegistration` | Une même personne ne peut pas s'inscrire deux fois |
| `sendCertificate_refusedWhileSessionNotFinished` | Aucun certificat avant la fin de session |
| `sendCertificate_deliversPreparedCertificate` | L'envoi horodate, trace l'administrateur et notifie |
| `holdCertificate_keepsItInTheAdminQueue` | Différer ne notifie pas le participant |
| `parseDuration_*` | « 3 jours », « 2h30 », « 90 min » → durée réelle ; libellé illisible → journée type (jamais de clôture prématurée) |
| `refresh_completesFinishedSessionAndPreparesCertificate` | Clôture automatique + passage en préparation |
| `refresh_neverReopensACertificateAlreadyDecided` | Un certificat envoyé ne repasse jamais en préparation |
| `steps_flagAttendanceAsMissedOnceTheSessionIsOver` | L'absence est signalée sans bloquer la clôture |

### `user-service`

Unicité du compte Keycloak, mise à jour partielle du profil qui ne doit pas
effacer le département ni le rôle, et `enabled = null` (colonne ajoutée après
coup) interprété comme « actif » — sinon tous les comptes historiques seraient
bloqués.

### `notification-service`

Sujet et corps par type d'événement, et surtout les cas dégradés : message sans
destinataire ignoré, **JSON malformé qui ne remonte pas en exception** (sinon
RabbitMQ redélivre en boucle et bloque la file pour tout le monde), et panne du
stockage in-app qui ne prive pas le destinataire de son email.

## 4. Tests d'API et de sécurité

`RegistrationControllerSecurityTest` charge la **configuration de sécurité de
production** (`@Import(SecurityConfig.class)`) et non une sécurité désactivée :
ce qui est vérifié est ce qui s'appliquera réellement.

| Scénario | Attendu |
|---|---|
| Appel sans jeton | `401` |
| Vérification publique d'un billet | `200` sans authentification |
| File des certificats — participant / organisateur | `403` |
| File des certificats — administrateur | `200` |
| Envoi de certificat — participant | `403` |
| Certificat : le sien, envoyé | `200` + `application/pdf` |
| Certificat : le sien, en préparation | `409` (le droit existe, l'état bloque) |
| Certificat : celui d'autrui | `403` |
| Certificat : administrateur, avant envoi | `200` (contrôle avant délivrance) |
| Inscription inconnue | `404` |

La distinction `403` / `409` est délibérée : elle permet à l'interface d'afficher
« vous n'avez pas le droit » ou « votre certificat n'est pas encore délivré »,
deux messages très différents pour l'utilisateur.

## 5. Tests d'intégration (Testcontainers)

`RegistrationRepositoryIT` démarre un **MongoDB 6.0 éphémère** et valide ce que
des mocks ne peuvent pas prouver :

- la requête `@Query` explicite `countCheckedIn` (nommée ainsi parce que
  `countByCheckedIn` serait interprété via le mot-clé `In`) ;
- les requêtes dérivées (`findByEventId`, `findByAttendeeId`, `existsBy…`) ;
- l'**aller-retour de mapping** de l'entité, y compris les `LocalDateTime` et les
  champs d'avancement/certificat ajoutés après coup ;
- les valeurs par défaut du constructeur, qui distinguent une inscription récente
  d'une fiche héritée que le service doit compléter.

### Condition d'exécution

Les tests portent `@EnabledIf("dockerAvailable")` :

- **en intégration continue** (runner Linux, socket Docker standard) la condition
  est vraie, les tests s'exécutent et un échec fait échouer le pipeline. Le
  workflow comporte de plus une étape qui **échoue si un test d'intégration a été
  ignoré**, pour interdire toute fausse assurance ;
- **sur un poste où Docker Desktop refuse l'accès au socket au client Java**, ils
  sont ignorés plutôt que de faire échouer tout le build sur un problème
  d'environnement.

Il ne s'agit jamais de masquer un échec : la condition porte sur la disponibilité
de l'infrastructure, pas sur le résultat du test.

## 6. Tests frontend

Stack : **Vitest en mode navigateur** (Chromium via Playwright), builder
`@angular/build:unit-test` déjà configuré dans le projet.

| Cible | Ce qui est protégé |
|---|---|
| `shared/role.ts` | Priorité `ADMIN > ORGANISATEUR > PARTICIPANT`. Le realm attribue `PARTICIPANT` à tout le monde : sans cette priorité, un administrateur perdrait son espace |
| `shared/participation.ts` | Libellés et tons des 4 états de certificat ; un état inconnu n'est **jamais** annoncé comme téléchargeable |
| `services/api.service.ts` | URL et verbe de chaque appel du workflow de certificat, encodage des paramètres, `responseType: blob` pour le PDF, propagation des codes d'erreur |
| `views/pages/login` | La connexion délègue entièrement à Keycloak (aucun identifiant manipulé par l'application) |

### Deux défauts réels corrigés au passage

1. **`keycloak.config.ts` mal typé.** `KeycloakConfig` est une union
   (`KeycloakServerConfig | GenericOidcConfig`) ; la variante OIDC générique ne
   porte ni `url` ni `realm`. Le build applicatif tolérait l'accès, **le build de
   test le refusait** : la compilation des tests était donc impossible. Corrigé en
   typant précisément la variante utilisée.
2. **`login.component.spec.ts` cassé** (`NG0201 : aucun fournisseur pour
   KeycloakService`) depuis que le composant délègue à Keycloak. La spec datait du
   gabarit CoreUI. Réparée et enrichie plutôt que supprimée.

## 7. Tests de bout en bout (Playwright)

14 scénarios exécutés dans un vrai Chromium contre la plateforme complète
(`frontend/e2e/`). C'est le seul étage qui prouve que la chaîne entière — clic,
redirection Keycloak, jeton, gateway, microservice, rendu Angular — fonctionne
ensemble.

### Authentification et rôles (`auth-roles.spec.ts`)

| Scénario | Vérifie |
|---|---|
| Visiteur non authentifié sur `/user` | Renvoi sur l'accueil public par l'AuthGuard |
| Identifiant invalide | Refus par Keycloak, message du realm, **et aucun accès ensuite** |
| Participant / administrateur / formateur | Chacun atteint bien son espace |
| Participant → `/admin` | Détourné : il ne voit jamais la page d'administration |
| Participant → `/users` | Détourné |
| Formateur → `/admin?tab=certificates` | Détourné : la délivrance est réservée à l'administration |

### Parcours métier (`certificats.spec.ts`)

| Scénario | Vérifie |
|---|---|
| Espace participant | Les quatre libellés de certificat sont lisibles, dont « votre certificat est en cours de préparation » |
| Progression | Pourcentage et jalons (« Inscription validée », « Session terminée ») affichés |
| Téléchargement | Le bouton PDF n'apparaît **que** sur un certificat délivré (1 seul dans le jeu de données) |
| File administrateur | Certificats groupés par session, avec « Envoyer » et « Garder en attente » |
| Tableau de bord admin | Signale les certificats à délivrer |
| Catalogue | Les sessions publiées apparaissent, celle en attente de modération **non** |

### Deux particularités du parcours réel qu'il a fallu prendre en compte

1. **L'application ne redirige pas vers Keycloak.** Elle s'initialise en
   `check-sso` ; un visiteur non authentifié est envoyé sur `/welcome`, d'où la
   connexion est une action explicite. Le helper suit donc le parcours réel :
   `/welcome` → clic → Keycloak → retour.
2. **Un écran d'accueil animé (`SplashComponent`) recouvre l'application** et ne
   révèle son bouton qu'après 1,4 s. `isVisible()` répond immédiatement et
   concluait donc à tort à son absence : il faut réellement attendre son
   apparition avec `waitFor({ state: 'visible' })`.

### Prérequis et lancement

```bash
docker compose up -d
pwsh -File scripts/seed-test-data.ps1     # jeu de données déterministe

cd frontend
npx playwright install chromium           # première fois
npm run e2e                               # sans interface
npm run e2e:headed                        # en observant le navigateur
npm run e2e:report                        # rapport HTML
```

En intégration continue, ces tests ne tournent que sur la branche principale et
en déclenchement manuel : ils démarrent 16 conteneurs, ce qui est trop lourd
pour être imposé à chaque pull request.

## 8. Couverture

JaCoCo produit des rapports **HTML et XML** par module
(`backend/<service>/target/site/jacoco/`), publiés comme artefact de CI.

Le seuil (`jacoco.line.coverage`) est **actif à 30 % par module** et vérifié à
chaque `mvn verify`. Il a été confirmé réellement bloquant : en forçant 0,90 sur
`feedback-service`, le build échoue avec
`Rule violated … covered ratio is 0.28, but expected minimum is 0.90`.

C'est un **cliquet anti-régression**, pas une cible : il est relevé au fur et à
mesure que les tests progressent (0 → 25 % → 30 %). Un seuil inatteignable fixé
d'emblée ne produit qu'une chose, la désactivation de la vérification.
L'objectif visé reste 70–80 % sur le code métier.

| Module | Couverture (hors config/entities/dto) |
|---|---|
| `feedback-service` | 78 % |
| `registration-service` | 61 % |
| `event-service` | 53 % |
| `ai-service` | 42 % |
| `user-service` | 41 % |
| `notification-service` | 33 % |
| `ticket-service` | 31 % |

Le seuil est neutralisé, avec justification écrite dans chaque POM, sur
`config-service`, `discovery-service` et `api-gateway` : ces modules ne
contiennent qu'une classe d'amorçage et de la configuration déclarative,
couverte de fait par les tests E2E.

## 9. Commandes

```bash
# Backend — tests unitaires seuls (rapide)
cd backend && mvn test

# Backend — chaîne complète : unitaires + intégration + couverture + seuil
cd backend && mvn verify

# Backend — un seul module
cd backend && mvn -pl registration-service verify

# Backend — analyse statique
cd backend && mvn -Pquality verify -DskipTests

# Frontend — tests
cd frontend && npm run test-ci

# Frontend — première exécution : installer le navigateur
cd frontend && npx playwright install chromium

# E2E (plateforme démarrée + jeu de données seedé)
cd frontend && npm run e2e
```
