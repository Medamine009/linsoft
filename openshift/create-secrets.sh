#!/usr/bin/env bash
#
# Génère les Secrets OpenShift avec des mots de passe aléatoires.
#
# À utiliser à la place de `oc apply -f 01-secrets.yaml` dès que le déploiement
# n'est plus une simple démonstration : les valeurs ne transitent alors jamais
# par le dépôt Git.
#
#   ./openshift/create-secrets.sh
#
# Les secrets existants sont mis à jour (`--dry-run` + `oc apply`), ce qui rend
# le script rejouable sans erreur « already exists ».

set -euo pipefail

command -v oc >/dev/null || { echo "La CLI 'oc' est requise."; exit 1; }

# openssl est présent sur macOS/Linux ; sinon on retombe sur /dev/urandom.
random_password() {
  if command -v openssl >/dev/null; then
    openssl rand -base64 24 | tr -d '\n/+=' | cut -c1-24
  else
    LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 24
  fi
}

apply_secret() {
  local name=$1; shift
  # shellcheck disable=SC2068
  oc create secret generic "$name" $@ --dry-run=client -o yaml | oc apply -f -
  echo "  secret/$name appliqué"
}

POSTGRES_PASSWORD=$(random_password)
RABBITMQ_PASSWORD=$(random_password)
KEYCLOAK_PASSWORD=$(random_password)

echo "Création des secrets dans le projet : $(oc project -q)"

apply_secret postgres-secret \
  --from-literal=POSTGRES_USER=postgres \
  --from-literal=POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  --from-literal=POSTGRES_DB=user_db

apply_secret rabbitmq-secret \
  --from-literal=RABBITMQ_DEFAULT_USER=linsoft \
  --from-literal=RABBITMQ_DEFAULT_PASS="$RABBITMQ_PASSWORD"

apply_secret keycloak-secret \
  --from-literal=KEYCLOAK_ADMIN=admin \
  --from-literal=KEYCLOAK_ADMIN_PASSWORD="$KEYCLOAK_PASSWORD"

# La clé Gemini n'est pas générée : elle est fournie par Google. Le secret est
# créé vide si la variable n'est pas définie, l'ai-service démarrant sans elle.
apply_secret ai-secret \
  --from-literal=GEMINI_API_KEY="${GEMINI_API_KEY:-}"

cat <<EOF

Secrets créés avec des mots de passe aléatoires.

Mot de passe administrateur Keycloak (à conserver maintenant, il n'est
affiché qu'une fois) :

    $KEYCLOAK_PASSWORD

Pour le relire plus tard :
    oc get secret keycloak-secret -o jsonpath='{.data.KEYCLOAK_ADMIN_PASSWORD}' | base64 -d
EOF
