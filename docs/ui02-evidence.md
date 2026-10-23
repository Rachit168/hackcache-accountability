# HC-P6-UI02 — Visual restoration and English/Hindi switching

## Result

Implemented the requested bilingual citizen interface on top of the accepted UI01 foundation. HC-P6-T04 / Phase 2A remains paused. The implementation changes only the citizen frontend, its UI-only copy/state helpers, UI-focused tests, and this handoff evidence. No authentication, API payload, database, schema, or stored-record rules changed.

The page now has a deep ink/petrol Janvaani header, warm paper background, white intake surface, 35px page heading, 22px section headings, and a 770px form column beside actual section links, a live concern count, accurate “Not submitted” state, and one contextual writing tip. At 390px it uses a single column, keeps the language selector available, holds each concern number and compact type control in one row, and has no horizontal overflow.

The typed English/Hindi dictionary covers page copy, session/setup/errors, form labels and help, validation, loading, receipt metadata/status/actions, navigation, and accessibility labels. The accessible native radio toggle updates `<html lang>` and the page title. It persists only `janvaani-language` in guarded local storage, starts from a valid saved choice or a Hindi browser locale, and formats counts and dates using `en-IN` / `hi-IN`. Switching language leaves the narrative, concern order/types/text, declaration, ownership, and current idempotency key unchanged. Citizen-authored text and stored enum values are not translated.

Concern editor IDs are internal stable UUIDs, used to key rows and associate field errors. Submission maps concerns to `{ type, wording }` only, so UI IDs do not enter the API payload. Receipt reads now clear prior state when the case ID changes and classify missing/inaccessible references separately from retryable network/server failures and 401 session failures. Authentication errors offer a route back to starting a new demo session.

## Verification

- `npm test`: **34 tests passed across seven files**, including bilingual copy/interpolation and receipt failure classification.
- `npm run typecheck`: passed.
- `npm run build`: passed. Vite reports the client bundle at 582.56 kB minified (166.98 kB gzip), above its 500 kB advisory threshold; no new dependency was added.
- Mobile DOM viewport was 390×844 with `scrollWidth` 390 and no horizontal overflow. Desktop layout measurements showed a 770px form column beside the 364px helper/navigation column at 1280px.
- Hindi empty-submit validation showed translated narrative, concern, declaration, and summary errors. After concern 2 was edited and concern 1 removed, the remaining concern retained its own stable identity and no stale index-based error.
- During the four-issue Hindi/English draft, switching languages preserved the narrative, each concern’s text and order, and all four internal field IDs. The locale selection and `<html lang="hi">` remained Hindi after a reload.
- A fictional 269-character Hindi account and four ordered concerns (service, conduct, mixed, service; Hindi and English text) were submitted. An offline failure was retried after a language switch; the observed Idempotency-Key was unchanged. The saved receipt reference is `2283c423-36b4-4e5f-845e-55788d522443` (shown in Hindi locale as 24/10/2026, 12:00:30 am). Reload returned the same account and all four concerns.
- A separate anonymous browser session and a distinct nonexistent UUID both received the localized not-found state. Blocking the receipt API produced a localized retry state; restoring the route and retrying loaded the saved receipt. The 401 recovery classification is covered by unit tests; no live expired-token scenario was induced.
- Print media preview kept the saved account and all four issues while hiding navigation and actions. A native print dialog was not opened.

## Rendered captures

The screenshots in ignored `qa/artifacts/` were captured from the local browser. They contain fictional demo content only.

- English desktop intake: `ui02-intake-en-desktop.jpg`
- Hindi desktop intake: `ui02-intake-hi-desktop.jpg`
- English and Hindi phone intake at 390×843: `ui02-intake-en-mobile-final.jpg`, `ui02-intake-hi-mobile-final.jpg`
- English and Hindi desktop receipt: `ui02-receipt-en-desktop.png`, `ui02-receipt-hi-desktop.png`
- English and Hindi full-page phone receipt: `ui02-receipt-en-mobile.png`, `ui02-receipt-hi-mobile.png`
- Hindi print-media preview: `ui02-receipt-print-preview.png`

## Limits and resource observations

This was a local browser/dev-server verification, not physical-phone, automated screen-reader, or production deployment acceptance. HC-P6-T04 remains paused. No unrelated database audit was run.

- Fresh HC-P6-UI02 baseline, 2026-10-23 18:21:09 UTC / 23:51:09 IST: primary five-hour used 12%, weekly used 2%; resets 1792795495 / 1793382295.
- First implementation checks passed at about 18:24 UTC; final handoff observation: 2026-10-23 18:38:44 UTC / 00:08:44 IST on 2026-10-24: primary used 16%, weekly used 3% (shared account counter, not task-attributed). No paid/reset credits or model/speed changes were used.
