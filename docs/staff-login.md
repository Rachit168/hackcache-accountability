# Janvaani staff login (private operator procedure)

Staff workspace URL: `/staff`. This address is intentionally not linked from citizen pages. Hiding the URL **does not** enforce security: server-side Supabase identity verification, `hc_private.demo_principals`, reviewer assignments, and office-scoped released versions enforce case access. A previously authenticated staff session stays available until it expires or is signed out, just like an ordinary staff dashboard.

## Fast demo setup — reviewer and office in one local run

This is the simplest way to see both staff ends. The app does **not** create roles from an entered email or password. A private administrator first creates each Supabase Auth account and records exactly one authorized role in `hc_private.demo_principals`. Passwords remain Supabase-managed. A reviewer additionally requires an explicit case assignment.

1. Open a PowerShell terminal in `D:\\project\\Hack Cache`. Pull the feature branch and check that your existing private `.env` contains the dedicated project's `MIGRATION_DATABASE_URL` (never paste it into chat).
2. Find the UUID of your existing fictional citizen complaint (the reference shown on its receipt).
3. Run this command, substituting the UUID. PowerShell will privately prompt for the project-specific Supabase service-role/secret key and **two separate new emails and passwords**:

```powershell
Set-Location 'D:\project\Hack Cache'
.\scripts\provision-staff-pair.ps1 -ReviewerCaseId 'PUT-YOUR-CASE-UUID-HERE'
```

If you already created one or both accounts, **do not rerun** the pair helper: it deliberately refuses to overwrite existing identities or change existing roles. Use the separate administrator assignment procedure below if your reviewer exists but the inbox is empty. For the helper, a unique, previously unused email is required for each new staff account. The key and passwords are process-only and cleared from environment variables when the script finishes.

4. Open `http://127.0.0.1:5173/staff` (or your current local frontend URL) in a **new browser profile** and sign in with the reviewer email/password. Expect **Reviewer workspace** and exactly the cases assigned to that reviewer. Open the assigned complaint, inspect private evidence, then go to **Take action → Prepare office version → Preview outgoing content → Approve and release**. Any changed or omitted text needs a recorded review reason.
5. Sign out. In another browser profile, sign in using the separate office email/password. Expect **Office workspace**. Open the newly released case, choose **Take action**, acknowledge that specific version, then enter a written response. The action panel advances only when the server has recorded the prior operation; **History** remains read-only.
6. Open the original citizen receipt under the **same citizen browser identity** used to submit it. Reload and inspect the response and progress sections. A response is a recorded statement, **not a confirmed resolution**. The citizen may compare response coverage and record a separate internal dispute.

**If something fails:** A wrong password is different from a valid account without a provisioned role. The staff page now explains both cases. If authorization cannot be checked due to a temporary connection failure, use **Retry staff role check** without creating a new identity. If the reviewer has the right role but sees no cases, use administrator-only `database/assign-reviewer.ts` to assign an existing complaint. If the office sees no cases, make sure the reviewer released a version to the fictional sample municipal desk; office staff cannot see raw private submissions.

**Security:** Do not paste either password, service-role key, JWT/session file, `.env`, or database URI into ChatGPT, source control, presentation slides or browser screenshots. This is a fictional hackathon demonstration, not a real institutional role verification system.

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
