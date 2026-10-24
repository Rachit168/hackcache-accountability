# HC-P6-B03-C01 — independent audit corrections

Status: both reported defects were **confirmed, corrected and self-verified** against the dedicated Supabase project. This is a focused correction, not independent acceptance.

## Confirmed defects and fixes

1. **Late acknowledgement erased the 24-hour milestone.** At fictional hour 25, before any evaluation, the connected reproduction recorded a reviewer acknowledgement and showed `awaiting_response` with a new 72-hour deadline. The additive migrations retain `acknowledgement_missed_effective_at` under the DEMO-ESC-1 fictional clock. A late reviewer or municipal-workflow acknowledgement remains recorded, while the missed milestone stays overdue and actionable until evaluation records the escalation. Boundary semantics are `effective time >= stage start + 24h`, including equality. Acknowledgement before the boundary keeps the ordinary 72-hour response deadline. The field and event labels describe simulated policy time only; they make no real-world timeliness finding.

2. **Fresh no-op evaluations could exhaust ledger verification.** The failing-before connected reproduction increased the same complaint's ledger count from 2 to 3 after one unchanged evaluation. Fresh no-op evaluations now use a bounded idempotency-record allowance: at most 20 per case per escalation level, stored in existing command history without appending a complaint-ledger event. The case lock serializes the count and insert. At the cap, additional unchanged evaluations fail; a due evaluation that changes state still proceeds. Accepted same-key retries return their stored result; conflicting key reuse remains rejected. The 20-per-level cap across the three policy levels bounds this request history to 60 no-op rows per case, even when callers generate new UUIDs. Activation, advances, acknowledgements, responses, investigations and escalations remain ledgered. The UI omits internal no-op request rows from the citizen/reviewer timeline.

## Database and implementation

Migrations **010–012** are applied; migration 009 and earlier history were preserved. 010 adds the milestone field and policy behavior. 011 qualifies the no-op counter's stored payload column. 012 preserves policy activation as a meaningful event instead of counting it against the no-op allowance. These are additive changes under the existing `hc_writer` definer functions, fixed search path, forced RLS and transaction lock. No grants were loosened and no retained complaint/ledger record was modified. Existing test-owned fixtures are disposable fictional records.

The domain policy reference now accepts the missed-milestone field. English/Hindi timeline text marks late fictional acknowledgements and explains the limit; authored complaint text remains unchanged. `qa/escalation-connected.ts` covers both acknowledgement paths, the exact boundary, 201 unique unchanged-evaluation attempts, same-key replay/conflict, due escalation after the no-op cap, both acknowledgement/evaluation serialization orders on separate PostgreSQL backends, chain verification and denied runtime mutation.

## Reproduction and verification

From `D:\project\Hack Cache` with the existing private `.env` and `RUN_CONNECTED_CHECKS=true`:

```powershell
npm run db:migrate
npx tsx qa/escalation-connected.ts
npm run integration-check
npm test
npm run build
```

Failing-before evidence: connected run printed ledger count **2 → 3** and showed a fictional hour-25 acknowledgement changing the deadline to hour 72. The assertions failed against the original behavior. The first application attempt of migration 010 exposed an ambiguous SQL column reference; migration 011 corrected it without editing the applied migration. A subsequent test showed activation counted as a no-op; migration 012 corrected that. Those transient failures were corrected before final verification.

Final evidence: **10 escalation-connected assertion groups passed**, including the 201-request limit, actual office workflow acknowledgement after the deadline, reviewer acknowledgement at/after the deadline, observed blocking between independent backends for evaluation races, consistent concurrent acknowledgement/evaluation in both serialized orders, one escalation, idempotent retry/conflict, retained B02 snapshot, chain verification, and runtime mutation denial. `npm run integration-check` passed permission/RLS/schema exposure, managed identity, persistence, rollback and pooled-context checks. `npm test` passed **89 tests / 16 files**. Typecheck and production build passed; Vite retains its existing >500 kB client chunk advisory. Migration 010 and 011 required follow-up migrations in the same continuation; the final applied definitions are 012.

No browser visual review, separate `qa/workflow-connected.ts` rerun, independent audit, or production acceptance is claimed. The connected C01 runner did exercise the existing municipal workflow acknowledgement and office projection isolation. Test-owned records are kept in the dedicated project; they contain fictional data.

## Adversarial self-check and remaining limits

- Reviewer and office acknowledgements both retain a missed milestone; command and workflow paths serialize with evaluation on the per-case lock.
- Due escalation is checked before the no-op cap, so 20 prior no-ops cannot suppress a real transition. Cap is checked under that same lock, so distinct UUIDs cannot bypass it.
- Activation and same-key replay/conflict have dedicated assertions; meaningful commands still append exactly once.
- No RLS/grants or prior ledger payloads were weakened or rewritten. The unanchored-chain limitation remains: a privileged operator could rewrite or truncate the full chain; hashes do not prove complaint truth.
- This policy uses its explicitly fictional effective clock for its demo milestone only. It is not a real-world institutional deadline or service-level finding.

## Resource observations

At continuation start after the owner overrode the cutoff, the available meter showed 75% five-hour usage; the window then reset. Fresh post-reset baseline was 0% at 2026-10-24 11:34 UTC / 17:04 IST; latest recorded check before final connected regressions was 1% at 11:40 UTC / 17:10 IST. These are shared-account readings, not isolated task cost. No reset credit, purchase, delegation, or model/speed change was used. Final observation is reported in the completion message.
