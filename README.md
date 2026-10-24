# Janvaani — private grievance records and response accountability

**Current B01–B05 demonstration:** private evidence, source-linked intake, reviewed office responses, explicit fictional escalation, citizen disputes, response-coverage comparison, official-source guidance and an owner-only portable case package. Use fictional data only. No government complaint or appeal is filed by this application.

## Current release status — HC-P6-R01

- Repository exists at https://github.com/Rachit168/hackcache-accountability and is **private at 24 October 2026 preflight**. Visibility will not be changed without owner approval.
- **Live HTTPS app: https://hackcache-accountability.onrender.com** — Render Free Node service, actual public API and browser self-checks passed on 24 October 2026. Free hosting can sleep/cold-start; independent acceptance and production certification are not claimed.
- Public video/deck links are not supplied or verified. Repository publication awaits owner visibility approval; the application is deployed. See [release evidence](docs/r01-release.md), [deployment setup](docs/render-deployment.md) and [submission draft](docs/submission-package.md).

## Current capabilities and limits

- Citizens use real managed anonymous Supabase identities, confirm ordered concerns/declaration and receive a PostgreSQL-backed private receipt. Auth sessions/language preferences use browser storage; complaint persistence does not. Losing an anonymous session can lose access; cross-device recovery is not implemented.
- Private JPEG/PNG, PDF/plain-text, WAV/MP3/Ogg and WebM/MP4 evidence: at most five files, 8 MiB each and 30 MiB combined. Server content checks, opaque object identifiers, completed-upload staging and atomic associations; no antivirus/forensic claim. Owners and assigned reviewers can inspect evidence; offices and unrelated users cannot.
- Server-only OpenRouter provides explicit AI-assisted intake/transcription and source-linked response comparison. Citizen review/corrections are preserved. Invalid provider quotations fail safely. Exact-fixture prepared mode is disclosed; there is no silent prepared fallback. Visual-video interpretation is unsupported.
- Assigned reviewers approve separate outgoing text; separately provisioned fictional offices acknowledge/respond to exact versions. Explicit DEMO-ESC-1 activation/evaluation records fictional deadlines and escalation; no scheduler, statutory deadlines or actual authority forwarding.
- Citizens record immutable disputes targeting exact responses/versions with authorised references. A dispute is an attributed internal statement, not an official appeal or finding.
- Resolution Audit compares textual coverage against exact original concerns. Interpretations are unverified, and human selections/AI assessments are unsaved. Only selected source references survive reload. Citizen disagreement remains separate from factual findings.
- Six bilingual NALSA/CPGRAMS cards include source scope, verification date and unknown eligibility/jurisdiction. CPGRAMS applicability is conditional; no representation or filing is promised.
- Owner-requested ZIP includes originals, response versions, timeline, disputes, evidence manifest, raw audit references, guidance, canonical ledger, printable escaped HTML, file manifest and offline `verify.mjs`. Evidence bytes are omitted unless explicitly selected, reauthorised and rehashed. Unsaved analysis is NOT_CHECKED.
- “Verify this record” recomputes chain, displayed-original/concern/evidence-manifest consistency and actual retrieved-byte hashes. Unread bytes do not pass. Legacy baselines carry migration-time provenance. A privileged operator can rewrite/truncate an entire unanchored chain/head; neither hashes nor matching quotations establish truth, guilt or real-world resolution. ZIP manifests are similarly replaceable commitments.

## Current architecture, setup and verification

React/Vite + typed Express serve one same-origin frontend/API process; managed Supabase Auth verifies identities; restricted PostgreSQL transactional commands and forced RLS protect private records; private Supabase Storage holds evidence; OpenRouter keys remain server-only. Ordinary requests never use migration/admin credentials. Per-process limits are not distributed abuse protection. No production security certification or independent acceptance is claimed.

Use Node **24.19.0** (`.node-version`) and npm from repository root `D:\project\Hack Cache`. Run `npm ci`, configure the ignored `.env` from `.env.example`, then `npm run dev`; production: `npm run build` and `npm start`. The server binds `0.0.0.0` to platform PORT and serves nested case routes through the SPA fallback. `/api/health` reports process/config presence, not backend acceptance.

