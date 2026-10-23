# HC-P6-UI03 — Recovery and usability evidence

## Scope and result

This pass preserves the accepted UI02 visual system and changes only the citizen frontend, small UI helpers, focused tests, and handoff evidence. No backend authentication, API payload, validation limit, database/schema, service, dependency, or stored-record behavior changed. HC-P6-T04 / Phase 2A remains paused.

## Implemented

- A receipt 401 offers “Refresh saved session and retry” in English and Hindi. The app reads the existing Supabase session, calls the supported auth.refreshSession() facility, checks that the refreshed user ID matches the original user ID, and then retries the same receipt GET. It does not call signOut, create an anonymous identity, or replay a write. Each recovery step is bounded to 15 seconds. Concurrent clicks share one attempt, and a refresh that times out remains locked until its underlying operation settles.
- Failed refresh preserves the current auth session in application code and gives a localized explanation. A missing or changed identity is treated as unavailable; a new session is not described as restoring old receipt access. A receipt that still returns 401 after a successful same-identity refresh gets distinct feedback.
- Invalid submission focuses a concise error summary containing links to the actual invalid controls. Links focus and scroll the target into view. Summary fields derive from the current concern list, so removal does not leave a stale index target; language switching reuses the same IDs and updates the copy without moving focus.
- The beforeunload listener attaches only when the narrative, concern wording, or declaration contains meaningful unsent work. It is removed when the form becomes clean or unmounts. Successful submission marks the form saved before navigation. Language is not an input to this dirty-state effect, and section anchors remain ordinary same-page links.
- Phone section navigation comes before the long form in DOM, keyboard, and reading order. Desktop grid placement preserves the existing form-left/helper-right appearance.
- Receipt copy writes only the exact case UUID. Success is announced. Failure leaves the UUID as ordinary selectable text and gives a localized manual-copy explanation; the copy is not described as granting access.
- prefers-reduced-motion: reduce changes root scrolling to auto.

## Controlled checks

qa/ui-reliability.test.ts adds focused checks. The full local suite passes **42 tests across eight files**.

- Same-ID refresh succeeds and invokes the receipt retry only afterward.
- Refresh rejection, absent session identity, and changed identity do not invoke the receipt retry. The recovery helper has no sign-out dependency.
- Concurrent/repeated calls share the same refresh. A never-settling refresh times out, does not retry the receipt, and does not permit a second refresh until the first operation settles.
- Error-summary links point to the remaining concern's stable control after removing a different concern; concern numbering is recalculated and translated.
- Clean/whitespace-only forms do not warn; meaningful text does; successful submission does not warn. The listener calls preventDefault, sets the browser-owned generic warning value, and its cleanup removes the same handler.
- Clipboard success receives the exact UUID string; rejection returns the failure state without changing the reference.

These are controlled dependency/state checks. No live expired-token or forced-refresh-failure experiment was run against the retained Supabase identity.

## Browser observations

Observed in the local Vite app at http://127.0.0.1:5173/ using the real configured managed session and fictional values:

- Blank submission moved focus to the summary. English/Hindi toggling changed its links and labels without clearing errors. Removing concern 1 left the remaining concern link pointed at its original stable control and renamed it concern 1. Activating that summary link focused the textarea.
- English and Hindi desktop intake and receipt views were inspected. At 390×844, both intake languages were inspected; measured document scroll width was 390px, section navigation began at document Y≈295, and the form began at Y≈649. Thus the section links precede the form without horizontal overflow. The existing desktop two-column placement remained visible at 1280px.
- With the dirty form visible, the section anchor changed the URL to #concerns-title. Under CDP emulation of prefers-reduced-motion: reduce, computed scroll-behavior was auto.
- A fictional submission was read back as a receipt in the same session. Switching its interface to Hindi preserved the original English narrative and both original concern wordings. Reload returned the same saved receipt and text.
- Clicking Copy reference announced success, and the clipboard contained exactly the displayed UUID. Clipboard denial is covered by the controlled test; a real denied clipboard permission was not induced.
- Screen captures were inspected directly in the live browser for 1280px desktop and 390px phone layouts in English and Hindi. This run did not persist new screenshot files; UI02 screenshot files remain historical captures of the prior interface state and are not claimed as UI03 evidence.

The browser automation runtime did not expose a native beforeunload-dialog observation hook (its Playwright event waiter supports only download and file chooser events). Native dialog display is therefore not claimed as browser-observed. Browser support is limited: browsers may ignore custom prompt text, show only their generic message, require prior user interaction, or suppress the prompt.

## Verification and limits

- npm run typecheck: passed.
- npm test: 42 tests passed across eight files.
- npm run build: passed. Vite reports the client JavaScript bundle at **588.59 kB minified / 168.65 kB gzip**, above its existing 500 kB advisory.
- Same-identity recovery is unit-tested with controlled dependencies, not live expired-token credentials.
- No physical phone, automated screen-reader audit, or native leave-confirmation display acceptance is claimed.
- The fictional browser regression record was submitted to the configured demo service and persisted as instructed. Its private reference is omitted from this public evidence.
- No database audit was repeated.

## Resource observations

- Fresh baseline: 2026-10-23 18:47:40 UTC / 2026-10-24 00:17:40 IST. Five-hour usage 23%; weekly usage 4%.
- First verified milestone: 2026-10-23 18:51:42 UTC / 2026-10-24 00:21:42 IST. Five-hour usage 23%; weekly usage 4%.
- Handoff observation: 2026-10-23 19:00:46 UTC / 2026-10-24 00:30:46 IST. Five-hour usage 26%; weekly usage 4%. The observed +3 percentage-point shared-account change is not attributable solely to this task.
- No paid/reset credits or model/speed setting changes were used. The approximate +8 point target was not reached; implementation and requested verification completed below the +12 point stop and 45-minute limit.

## Publication

Staged content was reviewed for .env, generated/private artifacts, and credential-like strings. Only the UI03 source, tests, and documentation were included. The public remote was updated from the existing main branch; the final local and remote commit is recorded in the task report after remote verification.
