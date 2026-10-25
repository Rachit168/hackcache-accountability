# Janvaani local-only staff demo setup (Windows PowerShell 5.1+).
# Runs existing guarded administrator provisioning. Does NOT sign up staff in the browser.
# Run only on the owner's machine with an isolated demo Supabase project.
param(
  [string]$ReviewerCaseId = ''
)
$ErrorActionPreference = 'Stop'
if ($ReviewerCaseId -and $ReviewerCaseId -notmatch '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') {
  throw 'ReviewerCaseId must be an existing UUID.'
}
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
if (-not (Test-Path '.env')) { throw 'Expected private .env at repository root; do not create credentials in source files.' }

function With-PrivateEnvironment([string]$variable,[System.Security.SecureString]$value) {
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($value)
  try {
    [Environment]::SetEnvironmentVariable($variable,[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer),'Process')
  } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}
try {
  $adminKey = Read-Host 'Dedicated Supabase service-role / sb_secret key (hidden)' -AsSecureString
  With-PrivateEnvironment 'SUPABASE_SERVICE_ROLE_KEY' $adminKey

  foreach ($kind in @('reviewer','office')) {
    Write-Host ('Provisioning a new ' + $kind + ' account. Use an email not already registered in this project.')
    $email = Read-Host ('New ' + $kind + ' email')
    if (-not $email -or $email -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$') { throw 'Valid account email required.' }
    $password = Read-Host ('New unique ' + $kind + ' password (12+ characters, hidden)') -AsSecureString
    if ($password.Length -lt 12) { throw 'Password must contain at least 12 characters.' }
    [Environment]::SetEnvironmentVariable('STAFF_ACCOUNT_EMAIL',$email,'Process')
    With-PrivateEnvironment 'STAFF_ACCOUNT_PASSWORD' $password
    try {
      if ($kind -eq 'reviewer' -and $ReviewerCaseId) {
        & npx tsx database/provision-staff-login.ts reviewer $ReviewerCaseId
      } else {
        & npx tsx database/provision-staff-login.ts $kind
      }
      if ($LASTEXITCODE -ne 0) { throw ($kind + ' provisioning failed. Check private config; do not retry blindly.') }
    } finally {
      Remove-Item Env:STAFF_ACCOUNT_EMAIL -ErrorAction SilentlyContinue
      Remove-Item Env:STAFF_ACCOUNT_PASSWORD -ErrorAction SilentlyContinue
      $password.Dispose()
    }
  }
  Write-Host 'Both roles provisioned. Sign in at /staff in separate browser profiles. Reviewer cases require an explicit case assignment.'
} finally {
  Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:STAFF_ACCOUNT_EMAIL -ErrorAction SilentlyContinue
  Remove-Item Env:STAFF_ACCOUNT_PASSWORD -ErrorAction SilentlyContinue
  if ($adminKey) { $adminKey.Dispose() }
}
