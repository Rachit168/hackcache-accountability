# HC-P6-T01 — factual evidence

Status: LOCAL_FOUNDATION_VERIFIED / CONNECTED_CHECKS_NOT_RUN. Self-checks only. No production, security-completeness, deployment or independent-acceptance claim.

## Scope and provenance
- Repository root: `D:\project\Hack Cache`. No app/ directory or planning material copied.
- Existing root was empty and not a Git repository; no applicable ancestor/root AGENTS.md was found.
- Published organiser window begins 23 October 2026 at 21:30 IST. The owner explicitly instructed pre-window development. Work began at the observed 18:14:57 IST checkpoint. No organiser exception was supplied or inferred.
- Requested GPT-6.1 Sol / High / Standard. Actual execution model/effort/speed are not independently exposed: UNKNOWN.
- Node v24.19.0, npm 11.17.0, Git 2.55.0.windows.5. Existing tools reused.

## Executed checks
| Command/check | Actual result |
|---|---|
| npm install runtime dependencies; npm install --save-dev tooling | Completed; one package.json and package-lock.json. npm reported 0 audit vulnerabilities; this is not a security audit. esbuild install-script notice was printed; subsequent build worked. |
| npm run typecheck, first attempt | Failed: local test fixture config omitted three typed fields. Corrected. |
| npm test | 11 focused tests passed. Local validation/API dependency stubs, not connected evidence. |
| npm run typecheck, repeated after correction | Passed. |
| npm run build | Passed; client and single-process Node server built. Vite warned of a client chunk above 500 kB (564.32 kB, gzip 162.91 kB); no performance acceptance claimed. |
| npm run integration-check | Exit 2, CONNECTED_CHECKS_NOT_RUN. Dedicated configuration and real identities unavailable. |
| PORT=3000; npm start | Built server started, reporting SETUP_NEEDED. |
| GET /api/health | HTTP 200, configured:false. Process health only. |
| GET /cases/10000000-0000-4000-8000-000000000001 | HTTP 200 frontend document; route refresh fallback works. No case read claimed. |
| GET private case API without token | HTTP 401. |
| Real browser smoke | Setup-needed notice visible. Entered fictional narrative, added and filled four concerns, checked declaration. Submission remained disabled. Receipt and persisted reload NOT RUN. |

Browser screenshot is a local generated artifact under qa/artifacts/, excluded from Git. Expected labels in teammate templates are not observed results.

## NOT RUN / NOT VERIFIED
- Hosted SQL migration and role/RLS/function-grant behavior.
- Managed citizen A submission and persisted readback/reload.
- Separate real managed citizen B access denial, real invalid-token checks, and forged workspace checks against hosted data.
- Database idempotency/concurrent repeat behavior, changed-payload conflict, operation rollback, direct runtime DML denial and pooled context cleanup.
- Browser receipt/reload, complete phone/accessibility acceptance, multilingual behavior and deployment.

The connected runner implements these API/database checks using two real anonymous sign-ins, a one-connection pool to force reuse, audit-only admin queries and fictional test-owned records. Its controlled invalid concern fails after case/original insertion; a subsequent audit query checks rollback. No remotely accessible failure-injection endpoint exists. The runner retains records rather than resetting shared state. Browser connected smoke remains a separate manual check.

## Resource observations
- Start: 2026-10-23 12:44:57 UTC / 18:14:57 IST; five-hour USED 0%, weekly USED 8%.
- First verification checkpoint: 12:53:03 UTC / 18:23:03 IST; five-hour USED 5%, weekly USED 9%.
- Bucket codex. Five-hour reset identifier 1792777498; weekly 1793304810. These are fresh-window observations, separate from the historical preflight at 42%.
- Same-window observed change at checkpoint: +5 percentage points. Shared-account activity/rounding prevents isolated task attribution. No paid/reset credits used. Final publication/resource checkpoint is recorded in the handoff after remote verification.

## Publication
GitHub identity verified through existing credential manager: Rachit168. Preferred repository lookup returned 404 before creation. Publication checkpoint and actual commit identities are recorded in docs/handoff.md after push; a local commit alone is not publication.
