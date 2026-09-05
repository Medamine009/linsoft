# Arret du projet PFE Event Management
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   ARRET du projet" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

Write-Host "`n[1/3] Arret des processus Java (microservices)..." -ForegroundColor Yellow
Get-Process java -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "  - Killing PID $($_.Id)"
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

Write-Host "`n[2/3] Arret du frontend Angular (node)..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "  - Killing PID $($_.Id)"
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

Write-Host "`n[3/3] Arret des conteneurs Docker..." -ForegroundColor Yellow
Set-Location "c:\Users\DELL\.gemini\antigravity\scratch\pfe_event_management"
docker compose stop

Write-Host "`n============================================" -ForegroundColor Green
Write-Host "   Tout est arrete." -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
