# HC-P6-UI01 — citizen interface redesign evidence

## Scope and implementation

The UI redesign was completed in `web/main.tsx` and `web/style.css`. The work changes the citizen intake, session/setup notices, validation, and private receipt presentation only. Authentication, API paths/payloads, complaint schemas and field limits, idempotency, and stored-record access were preserved. No database, migration, server, or stored-record behavior was changed. HC-P6-T04 remains paused.

The page now uses the requested gray/white civic palette, the single blue action/focus accent, a compact Janvaani header, the exact visible fictional-demo notice, and a 32px page title. The form begins in the first desktop viewport, uses a 760px primary column beside short writing guidance, and becomes one column by tablet width. Narrative, ordered concerns, declaration, and submit remain in one surface in reading and keyboard order. Service, conduct, and mixed types have brief plain-language explanations. Field validation is linked to each invalid control; edits clear the summary error. Busy submission uses a live status. Setup/network failures offer retry without discarding the form.

The receipt uses compact metadata, the actual submitted status, full complaint reference, server timestamp, sample office, original narrative, ordered concern types and wording, print/save, and start-another actions. Identifiers and saved text wrap safely. Print rules retain the saved account and concerns while removing navigation and actions.

## Browser journey and states

The production build at `http://127.0.0.1:3000` was opened with the already configured managed demo session. An empty submit showed linked narrative, concern, and declaration messages. A fictional English/Hindi account of 2,224 characters was entered with four ordered concerns (service, conduct, service, mixed); the concern add/remove control was exercised and the declaration checked. The UI showed the “Saving complaint” live status, then navigated to receipt **`63e2fd56-dec4-450b-88cf-0a1ab8a37c7e`**, status **Submitted**, server time **2026-10-23 17:53:45 UTC**. The saved account and all four concern wordings/types matched after reload.

At 390px, the document width equalled the 375px CSS viewport; there was no horizontal overflow. The reference used `overflow-wrap:anywhere`. Keyboard focus moved from the declaration directly to Submit. A nonexistent reference produced the “Receipt unavailable” message and return link. For the setup-unavailable state, a temporary local instance on port 3001 ran with configuration values blank; the page showed that submission was unavailable and retrying preserved entered text. That process was stopped after inspection. No real personal information was entered or submitted.

Screenshots were captured from the actual rendered page and saved under ignored `qa/artifacts/`:

- Intake at 1280×800: `ui01-intake-1280x800.png`
- Intake at 768×1024: `ui01-intake-768x1024.png`
- Intake at 390×844: `ui01-intake-390x844.png`
- Empty-form validation at 390×844: `ui01-validation-390x844.png`
- Setup unavailable at 390×844: `ui01-setup-unavailable-390x844.png`
- Ready-to-submit phone form with keyboard focus: `ui01-ready-to-submit-390x844.png`
- Saved receipt at 1280×800, 768×1024, and 390×844: `ui01-receipt-1280x800.png`, `ui01-receipt-768x1024.png`, `ui01-receipt-390x844.png`
- Current receipt after reload at 390×844: `ui01-receipt-final-390x844.png`

Viewport dimensions are browser emulation, not physical-phone acceptance.

## Checks and remaining limits

- `npm test`: 30 tests passed across six files.
- `npm run typecheck`: passed.
- `npm run build`: passed. Vite still warns that the 567.06 kB minified client chunk exceeds its 500 kB advisory threshold (163.25 kB gzip); this redesign did not add dependencies.
- Connected browser submission and receipt reload passed for the fictional record above. No unrelated database audit was rerun.

Print behavior was reviewed in the print stylesheet but not in a native print dialog. No automated screen-reader audit or physical-device test was run. No issues were observed in the inspected English/Hindi wrapping, responsive layouts, keyboard focus, validation, setup-unavailable or inaccessible-receipt states. This is ready for separate UI and functional review; it is not a production deployment or physical-device accessibility certification.

## Resource observations

- Fresh baseline 2026-10-23 17:48:29 UTC / 23:18:29 IST: five-hour used 2%, weekly used 0%; reset timestamps were 1792795495 and 1793382295.
- First rendered milestone 2026-10-23 17:51:10 UTC / 23:21:10 IST: five-hour used 2%, weekly used 0%.
- Shared account counters do not establish isolated task cost. No paid/reset credits or model/speed changes were used.
- A fresh handoff counter/time observation is recorded in the task completion message.
