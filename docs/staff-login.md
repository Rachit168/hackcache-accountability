# Janvaani staff login (private operator procedure)

Staff workspace URL: `/staff`. This address is intentionally not linked from citizen pages. Hiding the URL **does not** enforce security: server-side Supabase identity verification, `hc_private.demo_principals`, reviewer assignments, and office-scoped released versions enforce case access. A previously authenticated staff session stays available until it expires or is signed out, just like an ordinary staff dashboard.

## Real email/password staff accounts (new)

Staff sign-in uses Supabase Auth email/password. **No public registration or client-selected role** is provided. Existing anonymous citizen accounts cannot authorize staff access.

A project operator with both the dedicated database migration credentials and the Supabase project service-role/secret key must create and authorize the account. The staff-login script `database/provision-staff-login.ts` is for private local use; never run it on Render or from a public website.

Prerequisites (all private):
- Existing project `.env` with valid `SUPABASE_URL`, `SUPABASE_PROJECT_REF`, `SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL`, `DEDICATED_PROJECT_CONFIRM`, `MIGRATION_DATABASE_URL`.
- Temporary process-only `SUPABASE_SERVICE_ROLE_KEY` from the matching Supabase project (do not confuse it with the publishable key).
- Temporary `STAFF_ACCOUNT_EMAIL` and a unique `STAFF_ACCOUNT_PASSWORD` of at least 12 characters.

PowerShell **5.1** example, entered interactively (avoid committing or pasting the resulting secrets). Run from `D:\project\Hack Cache`:

```powershell
Set-Location 'D:\project\Hack Cache'
$env:STAFF_ACCOUNT_EMAIL = Read-Host 'New staff email'
$key = Read-Host 'Supabase service-role key' -AsSecureString
$pass = Read-Host 'New unique staff password (12+ characters)' -AsSecureString
$ptrKey = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($key)
$ptrPass = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($pass)
try {
  $env:SUPABASE_SERVICE_ROLE_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptrKey)
  $env:STAFF_ACCOUNT_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptrPass)
  npx tsx database/provision-staff-login.ts office
  if ($LASTEXITCODE -ne 0) { throw 'Staff provisioning failed; review private configuration' }
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptrKey)
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptrPass)
  Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:STAFF_ACCOUNT_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:STAFF_ACCOUNT_EMAIL -ErrorAction SilentlyContinue
}
```

Use `reviewer` instead of `office` to create a reviewer account without an initial assignment; pass `reviewer CASE_UUID` to assign a specific existing case. Reviewers **do not** see every citizen complaint by default. This is intentional privacy protection. Office accounts see only versions released to their fictional department; they do not see raw submissions.

To add an existing complaint to a reviewer inbox, a **project administrator**, not the citizen or reviewer, explicitly assigns the already-provisioned actor ID:
`npx tsx database/assign-reviewer.ts REVIEWER_UUID CASE_UUID`
This does not create an account, cannot assign unrelated case scopes, and does not replace any pre-existing reviewer assignment. Case IDs are assignment metadata used by the administrator, **not** a login requirement for staff.

After provisioning, the employee logs in at `/staff` with the account email and password and chooses **Sign out securely** when finished. Do not distribute .cache session JSON files as real workplace credentials. Local development only retains a collapsed legacy session-import control for existing automated/manual fixture tests; production does not render it.

**Not verified here:** actual new email-password account provisioning, Supabase email-provider configuration, and browser login, until an authorized operator executes this script with their private project credentials. Unit/CI builds do not establish those claims.

## Staff screens

- `/staff`: authenticated, server-scoped inbox with case-reference search and live counts of cases actually returned by the server.
- `/staff/CASE_UUID`: focused sections for case overview, evidence/verification (reviewers only), role-appropriate actions, and attributed history/escalation.
- The UI does **not** fabricate SLA rankings, universal inbox metrics, contact information, departmental assignments, or governmental resolution status.

## Secure operation

Never share staff session JSON, service-role keys, access tokens, `.env`, or database migration credentials. Never store staff passwords in the repository. If public staff case access seems possible, test with a genuinely separate browser profile with no saved office token and inspect the actual API status—not the URL or a cached authenticated banner alone.
