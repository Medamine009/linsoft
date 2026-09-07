# openshift-wake.ps1 — relance la plateforme sur le Sandbox OpenShift.
#
# Le Sandbox met les deploiements a l'echelle zero apres quelques heures
# d'inactivite : les routes repondent alors 503 alors que tout est intact.
# Ce script remet les repliques a 1, dans l'ordre des dependances, et attend
# que chaque etage soit pret avant de passer au suivant.
#
# A lancer AVANT une demonstration (comptez ~6 minutes).
#
# Prerequis : oc login (console > votre nom > Copy login command).
#   powershell -File scripts/openshift-wake.ps1
$ErrorActionPreference = 'Stop'

$oc = (Get-Command oc -ErrorAction SilentlyContinue).Source
if (-not $oc) { $oc = "$env:USERPROFILE\oc\oc.exe" }
if (-not (Test-Path $oc)) { throw "oc introuvable. Ajoutez-le au PATH." }

& $oc whoami | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Non connecte. Console OpenShift > votre nom > Copy login command > Display token." -ForegroundColor Red
    exit 1
}
Write-Host "Projet : $((& $oc project -q).Trim())" -ForegroundColor Green

# L'ordre compte : les services metier lisent leur configuration sur
# config-service et s'enregistrent aupres de discovery-service.
$etages = @(
    @{ nom = 'Infrastructure'; deploys = @('postgresdb','mongodb','rabbitmq','keycloak','mailhog') },
    @{ nom = 'Configuration';  deploys = @('config-service') },
    @{ nom = 'Annuaire';       deploys = @('discovery-service') },
    @{ nom = 'Services';       deploys = @('api-gateway','user-service','event-service',
                                           'registration-service','notification-service',
                                           'ticket-service','feedback-service','ai-service') },
    @{ nom = 'Front-end';      deploys = @('frontend') }
)

foreach ($e in $etages) {
    Write-Host "`n== $($e.nom) ==" -ForegroundColor Cyan
    foreach ($d in $e.deploys) { & $oc scale deploy/$d --replicas=1 | Out-Null }
    foreach ($d in $e.deploys) {
        & $oc rollout status deploy/$d --timeout=300s 2>&1 | Select-Object -Last 1 |
            ForEach-Object { Write-Host "  $_" }
    }
}

Write-Host "`n== Etat final ==" -ForegroundColor Cyan
& $oc get pods -o custom-columns='NOM:.metadata.name,PRET:.status.containerStatuses[0].ready,ETAT:.status.phase'

$route = & $oc get route eventify -o jsonpath='{.spec.host}'
Write-Host "`nApplication : https://$route" -ForegroundColor Green
