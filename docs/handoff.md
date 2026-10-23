# Task 01 handoff

Current status: LOCAL_FOUNDATION_VERIFIED / CONNECTED_VERIFICATION_PENDING.

## Delivered
Typed written-intake frontend and Express API, shared Zod validation, private receipt/case route, managed Supabase authentication adapter, idempotent citizen workspace bootstrap, transactional restricted SQL commands, versioned migration, focused tests, connected check runner and teammate starter packets.

Application and Git root: `D:\project\Hack Cache`. All source folders live directly here. C: planning files are read-only context and excluded from this repository.

## Run
`npm ci`, configure ignored `.env` from `.env.example`, then `npm run dev`; or `npm run build` and `npm start`. Local built server uses http://127.0.0.1:3000 by default and honours PORT. Missing configuration shows a setup-needed state; it never creates a fake citizen or saves a complaint to browser storage.

## Required private operator setup
A new dedicated hackathon Supabase project; anonymous Auth enabled; project URL/publishable key/ref; matching dedicated-project confirmation; distinct runtime and migration database URLs; runtime password. Set these locally in `.env`, never in chat. Ensure the private schema stays unexposed, apply `npm run db:migrate`, then explicitly enable/run `npm run integration-check` against only that dedicated project. Billing was not activated. No cloud project was modified.

## Next bounded task
Finish Task 01 connected verification first: apply migration, inspect real role/RLS/grants, run separate-identity persistence/denial, idempotency/atomicity/context checks, then browser written entry → four concerns → receipt → reload. Correct observed failures within this slice. Only then advance to reviewer-approved office projections and the incomplete-response loop; AI, uploads and escalation remain deferred.

## Evidence and limits
See task-01-evidence.md for actual commands, initial typecheck failure/correction and skips. Eleven local tests passed; connected checks were NOT RUN. Full hash-chain verification is NOT IMPLEMENTED. Browser-managed anonymous sessions do not establish institutional identity or guarantee cross-device recovery. Self-checks are not independent acceptance.

Pre-window development was explicitly requested by the owner and is disclosed in README. Requested model GPT-6.1 Sol / High / Standard; observed backend settings UNKNOWN.

## Publication checkpoint
Pending the authorised repository creation, staged-file review, commit, push and remote verification. This section will be replaced with observed identities, not assumed success.