Runtime configuration: `SUPABASE_URL`, publishable `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_REF`, matching `DEDICATED_PROJECT_CONFIRM`, restricted `DATABASE_URL`, appropriate `SUPABASE_CA_CERT_PATH`, server-only `OPENROUTER_API_KEY` and explicit report/transcription models. Hosted service must exclude `MIGRATION_DATABASE_URL`, `HC_MIGRATION_PASSWORD`, `HC_RUNTIME_PASSWORD`, admin/service-role keys, local sessions and connected-check flags. TLS certificate/hostname verification stays enabled. Reuse the dedicated project and applied migrations 001–013; do not reset records. Local operator provisioning in `database/provision-demo.ts` produces ignored private staff-session files loaded through `/staff`; public visitors cannot self-promote to staff.

Run `npm test`, `npm run build` and read-only `node qa/release-safety.mjs`. Dedicated connected checks such as `npx tsx qa/package-connected.ts` require existing ignored configuration plus `RUN_CONNECTED_CHECKS=true`; they create retained fictional fixtures and may use separate local operator credentials for audit/provisioning. Never publish `.env`, `.cache`, `qa/artifacts`, private ZIPs or sessions. Local checks are not deployed acceptance.

**Demo:** fictional Meera selects evidence → explicitly processes/reviews draft or sees honest provider failure → confirms concerns/submits/reloads → verifies chain/display/bytes → assigned reviewer releases approved text → separate fictional office responds → explicit fictional escalation → citizen disputes exact response → compares source-linked response gaps → opens official guidance → selects evidence copies/downloads ZIP → extracts and runs `node verify.mjs`. Recheck office/unrelated denials and Hindi/phone layout.

No official filing, legal representation, verified allegation finding, scheduled escalation, full adjudication, public profiles, PDF export or government integration exists. Comprehensive accessibility and deployed acceptance remain separate checks. Confirmed teammate contributions have not been supplied; starter templates remain in `content/` and `qa/`. Historical evidence is retained in `docs/` and current [handoff](docs/handoff.md).

## Historical foundation reference — superseded by B01–B05 above

The original 23 October foundation description follows for provenance. Its capability/deferred/status statements describe that historical checkpoint, not the current application.

**Written foundation: CONNECTED_SELF_CHECKS_PASSED / BROWSER_JOURNEY_PASSED (23 October 2026).** A fictional citizen complaint workspace. Dedicated hosted Supabase persistence, separate managed-identity isolation, restricted SQL commands/RLS, atomicity, idempotency and context cleanup passed the recorded self-checks. The built local browser application submitted four concerns and reloaded the same receipt; a separate database audit matched the saved content exactly. This slice is ready for owner acceptance. No public application deployment, production readiness or independent acceptance is claimed.

Development began before the organiser's published 23 October 2026, 21:30 IST opening, following the owner's explicit instruction to proceed early. This records provenance; it is not organiser approval or a claim about entry eligibility.

## Run locally

Required: Node 24+, npm and a dedicated Supabase project for connected operation. Run commands from **`D:\project\Hack Cache`**, the repository root. There is no app/ subdirectory.

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

Open the Vite URL printed by the development server. Without configuration the form is available to explore, and sign-in/submission fail closed in a visible setup-needed state. Nothing is saved through browser storage as a substitute for PostgreSQL.

```powershell
npm run typecheck
npm test
npm run build
npm start
```

Production build: one Node process serves the frontend and `/api` on `PORT` (default 3000). Refresh `/cases/UUID` works through the frontend fallback. `GET /api/health` reports process health and configuration presence, not database readiness.

## Dedicated Supabase setup

