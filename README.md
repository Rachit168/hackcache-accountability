# Janvaani — HackCache accountability foundation

**Task 01: LOCAL_FOUNDATION / CONNECTED_VERIFICATION_PENDING.** A fictional citizen complaint workspace. Written intake, four or more manually confirmed service/conduct/mixed concerns, private receipt and readback are implemented in source. Hosted persistence, managed-identity isolation and SQL privileges have **not been verified** until the dedicated Supabase checks pass. No live deployment or independent acceptance is claimed.

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
3. Configure `DATABASE_URL` for `hc_runtime` (direct) or `hc_runtime.PROJECT_REF` (Supavisor session pooler). Set `MIGRATION_DATABASE_URL` to the separate project admin connection. Use session/direct connections, not transaction-mode prepared-statement assumptions. Certificate verification remains enabled; install the appropriate trusted CA in the environment if your network requires it.
4. Choose a strong `HC_RUNTIME_PASSWORD`, URL-encode it in the runtime URL, then run `npm run db:migrate`. The migration creates the runtime role/password before ordinary requests use it. Do not share credentials in chat or Git. No admin credential is imported by request handlers.
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
