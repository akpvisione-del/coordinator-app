# AKP VISIONE — manual staging logical export (READ-ONLY against Supabase).
# Prepared 2026-10-11. NOT EXECUTED.
# Requires Supabase CLI, Docker, and an interactive sign-in on the user's PC.
# Do not upload the resulting SQL files or connection credentials to GitHub.
# Project hard-locked: ttectcuirgdakjhpkkll
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$ProjectRef = 'ttectcuirgdakjhpkkll'
$OriginalLocation = (Get-Location).Path
$DateUtc = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$Folder = Join-Path (Join-Path $HOME 'AKP_BACKUPS_PRIVATE') ("STAGING_" + $ProjectRef + "_" + $DateUtc)

function Require-Tool([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Brak narzedzia: $Name. Zainstaluj je przed uruchomieniem."
  }
}

function Run-Checked([string]$Title, [string[]]$Arguments) {
  Write-Host ("--> " + $Title)
  & supabase @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw ("Niepowodzenie: " + $Title + " (kod " + $LASTEXITCODE + "). Backup NIEJEST gotowy.")
  }
}

function Assert-File([string]$Name) {
  if (-not (Test-Path -LiteralPath $Name -PathType Leaf)) {throw "Brak pliku: $Name"}
  $info=Get-Item -LiteralPath $Name
  if ($info.Length -lt 100) {throw "Plik pusty lub za maly: $Name ($($info.Length) B)"}
}

Require-Tool 'supabase'
Require-Tool 'docker'
$null = & docker info --format '{{.ServerVersion}}' 2>&1
if ($LASTEXITCODE -ne 0) {throw 'Docker nie dziala. Uruchom Docker Desktop i ponow.'}

Write-Host 'Cel: TYLKO staging ttectcuirgdakjhpkkll. Nic nie zostanie wgrane do bazy.'
Write-Host 'Nie uruchamiaj tego skryptu, jesli strona/appka wykonuje w tym czasie zapisy do staging.'
Write-Host 'Pliki SQL beda zawierac dane klientow i dane uwierzytelnienia; zachowaj je lokalnie.'
$ack=Read-Host 'Wpisz STAGING, by potwierdzic projekt do odczytu'
if ($ack -cne 'STAGING') {throw 'Przerwano bez eksportu.'}

New-Item -ItemType Directory -Path $Folder -Force | Out-Null
try {
  Set-Location $Folder
  Run-Checked 'Lokalna inicjalizacja Supabase (bez zmian zdalnych)' @('init')
  Run-Checked 'Logowanie Supabase CLI (autoryzacja)' @('login')
  Run-Checked ('Polacz TYLKO z ' + $ProjectRef) @('link','--project-ref',$ProjectRef)

  # Backups are logical exports only. No push/reset/migrate/storage writes.
  Run-Checked 'Eksport rol' @('db','dump','--linked','-f','roles.sql','--role-only')
  Assert-File 'roles.sql'
  Run-Checked 'Eksport schematu aplikacji' @('db','dump','--linked','-f','schema.sql')
  Assert-File 'schema.sql'
  Run-Checked 'Eksport danych z Auth oraz tabel aplikacji' @('db','dump','--linked','-f','data.sql','--use-copy','--data-only','-x','storage.buckets_vectors','-x','storage.vector_indexes')
  Assert-File 'data.sql'
  Run-Checked 'Eksport struktury historii migracji' @('db','dump','--linked','-f','history_schema.sql','--schema','supabase_migrations')
  Assert-File 'history_schema.sql'
  Run-Checked 'Eksport danych historii migracji' @('db','dump','--linked','-f','history_data.sql','--use-copy','--data-only','--schema','supabase_migrations')
  Assert-File 'history_data.sql'

  $Names=@('roles.sql','schema.sql','data.sql','history_schema.sql','history_data.sql')
  $Checks=@()
  foreach ($file in $Names) {
    $fileInfo=Get-Item -LiteralPath $file
    $hash=Get-FileHash -LiteralPath $file -Algorithm SHA256
    $Checks += [pscustomobject]@{File=$file;Bytes=$fileInfo.Length;SHA256=$hash.Hash}
  }
  $Checks | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath 'manifest.json' -Encoding UTF8

  # These statements check SQL file structure only; they never query the database.
  $Required=@(
    @{File='data.sql';Regex='COPY[ ]+public[.]akp_jobs'},
    @{File='data.sql';Regex='COPY[ ]+auth[.]users'},
    @{File='data.sql';Regex='COPY[ ]+public[.]akp_audit'},
    @{File='schema.sql';Regex='akp_internal[.]log_change'}
  )
  $Warnings=@()
  foreach ($item in $Required) {
    if (-not (Select-String -LiteralPath $item.File -Pattern $item.Regex -Quiet)) {
      $Warnings += ("Weryfikuj recznie: " + $item.File + " nie zawiera wzorca " + $item.Regex)
    }
  }

  if ($Warnings.Count -gt 0) {
    foreach ($warn in $Warnings) { Write-Warning $warn }
    Write-Warning 'Eksport wykonany, ale NIE oznaczaj go jako zaliczony bez sprawdzenia brakujacych sekcji.'
  } else {
    Write-Host 'Strukturalne sprawdzenie obecnosci tabel w dumpie: PASS.'
  }
  Write-Host ("EKSPORT ZAKONCZONY. Lokalizacja: " + $Folder)
  Write-Host 'Kopia NIE została przywrocona/testowana na drugiej bazie.'
  Write-Host 'NIE przesylaj plikow SQL ani hasel do ChatGPT, GitHub ani publicznie udostepnionego Google Drive.'
  Write-Host 'Przed zgoda na migracje potrzebny test odtworzenia w ODDZIELNYM srodowisku (osobny krok).'
}
finally {
  Set-Location $OriginalLocation
}
