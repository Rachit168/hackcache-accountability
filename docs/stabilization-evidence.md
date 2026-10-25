# Stabilization — branch-only builder evidence

Start: ux/stepwise-upload-repair at 9c47ed68d93ef8664f440fd0e83ab921157be37c, clean. Main/local remote remained ffd2782c6cdacc273da0be243fddcd93211925c0. No AGENTS.md found. PowerShell 5.1 used for implementation commands; all artifacts beneath the project. Baseline 124 tests / 23 files and production typecheck/build passed. No deployment, merge, visibility or billing action is authorised.

## P0 office authorisation

Confirmed in real local Brave at port 3010 after importing a freshly provisioned office JSON: active import banner but GET /api/workflow 401, response “Sign in with a managed citizen account.” Captured request failed single-bearer shape validation; only counts/booleans and safe error response were inspected, no credentials printed. Old shared object spread combined its citizen Authorization with lowercase staff authorization. Three real composition regressions failed before correction: duplicate credentials, dropped Headers/tuple binary type, and middleware 401 rather than 200.

Canonical Headers now preserves content type/idempotency headers and explicit operator identity, skipping citizen session lookup. Operator failures carry authentication status without fallback. Missing, invalid/expired, denied and temporary failures have separate bilingual messages. Empty office queue says no version has been released to that department. Citizen queue requests are denied while owner per-case workflow remains supported. Server still requires a single valid bearer credential.

Nine focused auth/composition tests passed. Actual repaired browser request has one well-formed credential and HTTP 200 office queue. `npx tsx database/provision-demo.ts office` works without case UUID and produces an ignored private session; reviewer UUID requirements and office allowlist remain intact. Connected fixture checks and subsequent phase results follow below. No existing permissions or history was reset.
