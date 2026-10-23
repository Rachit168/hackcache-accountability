# HC-P6-T01 — factual evidence

## Latest: HC-P6-T02 bounded correction

Task 02 baseline: clean `main` at reviewed commit `557d872d6644e13eecd316f5466d023f42b12f27`; no new applicable AGENTS.md found. All writes remain in `D:\project\Hack Cache`.

### Changes and actual local results
- Added five request-size regressions. Before the fix: three valid payload cases failed with HTTP 413; the field-overflow and excessive-body cases passed.
- Increased the parser cap from 128 KiB to 512 KiB (524,288 bytes). Raw narrative/concern bounds remain 12,000/2,000 UTF-16 units and 30 concerns. Length checks now precede trimming to prevent whitespace padding from bypassing those field bounds.
- Conservative maximum compact JSON bound: `6 * (12,000 + 30 * 2,000 + 1,079)` = **438,474 bytes**. The 1,079-byte empty envelope is multiplied by six as well, conservatively covering escaped property names and fixed string values. Six bytes represents a fully escaped UTF-16 unit (`\uXXXX`). JSON syntax padding/whitespace remains bounded by the transport; unbounded whitespace is not promised acceptance.
- Measured maximum Hindi JSON: **217,079 UTF-8 bytes**. Regressions also send quotes/backslashes/control escapes and every string/key fully Unicode-escaped through the actual Express parser to a local submission dependency.
- After correction: all **16 tests across two files passed**, including the five new regressions. Valid Hindi/escaped content reaches the submission dependency; invalid field lengths/counts still receive 400; an excessive body receives 413 without submission.
- One initial typecheck failed on the new helper's `unknown` argument to Supertest; corrected to `string | object`. Subsequent typecheck and production build passed. Existing chunk warning remains (564.41 kB, gzip 162.94 kB). No performance acceptance claimed.

### Connected verification strengthened — NOT EXECUTED
- Sequential receipt retries are explicitly labelled as such. Separate race pool uses max:2; both clients are pinned, distinct `pg_backend_pid()` values are asserted, and audit queries require actual blocking via `pg_blocking_pids` before releasing the first transaction. A fresh actor/key pair is checked as unused first. It then requires equal receipts, one case/original/event and the expected concerns, plus rejection of changed content under that key.
- Single-connection pool remains for context cleanup across commit/rollback.
- Catalog checks inspect application role attributes/memberships, table owners, enabled/forced RLS, policy definitions, function owners/SECURITY DEFINER/fixed search paths, schema grants, table/column privileges and PUBLIC ACLs. Runtime SELECT/INSERT/UPDATE/DELETE probes affect zero rows and are always rolled back. No grants/protections are changed by the checker.
- Private-schema exposure probe requires PostgREST to reject `hc_private` with HTTP 406 / PGRST106, rather than treating permission denial as proof of non-exposure. Dashboard management settings remain outside that probe.
- Audit database credentials are checked to target the explicitly confirmed dedicated project. Connected failures identify their stage without printing exception contents or credentials.
- Configuration presence inspection: **no .env** and all eight relevant environment variables absent. `npm run integration-check` actually returned **exit 2 / CONNECTED_CHECKS_NOT_RUN**. No hosted migration, permission audit, A/B identity check, race, persistence/rollback check or connected browser receipt/reload was performed. The new runner is source/typechecked, not validated on hosted PostgreSQL.
- Phase 1 acceptance remains **BLOCKED pending dedicated connected verification and browser journey**. No later product phases started.

Primary verification references: [PostgreSQL backend/blocking and privilege inquiry functions](https://www.postgresql.org/docs/current/functions-info.html), [PostgREST error definitions](https://docs.postgrest.org/en/stable/references/errors.html).

### Task 02 resource observations
- Start: 2026-10-23 13:35:06 UTC / 19:05:06 IST; five-hour used 17%, weekly used 11%.
- First verified correction: 13:37:53 UTC / 19:07:53 IST; five-hour used 19%, weekly used 11%.
- Bucket codex; reset identifiers 1792777498 (300-minute window) / 1793304810 (10,080-minute window). Shared-account changes are not isolated task cost. Final observed checkpoint and publication identity are in handoff below.
- Pre-handoff: 13:43:58 UTC / 19:13:58 IST, five-hour 22%, weekly 12%; same resets. Observed interval 8m52s, five-hour change +5 pp; attribution not isolated. Documentation finalisation followed this observation.
- Bounded correction commit `f6ffcee8877a17328d75734d201b1e12d689e58f` pushed successfully to the existing public repository. Local HEAD, git ls-remote and GitHub main API matched; new source/check files were present remotely. Nine staged files reviewed, no matching credential patterns or forbidden paths. A subsequent docs-only commit records this checkpoint; its final hash is supplied in chat.

The remaining sections are **historical Task 01 evidence**; they do not represent a second execution in Task 02.

Status: LOCAL_FOUNDATION_VERIFIED / GITHUB_PUBLISHED / CONNECTED_CHECKS_NOT_RUN. Self-checks only. No production, security-completeness, deployment or independent-acceptance claim.

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
GitHub identity verified through existing credential manager: Rachit168. Preferred repository lookup returned 404 before creation. Created https://github.com/Rachit168/hackcache-accountability (HTTP 201, public). Reviewed all 24 staged paths and ran a staged credential-pattern scan; no forbidden paths or matching credential patterns. Commit/push succeeded. Local HEAD, git ls-remote and remote GitHub main commit all matched `e4b4acd7e7582e1929fac591ed8aaaa4fdbad22e`. GitHub API confirmed owner/public/main and expected remote source files; generated artifacts and secret-bearing paths absent. This evidence update is a subsequent documentation commit; final HEAD identity is supplied in chat.

Final recorded resource checkpoint: 12:58:18 UTC / 18:28:18 IST, five-hour USED 8%, weekly USED 9%, unchanged reset identifiers. Start-to-checkpoint observed interval 13m21s, shared five-hour change +8 pp, non-isolated attribution. Evidence/publication finalisation followed; no new product features were started.
