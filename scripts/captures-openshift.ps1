# captures-openshift.ps1 — produit les deux illustrations OpenShift du rapport.
#
# Prerequis : etre connecte au cluster.
#   1. Console OpenShift > ton nom (haut-droite) > "Copy login command" > "Display token"
#   2. Colle la commande :  oc login --token=sha256~... --server=https://...
#   3. Lance ce script :    powershell -File scripts/captures-openshift.ps1
#
# Produit dans le dossier img/ du rapport :
#   openshift-pods.png  — sortie reelle de `oc get pods`
#   openshift-app.png   — application ouverte depuis sa route publique
$ErrorActionPreference = 'Stop'

$IMG = $env:RAPPORT_IMG_DIR
if (-not $IMG) { $IMG = 'C:\Users\DELL\Desktop\Rapport\Rapport PFE amine\img' }
$FRONT = Join-Path $PSScriptRoot '..\frontend' | Resolve-Path

# ── 1. Verification de la session ────────────────────────────────────────────
$who = & oc whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Non connecte au cluster." -ForegroundColor Red
    Write-Host "Recupere la commande de connexion dans la console OpenShift"
    Write-Host "(ton nom > Copy login command > Display token), colle-la, puis relance."
    exit 1
}
$proj = (& oc project -q).Trim()
Write-Host "Connecte en tant que $who sur le projet $proj" -ForegroundColor Green

# ── 2. Sortie reelle de `oc get pods` ────────────────────────────────────────
$pods = (& oc get pods -o wide | Out-String).TrimEnd()
Write-Host "$(($pods -split "`n").Count - 1) pods releves"

# ── 3. URL publique de l'application ─────────────────────────────────────────
$host_ = ''
foreach ($r in @('eventify','frontend','linsoft')) {
    $h = & oc get route $r -o jsonpath='{.spec.host}' 2>$null
    if ($LASTEXITCODE -eq 0 -and $h) { $host_ = $h; break }
}
if (-not $host_) {
    $host_ = & oc get route -o jsonpath='{.items[0].spec.host}' 2>$null
}
if (-not $host_) { Write-Host "Aucune route trouvee : l'application n'est pas exposee." -ForegroundColor Yellow }
else { Write-Host "Route publique : https://$host_" -ForegroundColor Green }

# ── 4. Passage a Playwright pour le rendu ────────────────────────────────────
$data = @{ pods = $pods; url = $(if ($host_) { "https://$host_" } else { '' }); project = $proj; img = $IMG }
$json = $data | ConvertTo-Json -Depth 3
$tmp  = Join-Path $env:TEMP 'openshift-capture.json'
[IO.File]::WriteAllText($tmp, $json, (New-Object Text.UTF8Encoding($false)))

Push-Location $FRONT
try {
    $env:OPENSHIFT_DATA = $tmp
    & npx playwright test openshift.spec.ts --reporter=list
} finally {
    Pop-Location
}
