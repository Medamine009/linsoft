<#
    seed-test-data.ps1 — Jeu de donnees de test LINSOFT Learning Center.

    Remet la plateforme dans un etat propre et coherent couvrant l'integralite du
    parcours : inscription -> progression -> cloture -> certificat en preparation
    -> traitement admin -> certificat envoye -> acces participant.

    Le script est IDEMPOTENT et REJOUABLE : toutes les dates sont calculees a
    partir de l'instant d'execution, donc le scenario reste valide quel que soit
    le jour du test. A relancer apres un `docker compose down -v`.

    Usage (stack demarree) :
        pwsh -File scripts/seed-test-data.ps1
        powershell -ExecutionPolicy Bypass -File scripts\seed-test-data.ps1

    Ce qu'il ecrit :
        Keycloak (realm pfe-events)  comptes + roles + mots de passe
        PostgreSQL user_db.users     fiches collaborateurs
        MongoDB  event_db            catalogue
        MongoDB  registration_db     inscriptions + avancement + certificats
        MongoDB  notification_db     notifications in-app (cloisonnees par destinataire)
        MongoDB  feedback_db         avis sur les sessions terminees

    Les donnees de test precedentes de ces collections sont supprimees.
#>

[CmdletBinding()]
param(
    [string] $KeycloakUrl   = 'http://localhost:8085',
    [string] $Realm         = 'pfe-events',
    [string] $KcAdmin       = 'admin',
    [string] $KcPassword    = 'admin',
    [string] $MongoContainer    = 'eventify-mongo',
    [string] $PostgresContainer = 'eventify-postgres'
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$scriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$datasetPath = Join-Path $scriptDir 'seed\dataset.json'

function Write-Step  { param($m) Write-Host "`n== $m" -ForegroundColor Cyan }
function Write-Ok    { param($m) Write-Host "   $m" -ForegroundColor Green }
function Write-Info  { param($m) Write-Host "   $m" -ForegroundColor Gray }
function Write-Warn2 { param($m) Write-Host "   $m" -ForegroundColor Yellow }

# ─────────────────────────── Preflight ───────────────────────────
Write-Step 'Verification de la stack'

if (-not (Test-Path $datasetPath)) { throw "Jeu de donnees introuvable : $datasetPath" }

foreach ($c in @($MongoContainer, $PostgresContainer)) {
    $state = (docker inspect -f '{{.State.Running}}' $c 2>$null)
    if ($state -ne 'true') { throw "Le conteneur '$c' n'est pas demarre. Lancez la stack puis relancez ce script." }
}
Write-Ok "Conteneurs $MongoContainer / $PostgresContainer operationnels"

$dataset = Get-Content $datasetPath -Raw -Encoding UTF8 | ConvertFrom-Json
Write-Ok "Jeu de donnees charge : $($dataset.users.Count) comptes, $($dataset.events.Count) sessions, $($dataset.registrations.Count) inscriptions"

# ─────────────────────────── Keycloak ───────────────────────────
Write-Step 'Keycloak : comptes et roles'

$tokenBody = @{ client_id = 'admin-cli'; username = $KcAdmin; password = $KcPassword; grant_type = 'password' }
try {
    $tokenResp = Invoke-RestMethod -Method Post -Uri "$KeycloakUrl/realms/master/protocol/openid-connect/token" `
        -Body $tokenBody -ContentType 'application/x-www-form-urlencoded'
} catch {
    throw "Authentification Keycloak impossible sur $KeycloakUrl : $($_.Exception.Message)"
}
$kcHeaders = @{ Authorization = "Bearer $($tokenResp.access_token)"; 'Content-Type' = 'application/json' }

function Invoke-Kc {
    param([string]$Method, [string]$Path, $Body)
    $uri = "$KeycloakUrl/admin/realms/$Realm$Path"
    if ($null -ne $Body) {
        # -InputObject, pas le pipeline : PowerShell 5.1 deballe les tableaux d'un
        # seul element, et Keycloak refuse un objet la ou il attend une liste de roles.
        $json = ConvertTo-Json -InputObject $Body -Depth 10 -Compress
        if ($Body -is [Array] -and -not $json.StartsWith('[')) { $json = '[' + $json + ']' }
        # Keycloak attend de l'UTF-8 : les prenoms accentues doivent passer intacts.
        $bytes = [Text.Encoding]::UTF8.GetBytes($json)
        return Invoke-RestMethod -Method $Method -Uri $uri -Headers $kcHeaders -Body $bytes
    }
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $kcHeaders
}

# Representations des roles applicatifs (necessaires pour le mapping)
$appRoles = @{}
foreach ($r in @('ADMIN', 'ORGANISATEUR', 'PARTICIPANT')) {
    $appRoles[$r] = Invoke-Kc -Method Get -Path "/roles/$r"
}

$idByKey = @{}
$created = 0; $updated = 0

foreach ($u in $dataset.users) {
    $existing = Invoke-Kc -Method Get -Path "/users?username=$([uri]::EscapeDataString($u.username))&exact=true"
    $kcUser = $null
    if ($existing -and $existing.Count -gt 0) { $kcUser = $existing[0] }

    if ($null -eq $kcUser) {
        Invoke-Kc -Method Post -Path '/users' -Body @{
            username      = $u.username
            email         = $u.email
            firstName     = $u.firstName
            lastName      = $u.lastName
            enabled       = $true
            emailVerified = $true
        } | Out-Null
        $kcUser = (Invoke-Kc -Method Get -Path "/users?username=$([uri]::EscapeDataString($u.username))&exact=true")[0]
        $created++
    } else {
        Invoke-Kc -Method Put -Path "/users/$($kcUser.id)" -Body @{
            email         = $u.email
            firstName     = $u.firstName
            lastName      = $u.lastName
            enabled       = $true
            emailVerified = $true
        } | Out-Null
        $updated++
    }

    $idByKey[$u.key] = $kcUser.id

    # Mot de passe : on ne touche jamais a celui des comptes existants du projet.
    $keep = $false
    if ($null -ne $u.keepPassword) { $keep = [bool]$u.keepPassword }
    if (-not $keep) {
        Invoke-Kc -Method Put -Path "/users/$($kcUser.id)/reset-password" -Body @{
            type = 'password'; value = $dataset.defaultPassword; temporary = $false
        } | Out-Null
    }

    # Role applicatif exact : on ajoute le bon et on retire les deux autres, sinon
    # un ancien role reste dans le jeton et fausse la vue resolue cote front.
    Invoke-Kc -Method Post -Path "/users/$($kcUser.id)/role-mappings/realm" -Body @($appRoles[$u.role]) | Out-Null
    foreach ($other in @('ADMIN', 'ORGANISATEUR', 'PARTICIPANT')) {
        if ($other -ne $u.role) {
            try { Invoke-Kc -Method Delete -Path "/users/$($kcUser.id)/role-mappings/realm" -Body @($appRoles[$other]) | Out-Null } catch { }
        }
    }
}
Write-Ok "$created compte(s) cree(s), $updated mis a jour — roles et mots de passe alignes"

# ─────────────────────────── Dates & derivations ───────────────────────────
Write-Step 'Calcul du scenario (dates relatives a maintenant)'

$now   = [DateTime]::UtcNow
$today = $now.Date

$eventById = @{}
foreach ($e in $dataset.events) {
    $start = $today.AddDays([int]$e.startOffsetDays).AddHours([int]$e.startHour)
    $end   = $start.AddHours([double]$e.durationHours)
    $eventById[$e.key] = [ordered]@{
        def   = $e
        oid   = $null          # attribue cote mongosh
        start = $start
        end   = $end
        phase = $(if ($now -gt $end) { 'TERMINEE' } elseif ($now -ge $start) { 'EN COURS' } else { 'A VENIR' })
    }
}

function Get-Progress {
    param([string]$Status, [bool]$CheckedIn, [DateTime]$Start, [DateTime]$End)
    if ($Status -eq 'CANCELLED' -or $Status -eq 'REJECTED') { return @{ status = 'CANCELLED';   percent = 0 } }
    if ($Status -ne 'CONFIRMED')                            { return @{ status = 'NOT_STARTED'; percent = 0 } }
    if ($now -gt $End)                                      { return @{ status = 'COMPLETED';   percent = 100 } }
    if ($now -ge $Start) {
        if ($CheckedIn) { return @{ status = 'IN_PROGRESS'; percent = 75 } }
        return @{ status = 'IN_PROGRESS'; percent = 50 }
    }
    return @{ status = 'NOT_STARTED'; percent = 25 }
}

$userByKey = @{}
foreach ($u in $dataset.users) { $userByKey[$u.key] = $u }

# Construction des inscriptions completes + controle de coherence
$regs   = @()
$issues = @()
$i = 0
foreach ($r in $dataset.registrations) {
    $i++
    $ev = $eventById[$r.event]
    if ($null -eq $ev) { $issues += "Inscription $i : session inconnue '$($r.event)'"; continue }
    $usr = $userByKey[$r.user]
    if ($null -eq $usr) { $issues += "Inscription $i : participant inconnu '$($r.user)'"; continue }

    $checkedIn = $false
    if ($null -ne $r.checkedIn) { $checkedIn = [bool]$r.checkedIn }
    $prog = Get-Progress -Status $r.status -CheckedIn $checkedIn -Start $ev.start -End $ev.end

    # Regle metier : un certificat n'existe que pour une session terminee.
    $cert = 'NOT_AVAILABLE'
    if ($prog.status -eq 'COMPLETED') {
        if ([string]::IsNullOrWhiteSpace($r.certificate)) { $cert = 'IN_PREPARATION' }
        else { $cert = $r.certificate }
    } elseif (-not [string]::IsNullOrWhiteSpace($r.certificate)) {
        $issues += "Inscription $i ($($r.user)/$($r.event)) : certificat '$($r.certificate)' alors que la session n'est pas terminee"
        continue
    }
    if ($checkedIn -and $now -lt $ev.start) {
        $issues += "Inscription $i ($($r.user)/$($r.event)) : presence validee avant le debut de la session"
        continue
    }

    $signup = $ev.start.AddDays(-[double]$r.daysBefore).Date.AddHours(9).AddMinutes(($i * 7) % 50)

    $checkedInAt = $null
    if ($checkedIn) { $checkedInAt = $ev.start.AddMinutes(-8 + (($i * 5) % 22)) }

    $completedAt = $null
    if ($prog.status -eq 'COMPLETED') { $completedAt = $ev.end }

    $sentAt = $null
    if ($cert -eq 'SENT') {
        $after = 2
        if ($null -ne $r.sentDaysAfterEnd) { $after = [double]$r.sentDaysAfterEnd }
        $sentAt = $ev.end.AddDays($after).Date.AddHours(10).AddMinutes(($i * 3) % 40)
    }

    $handledBy = $null
    if ($null -ne $r.handledBy) {
        $h = $userByKey[$r.handledBy]
        if ($null -ne $h) { $handledBy = "$($h.firstName) $($h.lastName)" }
    }

    $reminder = $false
    if ($null -ne $r.reminderSent) { $reminder = [bool]$r.reminderSent }

    $regs += [ordered]@{
        eventKey      = $r.event
        userKey       = $r.user
        status        = $r.status
        checkedIn     = $checkedIn
        checkedInAt   = $checkedInAt
        reminderSent  = $reminder
        signup        = $signup
        progress      = $prog.status
        percent       = $prog.percent
        completedAt   = $completedAt
        certificate   = $cert
        certSentAt    = $sentAt
        handledBy     = $handledBy
        notified      = ($prog.status -eq 'COMPLETED')
    }
}

if ($issues.Count -gt 0) {
    Write-Host "`nDonnees contradictoires detectees :" -ForegroundColor Red
    $issues | ForEach-Object { Write-Host "   - $_" -ForegroundColor Red }
    throw 'Le jeu de donnees est incoherent, rien n a ete ecrit.'
}
Write-Ok "$($regs.Count) inscription(s) validee(s) — aucune incoherence"

foreach ($k in $eventById.Keys) {
    $e = $eventById[$k]
    $confirmed = @($regs | Where-Object { $_.eventKey -eq $k -and $_.status -eq 'CONFIRMED' }).Count
    $e.confirmed = $confirmed
    $e.available = [Math]::Max(0, [int]$e.def.totalSeats - $confirmed)
    Write-Info ("{0,-3} {1,-9} debut {2}  fin {3}  {4} inscrit(s)" -f $k, $e.phase, $e.start.ToString('dd/MM HH:mm'), $e.end.ToString('dd/MM HH:mm'), $confirmed)
}

# ─────────────────────────── Notifications ───────────────────────────
$tpl = $dataset.notificationTemplates
$notifs = @()

function Add-Notif {
    param([string]$Email, $Template, [string]$EventTitle, [DateTime]$At, [hashtable]$Extra)
    $subject = $Template.subject.Replace('{event}', $EventTitle)
    $message = $Template.message.Replace('{event}', $EventTitle)
    if ($null -ne $Extra) {
        foreach ($k in $Extra.Keys) {
            $subject = $subject.Replace("{$k}", [string]$Extra[$k])
            $message = $message.Replace("{$k}", [string]$Extra[$k])
        }
    }
    $script:notifs += [ordered]@{
        email = $Email; subject = $subject; message = $message
        at = $At; read = ($At -lt $now.AddDays(-3))
    }
}

foreach ($r in $regs) {
    $ev    = $eventById[$r.eventKey]
    $title = $ev.def.title
    $email = $userByKey[$r.userKey].email

    if ($r.status -eq 'PENDING') {
        Add-Notif -Email $email -Template $tpl.REGISTRATION_REQUESTED -EventTitle $title -At $r.signup.AddMinutes(2)
    } else {
        Add-Notif -Email $email -Template $tpl.REGISTRATION_CONFIRMED -EventTitle $title -At $r.signup.AddMinutes(3)
    }
    if ($r.status -eq 'CANCELLED') {
        Add-Notif -Email $email -Template $tpl.REGISTRATION_CANCELLED -EventTitle $title -At $r.signup.AddDays(2)
    }
    if ($r.reminderSent -and $r.status -eq 'CONFIRMED') {
        $at = $ev.start.AddHours(-20)
        if ($at -lt $now) { Add-Notif -Email $email -Template $tpl.EVENT_REMINDER -EventTitle $title -At $at }
    }
    if ($r.progress -eq 'IN_PROGRESS') {
        Add-Notif -Email $email -Template $tpl.EVENT_IN_PROGRESS -EventTitle $title -At $ev.start.AddHours(1)
    }
    if ($r.progress -eq 'COMPLETED') {
        Add-Notif -Email $email -Template $tpl.EVENT_COMPLETED -EventTitle $title -At $ev.end.AddMinutes(5)
    }
    if ($r.certificate -eq 'PENDING_APPROVAL') {
        Add-Notif -Email $email -Template $tpl.CERTIFICATE_PENDING -EventTitle $title -At $ev.end.AddDays(1)
    }
    if ($r.certificate -eq 'SENT' -and $null -ne $r.certSentAt) {
        Add-Notif -Email $email -Template $tpl.CERTIFICATE_SENT -EventTitle $title -At $r.certSentAt.AddMinutes(2)
    }
}

# Tache en attente cote administration
$pendingCerts = @($regs | Where-Object { $_.certificate -eq 'IN_PREPARATION' -or $_.certificate -eq 'PENDING_APPROVAL' })
$pendingSessions = @($pendingCerts | ForEach-Object { $_.eventKey } | Sort-Object -Unique)
foreach ($a in @($dataset.users | Where-Object { $_.role -eq 'ADMIN' })) {
    Add-Notif -Email $a.email -Template $tpl.ADMIN_CERTIFICATE_TASK -EventTitle '' -At $now.AddHours(-2) `
        -Extra @{ count = $pendingCerts.Count; sessions = $pendingSessions.Count }
}
Write-Ok "$($notifs.Count) notification(s) in-app generee(s), cloisonnees par destinataire"

# ─────────────────────────── PostgreSQL ───────────────────────────
Write-Step 'PostgreSQL : fiches collaborateurs'

$sql = New-Object Text.StringBuilder
[void]$sql.AppendLine('BEGIN;')
[void]$sql.AppendLine('TRUNCATE TABLE users RESTART IDENTITY;')
$esc = { param($s) if ($null -eq $s) { 'NULL' } else { "'" + ($s -replace "'", "''") + "'" } }
foreach ($u in $dataset.users) {
    $kid = $idByKey[$u.key]
    [void]$sql.AppendLine(
        "INSERT INTO users (keycloak_id, email, first_name, last_name, role, department, phone_number, bio, profile_complete, enabled, created_at, updated_at) VALUES (" +
        (& $esc $kid) + ', ' + (& $esc $u.email) + ', ' + (& $esc $u.firstName) + ', ' + (& $esc $u.lastName) + ', ' +
        (& $esc $u.role) + ', ' + (& $esc $u.department) + ', ' + (& $esc $u.phone) + ', ' + (& $esc $u.bio) + ', ' +
        'true, true, NOW(), NOW());')
}
[void]$sql.AppendLine('COMMIT;')

$sqlFile = Join-Path $env:TEMP 'linsoft-seed-users.sql'
[IO.File]::WriteAllText($sqlFile, $sql.ToString(), (New-Object Text.UTF8Encoding($false)))
docker cp $sqlFile "${PostgresContainer}:/tmp/seed-users.sql" | Out-Null
$pgOut = docker exec -e PGCLIENTENCODING=UTF8 $PostgresContainer psql -U postgres -d user_db -v ON_ERROR_STOP=1 -f /tmp/seed-users.sql
if ($LASTEXITCODE -ne 0) { throw "Echec de l'insertion PostgreSQL : $pgOut" }
Remove-Item $sqlFile -Force
Write-Ok "$($dataset.users.Count) fiche(s) collaborateur ecrite(s) (anciennes fiches et orphelins supprimes)"

# ─────────────────────────── MongoDB ───────────────────────────
Write-Step 'MongoDB : catalogue, inscriptions, notifications, avis'

# Attention : en PowerShell, `0 -eq ''` vaut $true (la chaine vide est convertie
# vers le type de gauche). Le test de vacuite se fait donc APRES conversion en
# chaine, sinon un 0 legitime part en `null` et casse le mapping vers un int
# primitif cote Spring Data.
function JsVal  { param($v) if ($null -eq $v) { return 'null' }; $s = [string]$v; if ($s -eq '') { return 'null' }; return (ConvertTo-Json -InputObject $s -Compress) }
function JsDate { param($d) if ($null -eq $d) { return 'null' } return 'ISODate("' + ([DateTime]$d).ToString('yyyy-MM-ddTHH:mm:ss.fff') + 'Z")' }
function JsBool { param($b) if ($b) { return 'true' } return 'false' }
function JsNum  { param($n) if ($null -eq $n) { return 'null' }; $s = [string]$n; if ($s.Trim() -eq '') { return 'null' }; return ($s -replace ',', '.') }
# Format attendu par LocalDateTime.parse cote registration-service
function JsLocal { param($d) if ($null -eq $d) { return 'null' } return '"' + ([DateTime]$d).ToString('yyyy-MM-ddTHH:mm') + '"' }

$js = New-Object Text.StringBuilder
[void]$js.AppendLine('// Genere par scripts/seed-test-data.ps1 — ne pas editer a la main.')
[void]$js.AppendLine('const evDb = db.getSiblingDB("event_db");')
[void]$js.AppendLine('const rgDb = db.getSiblingDB("registration_db");')
[void]$js.AppendLine('const nfDb = db.getSiblingDB("notification_db");')
[void]$js.AppendLine('const fbDb = db.getSiblingDB("feedback_db");')
[void]$js.AppendLine('evDb.events.deleteMany({}); rgDb.registrations.deleteMany({}); nfDb.inapp_messages.deleteMany({}); fbDb.feedbacks.deleteMany({});')
[void]$js.AppendLine('const EV = {};')

foreach ($k in $dataset.events.key) { [void]$js.AppendLine("EV[`"$k`"] = new ObjectId();") }

# ─── Catalogue ───
[void]$js.AppendLine('evDb.events.insertMany([')
$rows = @()
foreach ($e in $dataset.events) {
    $ev  = $eventById[$e.key]
    $org = $userByKey[$e.organizer]
    $rows += ('{ _id: EV["' + $e.key + '"]' +
        ', title: '        + (JsVal $e.title) +
        ', description: '  + (JsVal $e.description) +
        ', eventDate: '    + (JsDate $ev.start) +
        ', location: '     + (JsVal $e.location) +
        ', organizerId: '  + (JsVal $idByKey[$e.organizer]) +
        ', organizerEmail: ' + (JsVal $org.email) +
        ', organizerName: ' + (JsVal "$($org.firstName) $($org.lastName)") +
        ', category: '     + (JsVal $e.category) +
        ', price: '        + (JsNum $e.price) +
        ', totalSeats: '   + (JsNum $e.totalSeats) +
        ', availableSeats: ' + (JsNum $ev.available) +
        ', status: '       + (JsVal $e.status) +
        ', type: '         + (JsVal $e.type) +
        ', mode: '         + (JsVal $e.mode) +
        ', visioLink: '    + (JsVal $e.visioLink) +
        ', level: '        + (JsVal $e.level) +
        ', duration: '     + (JsVal $e.duration) +
        ', prerequisites: ' + (JsVal $e.prerequisites) +
        ', speaker: '      + (JsVal $e.speaker) +
        ', certification: ' + (JsVal $e.certification) +
        ', latitude: '     + (JsNum $e.latitude) +
        ', longitude: '    + (JsNum $e.longitude) +
        ', createdAt: '    + (JsDate $ev.start.AddDays(-45)) +
        ', updatedAt: '    + (JsDate $now.AddDays(-1)) +
        ', _class: "com.pfe.events.eventservice.entities.Event" }')
}
[void]$js.AppendLine(($rows -join ",`n"))
[void]$js.AppendLine(']);')

# ─── Inscriptions ───
[void]$js.AppendLine('rgDb.registrations.insertMany([')
$rows = @()
$n = 0
foreach ($r in $regs) {
    $n++
    $ev  = $eventById[$r.eventKey]
    $usr = $userByKey[$r.userKey]
    $qr  = 'QR-' + [guid]::NewGuid().ToString() + '-'
    $rows += ('{ eventId: EV["' + $r.eventKey + '"].toHexString()' +
        ', attendeeId: '   + (JsVal $idByKey[$r.userKey]) +
        ', registrationDate: ' + (JsDate $r.signup) +
        ', status: '       + (JsVal $r.status) +
        ', qrCodeTicket: ' + (JsVal $qr) + ' + EV["' + $r.eventKey + '"].toHexString() + "-" + ' + (JsVal $idByKey[$r.userKey]) +
        ', checkedIn: '    + (JsBool $r.checkedIn) +
        ', checkedInAt: '  + (JsDate $r.checkedInAt) +
        ', ticketType: "Standard", ticketPrice: 0' +
        ', reminderSent: ' + (JsBool $r.reminderSent) +
        ', eventTitle: '    + (JsVal $ev.def.title) +
        ', eventLocation: ' + (JsVal $ev.def.location) +
        ', eventDateStr: '  + (JsLocal $ev.start) +
        ', eventDurationStr: ' + (JsVal $ev.def.duration) +
        ', attendeeName: '  + (JsVal "$($usr.firstName) $($usr.lastName)") +
        ', attendeeEmail: ' + (JsVal $usr.email) +
        ', attendeeFirstName: ' + (JsVal $usr.firstName) +
        ', progressStatus: ' + (JsVal $r.progress) +
        ', progressPercent: ' + (JsNum $r.percent) +
        ', completedAt: '  + (JsDate $r.completedAt) +
        ', completionNotified: ' + (JsBool $r.notified) +
        ', certificateStatus: ' + (JsVal $r.certificate) +
        ', certificateSentAt: ' + (JsDate $r.certSentAt) +
        ', certificateHandledBy: ' + (JsVal $r.handledBy) +
        ', _class: "com.pfe.events.registrationservice.entities.Registration" }')
}
[void]$js.AppendLine(($rows -join ",`n"))
[void]$js.AppendLine(']);')

# ─── Notifications in-app ───
[void]$js.AppendLine('nfDb.inapp_messages.insertMany([')
$rows = @()
foreach ($m in $notifs) {
    $rows += ('{ recipientEmail: ' + (JsVal $m.email) +
        ', subject: '   + (JsVal $m.subject) +
        ', message: '   + (JsVal $m.message) +
        ', senderRole: "SYSTEM"' +
        ', read: '      + (JsBool $m.read) +
        ', createdAt: ' + (JsDate $m.at) +
        ', _class: "com.pfe.events.notificationservice.entities.InAppMessage" }')
}
[void]$js.AppendLine(($rows -join ",`n"))
[void]$js.AppendLine(']);')

# ─── Avis ───
[void]$js.AppendLine('fbDb.feedbacks.insertMany([')
$rows = @()
foreach ($f in $dataset.feedbacks) {
    $ev = $eventById[$f.event]
    $rows += ('{ eventId: EV["' + $f.event + '"].toHexString()' +
        ', userId: '    + (JsVal $idByKey[$f.user]) +
        ', rating: '    + (JsNum $f.rating) +
        ', comment: '   + (JsVal $f.comment) +
        ', createdAt: ' + (JsDate $ev.end.AddDays([double]$f.daysAfterEnd)) +
        ', _class: "com.pfe.events.feedbackservice.entities.Feedback" }')
}
[void]$js.AppendLine(($rows -join ",`n"))
[void]$js.AppendLine(']);')

[void]$js.AppendLine('print("events="        + evDb.events.countDocuments());')
[void]$js.AppendLine('print("registrations=" + rgDb.registrations.countDocuments());')
[void]$js.AppendLine('print("notifications=" + nfDb.inapp_messages.countDocuments());')
[void]$js.AppendLine('print("feedbacks="     + fbDb.feedbacks.countDocuments());')

$jsFile = Join-Path $env:TEMP 'linsoft-seed.js'
[IO.File]::WriteAllText($jsFile, $js.ToString(), (New-Object Text.UTF8Encoding($false)))
docker cp $jsFile "${MongoContainer}:/tmp/seed.js" | Out-Null
$mongoOut = docker exec $MongoContainer mongosh --quiet --file /tmp/seed.js
if ($LASTEXITCODE -ne 0) { throw "Echec de l'insertion MongoDB : $mongoOut" }
Remove-Item $jsFile -Force
$mongoOut | ForEach-Object { Write-Ok $_ }

# ─────────────────────────── Recapitulatif ───────────────────────────
Write-Step 'Recapitulatif du scenario'

# Group-Object par nom de propriete ne voit pas les cles d'un dictionnaire :
# on passe par une expression.
Write-Host ''
Write-Host '   Certificats' -ForegroundColor White
foreach ($g in ($regs | Group-Object { $_.certificate } | Sort-Object Name)) { Write-Info ("{0,-18} {1}" -f $g.Name, $g.Count) }

Write-Host ''
Write-Host '   Avancement des inscriptions' -ForegroundColor White
foreach ($g in ($regs | Group-Object { $_.progress } | Sort-Object Name)) { Write-Info ("{0,-14} {1}" -f $g.Name, $g.Count) }

Write-Host ''
Write-Host '   Comptes de test (mot de passe des nouveaux comptes : ' -NoNewline -ForegroundColor White
Write-Host $dataset.defaultPassword -NoNewline -ForegroundColor Yellow
Write-Host ')' -ForegroundColor White
foreach ($u in $dataset.users) {
    $mine = @($regs | Where-Object { $_.userKey -eq $u.key })
    $suffix = ''
    if ($mine.Count -gt 0) { $suffix = "$($mine.Count) inscription(s)" }
    $pwd = $dataset.defaultPassword
    if ($null -ne $u.keepPassword -and [bool]$u.keepPassword) { $pwd = '(mot de passe existant conserve)' }
    Write-Info ("{0,-14} {1,-30} {2,-12} {3}" -f $u.role, $u.email, $suffix, $pwd)
}

Write-Host ''
Write-Ok 'Jeu de donnees de test en place.'
Write-Host ''
