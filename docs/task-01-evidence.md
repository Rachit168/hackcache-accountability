# HC-P6-T01 — factual evidence

## Latest: HC-P6-T03 checker corrections and actual setup investigation

### Follow-up: project now verified, original resource stop reached

After the user reported creation, live browser headings/title confirmed `hackcache-accountability | HackCache | Supabase`; the project URL identified reference `vhfjobnvbbwfvdhwhxgb`. This resolves missing account access/project existence. A safe link inspection showed the dashboard's migration summary as No migrations; the agent did not apply any migration. No credential fields were inspected.

Presence-only local check still found no .env, all eight configuration variables absent and configuration ready=false. Anonymous Auth settings, usable connection credentials and hosted application behavior are not yet verified.

Fresh observation 2026-10-23 14:33:48 UTC / 20:03:48 IST: five-hour USED 40%, weekly 14%; same reset identifiers 1792777498 / 1793304810. The +12 pp change from Task 03's original 28% baseline meets its stop threshold (shared-account change, not isolated task cost). No new implementation, migration or connected acceptance began; project confirmation and checkpoint finalisation only. An explicit new bounded-run decision was requested rather than silently resetting the task baseline. Phase 1 remains unaccepted.

### Source inspection
- Started from clean reviewed HEAD `bbab1f9c4fdbe903661c31ad5a3e6a4291088bb8`; no new applicable AGENTS.md. All writes/caches/screenshots remain under the repository root.
- Confirmed the sequential race cleanup could skip B when A rollback threw, and could release a failed connection as reusable.
- Confirmed policy inspection required only nonempty expressions and would accept `true`.

### Local dependency checks — executed
- `withRaceClients` now owns acquisition/cleanup. Every acquired connection gets a cleanup attempt; A is attempted first to release B's wait. A cleanup exception cannot skip B. Rollback/pending-query cleanup is bounded to 10 seconds per connection; failed/uncertain cleanup discards the connection. Pending promises have rejection observers immediately. Original failures are preserved or combined with cleanup errors. Success logging occurs only after cleanup succeeds.
- Seven controlled local cleanup tests passed: ordinary success/release; original check failure; A rollback failure with B still cleaned; B rollback failure/disposal; unresolved pending query timeout; rejected pending query; A rollback hang with B still cleaned. These do not establish PostgreSQL behavior and do not rely on pool shutdown to detect leakage.
- Policy checker now requires exactly the six expected table/policy/role/command/permissive relationships and expected actor/workspace expressions for BOTH USING and WITH CHECK. Fail-closed token comparison ignores whitespace, parentheses, literal text casts and supported built-in qualification, without removing predicates/operators. It is a narrow checker for this migration, not a general SQL equivalence engine.
- Four local policy tests passed, including rejection of `true` on either expression of every policy, `OR true`, actor/workspace substitutions and wrong/extra policy relationships.
- Full local suite: **27 tests passed across four files**. Typecheck passed. Production build passed, retaining the existing 564.41 kB client chunk warning (gzip 162.94 kB). After the final checker-fixture/role-mode assertion refinement, targeted policy tests and typecheck passed again. No runtime feature was added.

### Connected source prepared — NOT RUN
- API tests use real managed A/B identities when configured, now compare the full concerns array and reject additional forged identity fields.
- Runtime-command negatives use hc_runtime, mismatched actor/workspace context and savepoints; read/submit must return SQLSTATE 42501. This is separate from direct-table privilege probes.
- A new policy-specific harness starts an isolated transaction through migration credentials, then SET LOCAL ROLE hc_writer. It verifies current role, no table ownership, no superuser/BYPASSRLS and row_security=on before data probes. It tests six actor/workspace combinations through direct SELECT on the four case tables, actor-only restrictions on bootstrap tables, and rejected INSERT on all six tables. All harness fixtures roll back; no policy/grant is weakened or replaced.
- Administrative catalog/count reads are audit observations, not restricted-runtime evidence. Direct hc_writer probes exercise RLS itself; runtime command probes exercise membership/command checks; authenticated HTTP checks exercise the API. All remain NOT RUN against hosted PostgreSQL.
- `npm run integration-check` returned **exit 2 / CONNECTED_CHECKS_NOT_RUN**. No hosted migration, real identity/persistence/race/RLS acceptance or browser receipt/reload was executed. No complete Phase 1 acceptance claimed.

### Actual setup/browser observations
- No Supabase tool is available. Local presence inspection (after correcting an ESM-only diagnostic command) found no .env and no required configuration variables; no secret values were printed.
- Existing Brave session initially redirected Supabase to sign-in. The user completed sign-in/authorization themselves. The authenticated dashboard then displayed **no organizations**, so no existing dedicated project was available in that account.
- Created a dedicated **HackCache** organization on the form's selected **Free ($0/month)** plan. Verified navigation to its new-project form. No paid plan/billing activation, account-security setting change or terms acceptance was performed by the agent.
- Prepared project name `hackcache-accountability`, disabled automatic exposure of new tables in the form, and left password entry/project submission to the user. The page displays an incident warning that may affect project creation in the selected Asia-Pacific region. No project creation failure is inferred from that warning.
- Exact current prerequisite: the user must choose the database password privately on that project form and create/confirm the dedicated project. Project existence/reference, anonymous Auth and usable connection credentials cannot be established before that step. This is a missing project/private credential setup, not a failed connected test.
- Screenshot of the prepared form is local-only under `qa/artifacts/task-03-project-setup.png`. No credentials were entered or captured. The browser tab is kept for the user handoff. The separate receipt/reload acceptance journey remains NOT RUN.

Primary references for harness execution: [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html), [SET ROLE](https://www.postgresql.org/docs/current/sql-set-role.html).

### Task 03 resource observations
- Start 2026-10-23 14:14:30 UTC / 19:44:30 IST: five-hour used 28%, weekly 12%.
- First verified correction checkpoint 14:18:56 UTC / 19:48:56 IST: five-hour 31%, weekly 13%.
- Setup checkpoint 14:25:47 UTC / 19:55:47 IST: five-hour 36%, weekly 14%.
- Bucket codex; reset identifiers 1792777498 / 1793304810 unchanged. The observed +8 pp is shared-account usage, not isolated task cost. No paid/reset credits or model/speed changes. Final publication/checkpoint details follow in handoff.
- Pre-handoff 14:28:42 UTC / 19:58:42 IST: five-hour 39%, weekly 14%, same resets; start-to-observation 14m12s and +11 pp shared five-hour change. Final docs/publication work followed. No new implementation started after that checkpoint.
- Pushed Task 03 correction `58257dfcd7e5ec3100bd96aea126667040121532`; local HEAD and remote main matched via git ls-remote. Ten staged files reviewed; no forbidden generated/secret paths or credential-pattern matches. Final documentation commit is a subsequent publication, reported in chat.

The Task 02 and Task 01 sections below are retained historical evidence.

## Historical: HC-P6-T02 bounded correction

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
