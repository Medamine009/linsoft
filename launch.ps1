# Script de lancement — PFE Event Management
$WorkingDir = "c:\Users\DELL\.gemini\antigravity\scratch\pfe_event_management"
$Backend = Join-Path $WorkingDir "backend"
$Frontend = Join-Path $WorkingDir "frontend"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   PFE EVENT MANAGEMENT - Lancement" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# 1) Infrastructure Docker
Write-Host ""
Write-Host "[1/3] Infrastructure Docker..." -ForegroundColor Yellow
Set-Location $WorkingDir
docker compose up -d
Write-Host "  Attente 8s pour Postgres/Mongo/Keycloak/RabbitMQ..." -ForegroundColor DarkGray
Start-Sleep -Seconds 8

# 2) Backend microservices (via JARs)
Write-Host ""
Write-Host "[2/3] Microservices backend..." -ForegroundColor Yellow

$services = @(
    [PSCustomObject]@{ Name = "discovery-service";    Port = 8761; Wait = 12 },
    [PSCustomObject]@{ Name = "api-gateway";          Port = 8080; Wait = 6 },
    [PSCustomObject]@{ Name = "user-service";         Port = 8081; Wait = 3 },
    [PSCustomObject]@{ Name = "event-service";        Port = 8082; Wait = 3 },
    [PSCustomObject]@{ Name = "registration-service"; Port = 8083; Wait = 3 },
    [PSCustomObject]@{ Name = "notification-service"; Port = 8084; Wait = 3 },
    [PSCustomObject]@{ Name = "ticket-service";       Port = 8086; Wait = 3 },
    [PSCustomObject]@{ Name = "feedback-service";     Port = 8087; Wait = 3 }
)

foreach ($svc in $services) {
    $svcName = $svc.Name
    $svcPort = $svc.Port
    $svcWait = $svc.Wait
    $svcDir = Join-Path $Backend $svcName
    $jar = Join-Path $svcDir "target\$svcName-1.0.0-SNAPSHOT.jar"

    if (-not (Test-Path $jar)) {
        Write-Host "  ! JAR manquant : $svcName - build en cours..." -ForegroundColor Yellow
        Push-Location $svcDir
        mvn package -DskipTests -q
        Pop-Location
    }

    Write-Host "  -> $svcName (port $svcPort)" -ForegroundColor Green
    $cmdLine = "title $svcName && java -jar `"$jar`""
    Start-Process -FilePath "cmd.exe" -ArgumentList "/k", $cmdLine -WorkingDirectory $svcDir
    Start-Sleep -Seconds $svcWait
}

# 3) Frontend Angular
Write-Host ""
Write-Host "[3/3] Frontend Angular..." -ForegroundColor Yellow
Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "title Frontend Angular && npm start" -WorkingDirectory $Frontend

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   PROJET LANCE !" -ForegroundColor Green
Write-Host "   Frontend : http://localhost:4200" -ForegroundColor Green
Write-Host "   Eureka   : http://localhost:8761" -ForegroundColor Green
Write-Host "   Keycloak : http://localhost:8085 (admin/admin)" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Comptes de test (mdp = Test123!) :"
Write-Host "   - admin-user        (role ADMIN)"
Write-Host "   - organisateur-user (role ORGANISATEUR)"
Write-Host "   - participant-user  (role PARTICIPANT)"