1. Create a **new hackathon-only project** through your account. No account, project, billing or provider service was activated by this implementation. Enable managed anonymous sign-in. Configure the Auth site URL/allowed local redirect URL as appropriate. Anonymous identity persists in the browser's managed Auth session; it does not establish a real identity or cross-device recovery.
2. In the ignored `.env`, set `SUPABASE_URL`, the project's **publishable** key, `SUPABASE_PROJECT_REF` and the same ref in `DEDICATED_PROJECT_CONFIRM`. Never use a service-role/secret key as the publishable key.
3. Configure `DATABASE_URL` for `hc_runtime` (direct) or `hc_runtime.PROJECT_REF` (Supavisor session pooler). Set `MIGRATION_DATABASE_URL` to the separate project admin connection. Use session/direct connections, not transaction-mode prepared-statement assumptions. Set `SUPABASE_CA_CERT_PATH=database/certs/prod-ca-2021.crt` to use the official Supabase CA bundled with provenance. Certificate and hostname verification remain enabled; no global trust store is changed.
4. Choose a strong `HC_RUNTIME_PASSWORD`, URL-encode it in the runtime URL, then run `npm run db:migrate`. The migration creates the runtime role/password before ordinary requests use it. Do not share credentials in chat or Git. No admin credential is imported by request handlers.
   Alternatively, with the confirmed runtime URL configured, enter the original database password privately in `HC_MIGRATION_PASSWORD` and run `npm run setup:database`. This builds the separately encoded `MIGRATION_DATABASE_URL` locally, including passwords containing percent signs or reserved characters. The temporary password field stays private until the operator clears it after successful connection verification.
5. Ensure `hc_private` is **not** in Supabase's exposed Data API schemas. Browser code accesses managed Auth only; all case operations use `/api`. The migration removes schema/table/function privileges from `anon` and `authenticated`.
6. Run `RUN_CONNECTED_CHECKS=true` via the ignored `.env`, then `npm run integration-check`. It creates two real managed anonymous accounts and retained fictional test records. It deliberately does not reset a project or delete submission history. Use only the dedicated project. The script exits 2 with `CONNECTED_CHECKS_NOT_RUN` when setup is absent.

The operator performs project setup privately. No credentials are required in chat.

## Boundary and transaction design

Server-side `auth.getUser(token)` verifies managed tokens. Request body actor/workspace/role fields are rejected. The server boots the verified citizen workspace and membership idempotently, sets identity/workspace through transaction-local settings, and calls restricted commands. Transaction-local context is rolled back/committed before the pooled connection is released.

`hc_owner` owns tables and cannot log in. `hc_writer` owns fixed-search-path SECURITY DEFINER commands, is not table owner, has no BYPASSRLS and has SELECT/INSERT only. `hc_runtime` has no table grants or privileged role memberships; it has only schema usage and the three command EXECUTE grants. RLS checks the transaction context and stored membership. Runtime role safety is checked before commands. **Runtime SQL credentials are a trusted server boundary:** possession of them permits setting request context; this is not independent per-citizen database login authentication. Keep these credentials server-only.

One submission stores case, original narrative, ordered source-wording concerns and attributed submission event atomically. Actor + UUID idempotency key are unique. Identical normalized JSON returns the same receipt; different JSON under that key produces HTTP 409. The browser reuses the submission key on an unchanged retry; editing after an attempt generates a new key. It does not promise cross-reload retry recovery for an unconfirmed response.

No submitted-history edit/delete API exists. Events contain opaque original references; sensitive payloads stay private. **Full hash-chain/byte verifier: NOT IMPLEMENTED.** Append-only grants are not proof against privileged operator rewriting. This is a self-checked development foundation, not production security certification.

## Implemented and deferred

Implemented source: typed frontend/server, shared Zod validation, written form with up to 30 manual concerns, declaration, managed anonymous authentication adapter, receipt/print/private case route, SQL migration, protected API, focused tests and connected-check runner, teammate templates.

Deferred: AI extraction, uploads, office/reviewer roles and approved redactions, investigation/escalation clocks, findings, appeals, public records, legal-help content, full English/Hindi localization and accessibility acceptance, tamper verification and deployment. Receipt does not invent deadlines or imply any office was contacted. Manual concerns are labelled as manual entry.

See `docs/task-01-evidence.md` for actual check results and `docs/handoff.md` for the next bounded task. Content and QA examples are authored expectations, not observed outcomes.

## Primary implementation references

- [Supabase anonymous sign-in](https://supabase.com/docs/guides/auth/auth-anonymous)
- [Server-side getUser verification](https://supabase.com/docs/reference/javascript/auth-getuser)
- [PostgreSQL function security and search paths](https://www.postgresql.org/docs/current/sql-createfunction.html)
- [Published event schedule](https://cachedinfo.in/hackcache)
