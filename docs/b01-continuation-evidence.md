# HC-P6-B01 continuation — current result, 24 October 2026

**Implemented and self-verified; B01's real evidence journey works. No independent acceptance is claimed.** This supersedes the incomplete status in b01-evidence.md. Starting commit: 445d488e7d2fd7f0f7039456f34235c2521db133.

## Implementation and configuration

- Applied additive migration **005_private_evidence.sql**, retaining 001–004 and existing data. It adds completed upload metadata, immutable ordered complaint associations, narrow command functions, a private `hc-evidence` bucket and INSERT/SELECT Storage policies. No overwrite/delete policy is granted. Ordinary runtime uses hc_runtime and the caller's managed Storage JWT; migration credentials are never used for ordinary requests. No extra private credential, public bucket, paid service or security override was needed.
- Server-controlled paths are constructed from the verified actor UUID and UUID upload command key. The HTTP client cannot choose a storage path, owner or hash. Filename is retained as untrusted text and rendered as text. The server checks bytes, uploads without overwrite, retrieves the stored bytes, checks size/type/fingerprint again, then writes completed metadata. A retry uses the same upload key and must match existing stored content and metadata.
- Default limits: **five files, 8 MiB each, 30 MiB combined**. Server limits are defined in server/evidence.ts; SQL enforces hard ceilings. If changing limits, keep UI, server and SQL consistent; SQL changes require another migration. Supported content: JPEG/PNG, PDF, UTF-8 plain text, MPEG-frame MP3, RIFF/WAV, Ogg Opus/Vorbis, WebM and MP4. Checks inspect bounded signatures/container structure, not full media decoding, antivirus, forensic validity or truth. MP3 with an ID3-only prefix is not accepted by this initial allowlist implementation.
- Binary uploads have a separate 8 MiB raw-body route; ordinary JSON retains its 512 KiB bound. At most two evidence requests per server instance run concurrently; downloads/readback are capped and time out. This is not a distributed abuse-prevention service.
- Finalization locks and validates the complete ordered evidence set, rejects duplicate/foreign/already-associated IDs, enforces total size, and commits associations plus an `evidence_manifest` ledger event in the same transaction as submission. The submitted event and manifest event are separate entries in one atomic transaction. Failed attachment rolls back the complaint and all its events. Unchanged retry returns the original complaint without extra associations/events.
- Storage and PostgreSQL are deliberately separate: a stored object can remain if metadata/finalization fails. Retrying the same upload recovers a stored matching object; removing a draft item does not delete stored bytes. Unattached/orphan objects are retained for a future privileged, reviewed cleanup that excludes every submitted association. No ordinary delete/replace endpoint exists. Privileged project operators remain outside this protection.
- Downloads use a fresh authenticated server route with attachment disposition, octet-stream, nosniff and sandbox CSP. No signed bearer URL is issued or logged. Owners and assigned reviewers can retrieve bytes; unrelated citizens/reviewers and office identities cannot. Approved office text projections remain separate.

## Verification behavior

The versioned length-prefixed canonical envelope from migration 004 is unchanged (specified in b01-evidence.md). The browser recomputes chain hashes and checks sequence/links/head/count. The authorized record bundle also reads the actual original narrative and ordered concerns from domain tables and compares them to the submitted payload, or the case payload committed in a migration baseline. Its evidence list must exactly match the committed manifest. Per-file verification independently retrieves actual Storage bytes and compares their byte count and SHA-256 to metadata; each file has a separate verified/mismatch/unavailable state. Metadata-only readback is never called byte verification.

Legacy comparison covers only fields committed in migration 004; it does not invent earlier ordering or protection. The UI labels migration-time baselines. Hashes do not prove allegations or recordings true. A privileged operator can rewrite an entire unanchored chain, or truncate it and replace its head/count; external anchoring is still deferred.

## Executed checks and observed failures

