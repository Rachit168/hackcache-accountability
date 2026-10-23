# HC-P6-T04 Phase 2A checkpoint

## Result

Implemented and self-verified the fictional citizen → assigned reviewer → approved office version → assigned office acknowledgement and written response → citizen history path. Ready for separate verification with the limits below. This is not independent acceptance or institutional identity verification.

Preserved migration 001 and prior records. The ordered runner applied migration 002 and then 003 to the configured dedicated Supabase project, with the existing separate migration/runtime credentials and explicit verified CA trust. Migration 003 fixes an ambiguous PL/pgSQL body parameter found in the connected office-action check; no reset or historical deletion was performed.

## Authority and storage

- Operator-created demo_principals bind managed Auth UUIDs to reviewer or office authority. review_assignments bind one reviewer to a case. Citizen bootstrap creates only the existing citizen membership; no public grant endpoint exists.
- The runtime remains a non-owner role without table/column access or role inheritance. Two new fixed-search-path SECURITY DEFINER commands owned by hc_writer perform reads and atomic writes. The original six policies retain their exact expectations; three added SELECT policies expose originals only to an assigned reviewer. New workflow tables are accessible to the trusted command-definer role, with command code enforcing actor/scope; they are not directly accessible to runtime, anon, authenticated, or PUBLIC.
- Approved versions store reviewer UUID, source concern UUIDs/types, reasons, sample office and server time. Every source concern must be represented, including an omission with a reason. Changed narrative/concern wording requires a reason. Earlier outgoing versions and office statements have no UPDATE/DELETE grant or mutation route.
- The office read branch constructs only approved content and office actions. It does not serialize the original narrative/concerns. Citizen reads retain original ownership checks. Acknowledgements and responses are distinct append-only records referencing a released version. Response requires acknowledgement. Neither changes the submitted case status.
- Per-case and per-actor/key advisory locks serialize retryable workflow commands. Changed-content retries conflict; successful unchanged retries return the previous ID.

## Operator procedure

From D:\project\Hack Cache, reuse the ignored dedicated .env, then run:

    npm run db:migrate
    npx tsx database/provision-demo.ts reviewer CASE_UUID
    npx tsx database/provision-demo.ts office CASE_UUID

The local script uses the configured managed anonymous Auth facility to create a real identity, then provisions authority with the migration login. It never prints tokens. Its output names a private JSON session file in ignored .cache. Failed provisioning may leave an unassigned managed identity; it does not grant public authority.

Open /staff directly in a separate tab and use the private session file input. This invokes the managed SDK setSession facility. The staff session uses a separate browser-storage key from the retained citizen session. Load another operator file to change the staff identity; the API derives authority from the verified user UUID, not the file name or a role selector. Keep these files private; do not upload them to GitHub, paste tokens into chat, or screenshot their contents.

The reviewer prepares an in-memory version, previews it, then explicitly approves/release-assigns it to SAMPLE_MUNICIPAL_DESK. Office actors for that demo office share that office scope. UNRELATED_DEMO_OFFICE exists only for negative checks. There is no institutional verification or general organisation-management UI.

## Actual checks

- Existing local suite: 42 tests across eight files pass. Typecheck and final production build pass. Final bundle is 599.13 kB minified / 171.23 kB gzip, retaining the >500 kB advisory.
- Existing connected foundation runner passes with expanded exact table/function/grant/policy expectations: original policy behavior negatives, direct runtime SELECT/INSERT/UPDATE/DELETE denials, column grants, non-owner roles, PGRST106 private-schema exclusion, original persistence, competing first submissions with observed blocking, rollback and transaction-context reset.
- New qa/workflow-connected.ts passes using six distinct real managed identities: citizen A/B, assigned/unrelated reviewers, assigned/unrelated offices. Checks cover office denial before approval, unrelated actor denials, office raw-original endpoint denial, approved projection excluding the private marker and original fields, forged role/source/version rejection, no partial release after failed command, changed-key conflict and unchanged release/ack/response replay, acknowledgement prerequisite, citizen readback and unchanged original narrative/ordered concerns/submitted status.
- Initial workflow connected attempt returned a transient submission 503; a subsequent run advanced to the office branch and exposed the SQL ambiguity. After migration 003 the full workflow check passed. No PASS is inferred from the failed attempts.
- Browser through the production server behind a local screenshot proxy: a fresh citizen identity submitted fictional service/conduct text; a separately provisioned reviewer opened its actual assigned queue, inspected originals, removed the private demo marker with reasons, previewed and approved; a distinct office identity saw only the approved version, acknowledged, then answered the service concern while explicitly leaving conduct unanswered. The citizen reloaded and saw the unchanged original, approved content and attributed actions. English/Hindi switching preserved authored source text.

The browser used a build preceding a final copy-only change that localizes reviewer concern-type captions; final source typecheck/build pass. Office/reviewer Hindi and phone-width operation were not independently exercised. Sequential workflow retries were tested; a dedicated concurrent first-workflow-command race was not run. No physical-device or screen-reader acceptance is claimed.

## Retained captures

Inspected captures are local only, ignored by Git, and contain fictional data:

- qa/artifacts/t04-reviewer-preview.png
- qa/artifacts/t04-office-response.png
- qa/artifacts/t04-citizen-history-en.png
- qa/artifacts/t04-citizen-history-hi.png

Private managed session fixtures and test logs are in ignored .cache. Fictional Auth identities and records created by checks remain in the dedicated demo project; no destructive cleanup was attempted. Do not publish private fixtures or case references.

## Resource stop and publication

Fresh baseline: 2026-10-23 19:09:49 UTC / 2026-10-24 00:39:49 IST: five-hour used 34%, weekly used 5%, primary reset 1792795495. First connected workflow milestone at 19:16:44 UTC: 40% / 6%. Pre-browser observation 19:18:09 UTC: 41% / 6%.

At 19:21:23 UTC / 00:51:23 IST the fresh reading was 48% / 7%: +14 shared-account points over 11m34s, beyond the +12 stop. No further implementation was started after observing this limit; final build, evidence and publication followed. Shared counters are not isolated task cost. No paid/reset credits or model/speed changes were used.

Later product phases remain deferred: attachments, AI/transcription, deadlines, escalation, findings, appeals, assistance directory, metrics and deployment. This checkpoint is ready for separate source/connected/browser verification; it does not establish production or security certification. Commit and remote equality are reported after publication in chat.
