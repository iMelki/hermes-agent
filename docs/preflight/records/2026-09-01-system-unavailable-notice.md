# Component-Sourcing Preflight — SystemUnavailableNotice (retroactive)

Retroactive record. The component landed in `9faae85d97` (2026-08-27, "fix(web): show an
honest /system body when APIs 401 or hang") without a sourcing record, because this fork's
gate is documented as MANUAL — there is no hook that runs it — so the commit succeeded and
`npm run gate:component-sourcing` has reported `COMPONENT_SOURCING_PREFLIGHT=fail` on it
ever since. This record is written from what the component actually is, read from source;
it does not invent a provenance. Parent: iMelki/hermes#45.

- Target app/surface and component job: hermes web dashboard `/system` (`web/src/pages/SystemPage.tsx:796`) — the failure twin of that page's loading card: when one or more System API reads 401 or time out, name the reads that failed and offer Retry instead of painting invented host or gateway numbers
- Target-app component checked: yes — `web/src/components/ChatSidebar.tsx:360-372` is the app's live notice idiom (a `Card` plus a lucide alert glyph on `text-warning`/`text-destructive`), and `SystemPage.tsx:781-793` already renders the matching loading `Card`/`CardContent` at the same call site; neither is a reusable primitive, and `ProfileScopeBanner.tsx` is chrome-level rather than in-page, so the page-scale variant had to be written
- Component marketplace primitive checked: yes — `S:\source\Component-Marketplace\component-marketplace\src\components\ui` has no alert/callout/notice/banner primitive (its closest, `operator-relief-panel.tsx`, is a Next.js `use client` pause/relief control on a different primitive family and a different job)
- External pools checked or deliberately skipped: shadcn/ui `Alert` is the canonical pool answer and was deliberately skipped — this app's declared design system is `@nous-research/ui` (Radix/shadcn-free), and house rule 2.9 keeps primitive layers per-app and never mixed; adding a registry to a fork that tracks NousResearch/hermes-agent would also be merge-hostile. Lucide is already the app's icon set (`lucide-react ^0.577.0`), so the glyph needed no new pool
- Chosen source lane and why: lane 1, target-app composition — `Card`/`CardContent`, `Badge` and `Button` from `@nous-research/ui` plus `AlertTriangle` from `lucide-react`, in the tone and spacing the sibling notice cards already use; no code was copied from any external source
- Custom missing capability or local constraint: `@nous-research/ui` 0.18.2 ships no alert/callout/notice/banner (verified against the installed package: badge, button, card, dialog, confirm-dialog, toast and 30 siblings, no alert), and the job needs two behaviours no generic Alert encodes — a per-read failure list rendered as `Badge` chips, and copy that stays honest about partial loads (`hasAnyPayload`) instead of implying the page is a status report
- License/access/dependency result: no new dependencies. `@nous-research/ui` 0.18.2 (MIT) and `lucide-react ^0.577.0` were already declared in `web/package.json`; all other code is fork-local
- Proof expected before closeout: the success path is evidenced — `docs/frontend-sota-gauntlet-2026-08-27/shots/system-1440.png` shows `/system` with a real body on the `:9119` serve pin, and the notice correctly absent because every read returned (`docs/frontend-sota-gauntlet-2026-08-27/system-body-2026-08-27.md`). The failure-state render has NO browser capture yet: closing it needs a `/system` shot with at least one read forced to 401 or timeout, at 1440 and 390, showing the failure chips and a keyboard-reachable Retry. Recorded here as an open gap, not as a pass

Covers: web/src/components/SystemUnavailableNotice.tsx