- **58 local tests / 11 files passed**, covering supported structural signatures, empty/unsupported/oversized input, bounded downloads, changed bytes, Unicode canonical framing, tampered events, gaps, head/count mismatch and displayed narrative/ordered-concern/manifest mismatch.
- **Typecheck and production build passed**. Final client 617.37 kB minified / 176.63 kB gzip; existing Vite >500 kB advisory remains.
- **qa/evidence-connected.ts passed** using five real managed identities and actual private Storage. It checks stored readback hashes, upload replay, invalid/oversized files, forged fields, atomic failed/foreign/cross-case finalization, manifest conflict, exact associations, chain/display/byte agreement, owner/reviewer access, unrelated citizen/reviewer and office API/Storage denial, public denial, overwrite/delete prevention, written-only submission and explicit rollback. A disposable object with intentionally mismatched staging metadata returns `mismatch`; retained complaints/files were not corrupted. Display-tamper checks use in-memory copies of an authorized retrieved bundle.
- **qa/workflow-connected.ts passed**: six identities, preserved reviewer/office projections and actions, retries, rollback, and independent-backend identical-command race. **npm run integration-check passed**: existing foundation, first-submission race, RLS behavior and expanded narrow-permission audit. No grants were relaxed to get a pass.
- **qa/ledger-append-connected.ts passed**: distinct fresh keys, two database backends, observed blocking, two distinct results, two sequential new events, and independently recomputed valid chain. It uses withRaceClients for bounded rollback/connection cleanup. Requires the private fixtures from workflow-connected.ts.
- The first evidence connected attempt returned 503 during upload. A separate Storage upload/read/metadata probe succeeded and the evidence-suite retry passed; the initial cause was not established. The distinct-append checker initially failed using an old saved session; adding managed-session refresh allowed its rerun to pass. Failed attempts are retained here rather than counted as passes.

## Final production-build browser demonstration

Served dist/server.js on local port 3004. Created a real managed citizen session; selected fictional UTF-8 text and PDF; blocked one upload request to observe failure; unblocked and used **Retry same upload**; confirmed both uploads; submitted concerns/declaration; reloaded the receipt and retained exact filenames, hashes and associations. The actual Verify action reported chain passed, displayed content/manifest match, and both files' bytes verified.

A separately provisioned assigned reviewer imported its private session through the labeled demo tool, accessed the original and evidence, and verified both files. Browser requests with an unrelated citizen session and an office session each returned 403 for record and raw download endpoints. A new written-only complaint submitted and verified with no evidence attached. An authorized older fictional record verified with an explicit migration-time baseline warning. No browser download was saved outside the project; authorized byte retrieval was exercised by verification and connected download checks.

English/Hindi switching preserved authored narrative, concerns and filenames. Desktop and **390px viewport emulation** were inspected; measured content remained within the phone viewport. The reviewer phone screenshot shows wrapped fingerprints, usable buttons and both byte results. Physical-device and screen-reader testing are NOT RUN. Media playback and full codec validation are not claimed.

Inspected final-build captures, retained locally under ignored qa/artifacts/:

- b01-citizen-verified-en.png — desktop chain, displayed record and two byte results.
- b01-reviewer-verified-hi-390.png — assigned reviewer, Hindi, emulated phone.
- b01-legacy-baseline-hi.png — honest legacy provenance/result.

Fictional test identities, cases, staged objects and actions remain in the dedicated demo project. Private session JSON and fixture references remain ignored in .cache; screenshots are not published.

## Reproduction and handoff

From **D:\project\Hack Cache**, use the existing ignored dedicated .env. Run `npm run db:migrate`, `npm test`, `npm run build`, `npx tsx qa/evidence-connected.ts`, `npx tsx qa/workflow-connected.ts`, `npx tsx qa/ledger-append-connected.ts`, and `npm run integration-check`. Run the distinct-append check after workflow-connected creates its private fixtures. Start the built server with `npm start` (or set PORT=3004), start/retain a citizen session, upload all selected evidence before submission, then verify from the receipt. Provision assigned demo operators using database/provision-demo.ts and import their private session files only through /staff. Do not paste credentials into chat.

No new product phase, AI/transcription, recording, escalation, appeal or concern-resolution behavior was added. Remaining limitations are the explicit content-validation, unanchored-chain, orphan-retention, deployment, physical-device and accessibility limits above, not a substitute local-only backend or unfinished evidence path.

## Resource observations

The owner explicitly overrode the remaining-allowance floor and usage-point stop for this continuation. No model/speed change, reset credit or paid service was used.

- Fresh continuation 23 October 21:55:40 UTC (24 October 03:25:40 IST): five-hour 81% used, weekly 13%.
- Before browser at 22:02:32 UTC: 86% / 13%. During browser at 22:06:04 UTC: 95% / 15%, primary reset 1792795495.
- After the interruption, fresh observation 24 October 06:33:08 UTC (12:03:08 IST): 0% / 16%, new primary reset 1792841588. Do not subtract across these windows or treat the intervening wall-clock gap as observed active work. No observed sample established 100% used.
- Final observation and local/verified remote commit are supplied in chat. Shared counters are not isolated task cost. This is implementation self-verification, not independent acceptance.
