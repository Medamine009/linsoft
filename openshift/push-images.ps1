# push-images.ps1 - tag + push des images locales vers Quay.io
#
# Prerequis :
#   - Docker Desktop demarre
#   - Les images locales existent (docker compose build)
#   - docker login quay.io
#
# Usage :
#   ./openshift/push-images.ps1 -QuayUser akh901736
#   ./openshift/push-images.ps1 -QuayUser akh901736 -Tag latest
#
param(
  [Parameter(Mandatory = $true)][string]$QuayUser,
  [string]$Tag = "latest"
)

$services = @(
  "config-service",
  "discovery-service",
  "api-gateway",
  "user-service",
  "event-service",
  "registration-service",
  "notification-service",
  "ticket-service",
  "feedback-service",
  "ai-service",
  "frontend"
)

Write-Host "Cible : quay.io/$QuayUser/*:$Tag" -ForegroundColor Cyan
Write-Host ""

foreach ($s in $services) {
  $src = "eventify/${s}:$Tag"
  $dst = "quay.io/$QuayUser/${s}:$Tag"

  # Verifie que l'image source existe
  docker image inspect $src *> $null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "SKIP  $src (image locale introuvable - fais 'docker compose build')" -ForegroundColor Yellow
    continue
  }

  Write-Host "==> $src  ->  $dst" -ForegroundColor Green
  docker tag $src $dst
  docker push $dst
}

Write-Host ""
Write-Host "Termine. Pense a rendre chaque depot PUBLIC sur quay.io." -ForegroundColor Cyan
