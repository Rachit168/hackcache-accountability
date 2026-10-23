# HC-P6-B01 partial checkpoint — 2026-10-24 IST

Status: **INCOMPLETE — resource stop reached.** This checkpoint implements the event-ledger backend and an unreviewed browser verification action. It does not implement evidence upload or evidence-byte verification and does not satisfy B01 acceptance. Starting Git commit: ff4ddc9bd9387d2cab5c8b56e8f5e52c6d7d86da.

## Implemented and checked

- Applied additive migration 004_record_ledger.sql to the configured dedicated project. Migrations 001–003 and existing records remain intact. No new credential, public bucket, global setting, paid service or certificate override was used.
- INSERT triggers append submission, release, acknowledgement and response events within the same transaction as their domain row. Retry paths that return existing results append nothing. A per-case transaction advisory lock serializes appends. Application roles have no UPDATE/DELETE on the ledger and runtime cannot call append directly. Existing forced RLS and fixed search paths remain.
- Existing cases received one clearly labeled migration-time baseline snapshot, with version/action arrays sorted by UUID. This does not claim historical chronology or historical cryptographic protection. New writes append after that baseline.
- Authorized GET /api/records/:id returns private chain data only for the owner or assigned reviewer. Office identities are expressly denied. Verification is capped at 200 events and 8 MiB of payload text; a record beyond the cap returns an incomplete response.
- Browser-side verification recomputes SHA-256, checks sequence, case association, previous links and declared count/head. There is no database valid flag. The current citizen and reviewer actions explicitly say evidence bytes are not checked.

## Canonical envelope v1

Each event commits the ordered UTF-8 strings: `HC-LEDGER-1`, case UUID, decimal sequence, actor UUID, server UTC timestamp with six fractional digits, machine action, payload text, previous lowercase hexadecimal hash. Each string is framed as its UTF-8 byte length in decimal, a colon, then its exact bytes; concatenate frames and SHA-256 the result. The genesis previous hash is 64 ASCII zeroes.

`payload_text` is the exact immutable JSON text produced by PostgreSQL jsonb::text when the event is generated. It is a string in this envelope, not JSON to be reparsed and reserialized before hashing. This avoids cross-platform number/whitespace normalization ambiguity. Verifiers hash the retained text verbatim. No localized presentation labels are committed. New domain rows (including their immutable IDs, actor and stored time) are included; the ledger timestamp is separately assigned by the append function.

The retained head/count are read from the same database and are not external anchors. Rewriting the entire chain, or truncating it and replacing its head, can pass internal verification. Hashes do not establish the truth of an allegation or recording. External anchoring remains deferred.

## Actual checks

- npm test: 53 tests in 10 files passed. Six new tests cover UTF-8 framing, Unicode/nontrivial payload values against independent Node SHA-256, payload tamper, gaps/links, inconsistent head/count, unsupported version, missing history and legacy labeling. Tamper fixtures exist only in memory.
- npm run build: passed, including typecheck; client 610.32 kB minified / 174.56 kB gzip. Existing >500 kB Vite advisory remains.
- npx tsx qa/workflow-connected.ts: passed with six managed identities. New ledger assertions verify five ordered events, independent recomputation, owner/reviewer equality, office/unrelated denial and runtime mutation denial. The retained release race uses distinct PostgreSQL backends and observed blocking; identical retries retain one release/event and rollback adds none.
- npm run integration-check: passed after explicitly extending the permission audit for the new ledger table/functions, retaining prior role/grant/policy assertions. Foundation submission, readback, first-submission race, rollback and isolation passed.
- First workflow run returned 503 during submission; the cause was not established. A rollback-only SQL probe succeeded, and the next connected workflow run passed. Do not claim the initial error was proven transient authentication failure.
- First foundation run stopped at the old exact function inventory. The updated audit checks all old functions plus the ledger helpers, their fixed search paths and narrow EXECUTE grants; no production grant was relaxed.

## NOT RUN / not implemented

- Private file uploads, format/size validation, staging/finalization, immutable evidence metadata and Storage isolation: **NOT IMPLEMENTED**. No bucket or Storage policy was created.
- Evidence hashing against actual stored/downloaded bytes and changed-file tamper checks: **NOT IMPLEMENTED / NOT RUN**.
- Final browser citizen/reviewer journey, written-only browser submission, verification action, English/Hindi, 390px rendering, failed-upload retry and screenshots: **NOT RUN in B01**. Old screenshots do not establish this build's behavior.
- Legacy baseline verification and a race of different actions beyond the existing release retry race were not separately exercised.
- No independent acceptance is claimed. Do not call B01 complete or evidence-enabled.

## Reproduction and continuation

From D:\project\Hack Cache, reuse the ignored private .env; run npm run db:migrate, npm test, npm run build, npx tsx qa/workflow-connected.ts and npm run integration-check. All have been run as described above; repeat passed checks only after relevant changes. For the new UI action, npm start serves the built artifact; use an existing citizen receipt or assigned reviewer case and choose Verify this record. This UI reproduction is provided but was not browser-executed in this checkpoint.

Resume with private evidence staging/finalization and authenticated access, then bind the verified evidence manifest to the atomic submission event. Preserve current retries and written-only behavior. Add format, ownership, partial-finalization and file-tamper tests and finish the complete final-build browser matrix. Do not edit applied migration 004; use the next numbered migration.

## Resource observations

- Fresh baseline 2026-10-23 21:40:58 UTC: five-hour used 70%, weekly 11%; primary reset 1792795495.
- 21:43:26 UTC: 75% / 12%; before connected checks at 21:44:19 UTC: 75% / 12%.
- After the first checks: 76% / 12%, below 25% remaining. Stopped new implementation; only defect diagnosis, checking and checkpoint/publication followed.
- After connected reruns at 21:46:04 UTC: 77% / 12%, same reset window. These are shared-account observations, not isolated task cost. No model/speed change or paid/reset credit was used. Final time, usage and verified publication hash are reported in chat.
