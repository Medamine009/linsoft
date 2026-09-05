@echo off
REM ============================================================
REM  Active Hyper-V sur Windows 11 HOME (contournement officiel-DISM)
REM  >>> A LANCER EN ADMINISTRATEUR (clic droit -> Executer en tant qu'administrateur)
REM  Requis par OpenShift Local (CRC).
REM  Redemarre la machine a la fin.
REM ============================================================

net session >nul 2>&1
if %errorlevel% neq 0 (
  echo.
  echo [ERREUR] Ce script doit etre lance EN ADMINISTRATEUR.
  echo Clic droit sur le fichier -^> "Executer en tant qu'administrateur".
  echo.
  pause
  exit /b 1
)

echo === 1/2 : Ajout des paquets Hyper-V presents sur le systeme ===
pushd "%~dp0"
dir /b %SystemRoot%\servicing\Packages\*Hyper-V*.mum > hyperv-packages.txt 2>nul
for /f "usebackq %%i in ("hyperv-packages.txt") do (
  echo   + %%i
  dism /online /norestart /add-package:"%SystemRoot%\servicing\Packages\%%i" >nul 2>&1
)
del hyperv-packages.txt >nul 2>&1

echo.
echo === 2/2 : Activation de la fonctionnalite Hyper-V ===
dism /online /enable-feature /featurename:Microsoft-Hyper-V-All /LimitAccess /ALL

echo.
echo ============================================================
echo  Termine.  >>> REDEMARRE MAINTENANT ta machine <<<
echo  Apres le redemarrage, verifie avec :
echo     Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All
echo  (doit afficher State : Enabled)
echo ============================================================
echo.
pause
