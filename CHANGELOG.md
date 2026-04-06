# Changelog

All notable changes to ScrapeGoat are documented in this file.

## [1.0.0-beta] - 2026-04-05

### Changed
- Added beta badge and notice to README
- Repo description updated with [BETA] prefix

## [1.0.0] - 2026-04-05

### Added (Chunk 11: PWA, Polish & Docs)
- Service worker (`public/sw.js`): caches app shell for offline use — network-first for navigation, cache-first for static assets, network-only for `/api/*` calls
- Service worker registration (`serviceWorkerRegistration.ts`): registers in production only, graceful no-op when unsupported
- PWA install prompt: `useInstallPrompt` hook captures `beforeinstallprompt` event; `InstallBanner` component shows fixed bottom bar with Install/Not now buttons, degrades gracefully on Safari/Firefox
- Offline mode detection: `useOnlineStatus` hook probes `/api/analyze` on mount, listens for online/offline events; "Create New Template" section hidden when proxy unreachable, replaced with "Template Wizard unavailable" message
- Focus trap utility: `useFocusTrap` hook traps Tab/Shift+Tab within dialog, restores focus to trigger element on close — applied to Share to Community modal and Wizard Cancel dialog
- Full `README.md`: 10 sections per spec — narrative intro, how it works, features with `<details>` dropdowns, quick start, community templates, privacy statement, contributing link, license
- Full `CONTRIBUTING.md`: 7 sections per spec — welcome, code contributions (fork/branch/PR workflow), template contributions (6-step guide), bug reports, feature requests, development setup (prerequisites, env vars, proxy explanation, test commands), code style conventions
- 21 new tests: `useInstallPrompt` (5), `InstallBanner` (4), `serviceWorkerRegistration` (3), `useOnlineStatus` (5), `useFocusTrap` (4) — total project: 537

### Fixed (Chunk 11: Responsive Polish)
- Touch targets increased on Select All/Select None buttons, column toggle pills, and template action buttons (Download/Share/Delete) with added padding and hover states
- Event names in results table truncated with `max-w-xs truncate` to prevent horizontal overflow
- PDF filename in template selection banner uses `break-all` to handle long filenames
- Bottom action bar (New PDF / Export) stacks vertically on mobile (`flex-col sm:flex-row`)
- Export page header stacks vertically on mobile
- Share to Community modal uses full width on mobile (`w-full mx-2 sm:mx-4`)
- Install banner stacks vertically on mobile with proper alignment
- Template action buttons (Download/Share/Delete) now have padding and hover states for easier tapping

### Fixed (Chunk 11: Accessibility Audit)
- Focus trap implemented in Share to Community modal and Wizard Cancel dialog — Tab/Shift+Tab no longer escapes to content behind
- Focus restored to trigger element when modals close
- Escape key dismisses Wizard Cancel dialog
- Added screen-reader-only `<h1>` ("Parsed Event Results") to ResultsPage for heading hierarchy
- Parse error container now has `role="alert"` for screen reader announcement
- Export format cards have visible focus outline (`focus:outline-2 focus:outline-primary`)
- Export Back button: arrow wrapped in `aria-hidden` span, button has `aria-label="Back to results"`

### Added (Chunk 10: Real Gemini Integration)
- Real AI service (`aiService.ts`): replaces mock service, calls Cloudflare Worker proxy at `/api/analyze` for both `initial_analysis` and `correction` actions
- Zod response validation (`aiResponseSchema.ts`): validates all Gemini responses against strict schemas — `aiAnalysisSchema` for initial analysis, `correctionResponseSchema` for corrections, `unrecognizedFormatSchema` for non-calendar input detection
- `AiServiceError` class with typed error codes: `rate_limited`, `api_down`, `unrecognized_format`, `timeout`, `generic` — maps HTTP status codes (429, 502, 503) to appropriate types
- Turnstile integration: `useTurnstile` hook loads Cloudflare Turnstile script dynamically, renders widget, manages token lifecycle (obtain → send → reset); `Turnstile` component renders the verification widget on the wizard loading screen
- `VITE_TURNSTILE_SITE_KEY` environment variable added to `.env.example`
- Timeout UX on `WizardLoadingScreen`: elapsed-time tracking via `onTick` callback, progressive messages at 30s ("This is taking longer than usual..."), 45s ("Still working on it..." + Cancel button), 60s (auto-timeout with retry option)
- AI-suggested template name: `suggestedTemplateName` field in analysis response, shown as "Use suggested" button on `SaveTemplateStep` when user hasn't typed a name
- `unrecognized_format` error handling: Gemini returns `{"error": "unrecognized_format"}` for non-calendar input → wizard shows "This doesn't look like a calendar" failure page
- Failure page messages for new error types: `unrecognized_format` ("This doesn't look like a calendar") and `timeout` ("Request timed out")
- Wizard reducer extended: `SET_ELAPSED`, `SET_SUGGESTED_NAME` actions; `elapsedSeconds` and `suggestedTemplateName` state fields; `ANALYSIS_START` and `RETRY` reset elapsed timer
- `WizardPage` orchestrator updated: passes Turnstile token to AI service calls, tracks elapsed time during analysis, stores suggested template name, resets Turnstile after each request
- `CorrectionStep` updated: receives Turnstile token as prop, passes to real AI service for correction requests, resets token after each correction call
- 55 new tests: 10 AI response schema validation, 13 AI service (fetch mocking, error mapping, timeout, tick callback), 7 loading screen timeout UX, 6 save template suggested name, 3 Turnstile hook, 8 wizard reducer (elapsed, suggested name, new error types), 8 updated existing tests for new CorrectionStep props (total project: 515)

### Fixed (Chunk 10 Critic Review)
- Cancel button now aborts the in-flight fetch via AbortSignal (was dispatching failure UI but leaving the network request running, consuming a rate-limit slot)
- AI service accepts `AbortSignal` via `AiCallOptions.signal` — linked to internal `AbortController`, cleanup on unmount also aborts
- `AiAnalysis` interface now includes `suggestedTemplateName?: string | null` (was missing from the manual type despite being in the Zod schema, causing type divergence)
- `CorrectionStep` now shows error feedback ("Couldn't get alternatives") when AI fails instead of silently resolving and skipping the event
- `.env.example` documents Turnstile test keys for local development
- Added Playwright E2E tests: wizard flow with network-level Gemini mock (PDF upload → AI analysis → first quiz step), unrecognized_format error path

### Added (Chunk 9: Cloudflare Worker — AI Proxy)
- Cloudflare Worker (`functions/analyze.js`): single `POST /api/analyze` endpoint proxying calendar-text analysis to Gemini 2.0 Flash
- Defense Layer 1 — Origin validation: rejects requests without a whitelisted `Origin` header (scrapegoat.pages.dev, scrapegoat.io, localhost:3000)
- Defense Layer 2 — Turnstile verification: validates one-time bot-check token via Cloudflare Turnstile server-side API, rejects missing/invalid/replayed tokens with 403
- Defense Layer 3 — Rate limiting via Workers KV: per-IP (10/hour, 20/day) and global (500/day) counters with automatic TTL expiry, user-friendly 429/503 messages noting saved templates still work
- Defense Layer 4 — Payload validation: calendarText required (50–30,000 chars), action must be `initial_analysis` or `correction`, max body 100 KB
- Defense Layer 5 — Request deduplication: SHA-256 hash of calendarText + IP cached in KV (1 hr TTL), duplicate requests return cached Gemini response instantly with `X-ScrapeGoat-Cache: hit`
- System prompt hardcoded in Worker (never from client): strict JSON-only calendar analyzer with anti-hallucination rules, `unrecognized_format` error for non-calendar input
- Gemini request builder: `system_instruction` + user prompt with `responseMimeType: application/json`, 30-second timeout with AbortController
- Gemini response extraction: unwraps `candidates[0].content.parts[0].text`, parses JSON, returns 502 on malformed/missing content
- CORS support: preflight OPTIONS handler, per-origin `Access-Control-Allow-Origin`, POST + OPTIONS methods
- Rate limit counter increment after successful requests (non-blocking, parallel with dedup cache write)
- `wrangler.toml` configuration: KV namespace binding, env var placeholders for secrets
- 66 new tests: 3 SHA-256, 3 origin validation, 6 Turnstile verification, 6 rate limiting, 3 counter increment, 11 payload validation, 4 dedup cache, 8 Gemini proxy, 3 CORS helpers, 1 system prompt, 12 full integration (total project: 460)

### Fixed (Chunk 9 Critic Review)
- Body size check now reads actual body bytes instead of trusting spoofable Content-Length header
- Dedup cache key now includes action type — same text with `initial_analysis` vs `correction` no longer collides
- Turnstile verification fails closed (rejects with 403) when Turnstile API is unreachable, instead of crashing
- KV failures in rate limiting and dedup gracefully degrade (skip check) instead of returning 500
- Gemini error messages no longer leak upstream status codes (generic "AI service error" instead)
- CORS `Access-Control-Allow-Origin` header omitted entirely for disallowed origins instead of empty string
- 405 Method Not Allowed response now includes CORS headers

### Added (Chunk 8: AI Wizard Mock)
- Wizard state machine (`useWizardReducer`): full step navigation, answer collection, correction flow, cancel dialog, retry/start-over, with 6 quiz steps + review + correction + save + failure
- Mock AI service (`mockAiService`): `analyzeDocument()` returns structure/date/location/status/name analysis with text-based heuristics; `getCorrectionSuggestions()` returns field alternatives; `__simulateError` param for testing graceful degradation
- Template builder (`templateBuilder`): assembles wizard answers + AI analysis into a Zod-validated `ProfileTemplate` with sensible defaults for skipped steps
- Wizard progress bar: "Step X of 6" with filled segments for quiz steps 3a-3f
- Wizard nav bar: Back / Skip / Next buttons with step-aware enabled states
- Wizard loading screen: spinner with rotating tip messages ("Scanning document structure...", etc.)
- Cancel confirmation dialog: "Your progress will be lost" with Stay/Leave buttons
- Screen 3a — Document Structure: radio select (block/table/list) with PDF source snippets
- Screen 3b — Date Format: radio select with detected patterns, example dates, ambiguous date highlighting (day ≤ 12)
- Screen 3c — Timezone: AI-detected badge, browser timezone, common IANA list, searchable dropdown using `Intl.supportedValuesOf`
- Screen 3d — Locations: checkbox multi-select with confidence badges (high/medium/low), source snippets, high-confidence pre-selected
- Screen 3e — Status Codes: checkbox multi-select with same confidence badge pattern
- Screen 3f — Event Names: radio select for position (first_line/after_date/before_date/regex) with AI-detected examples
- Screen 3g — Review & Test: runs live test parse, shows event table with pass/fail per event, flag/unflag toggle, "Fix Flagged" or "Looks Good" actions
- Screen 3h — Correction Flow: two-phase per event (what's wrong checkboxes → AI alternative radios), skip option, exhausted view after 3 rounds
- Screen 3i — Save Template: name input, save-to-browser/download/share checkboxes, success header with event count
- Screen 3j — Failure Page: graceful degradation messages for rate_limited/api_down/generic errors, "what still works" note, bug report form with GitHub Issue link, optional PDF attachment with privacy warning
- WizardPage orchestrator: guards for missing PDF data, kicks off AI analysis on mount, pre-selects high-confidence candidates, wires all step components with proper state/dispatch
- 100 new tests: 31 reducer, 12 mock AI, 9 template builder, 21 quiz steps, 24 post-quiz steps, 5 WizardPage integration (total project: 394)

### Fixed (Chunk 8 Critic Review)
- Retry button now properly re-triggers AI analysis via `analyzeKey` state (was stuck on loading screen because useEffect dependency didn't change)
- ADVANCE_FLAGGED now skips already-resolved events using `findIndex` instead of blindly incrementing (could land on resolved event)

### Added (Chunk 7: Export Engine)
- ICS export generator: RFC 5545 compliant with VTIMEZONE, VALUE=DATE, DTEND exclusive, line folding at 75 octets, CRLF endings, TEXT escaping (commas, semicolons, backslashes)
- ICS multi-phase support: separate VEVENTs for Move-In, Event, Move-Out with phase toggle pills
- ICS STATUS mapping: Confirmed→CONFIRMED, Tentative→TENTATIVE, Canceled→CANCELLED
- ICS UID format: SHA256 event ID + phase suffix + `@scrapegoat`
- ICS date fallback: events without startDate fall back to moveInDate or moveOutDate
- CSV export generator: header row, all fields quoted, UTF-8 BOM for Excel, delimiter choice (comma/tab/semicolon), user-selectable columns
- JSON export generator: matches spec schema, null fields preserved, 2-space pretty-print, optional rawText per event, ISO 8601 timestamps
- Markdown export generator: GFM table or list layout, human-readable dates (Mon DD), header with template name, footer with event count and attribution link
- Export screen (Screen 5): four format cards (ICS/CSV/JSON/MD), per-format options panels, live preview of first 20 lines, client-side download with `scrapegoat-export-YYYY-MM-DD.{ext}` naming
- Export timezone selector with 14 common IANA timezones
- 85 new tests: 24 ICS, 12 CSV, 13 JSON, 15 MD, 21 ExportPage UI

### Fixed (Chunk 7 Critic Review)
- ICS TEXT values now escape semicolons, commas, and backslashes per RFC 5545 Section 3.3.11
- Events with no startDate no longer silently dropped in ICS single-phase mode — falls back to moveInDate or moveOutDate
- MD footer pluralization: "1 event" instead of "1 events"

### Added (Chunk 6: Results UI)
- Parsed Results screen (Screen 4) with event table, checkboxes for selection, and responsive card layout on mobile
- Column toggle pills: Start, End, Move-In, Move-Out, Status — click to show/hide columns
- Date range dropdown filter: All dates, Next 30/90/180/365 days
- Warning icon on events with parse warnings — click event name to expand detail view
- Warning detail panel: field, issue, raw value, suggestion, and [Accept] button to apply fix
- Raw PDF text display in expanded event detail
- Select All / Select None buttons
- Event count summary ("X of Y events selected")
- "Export Selected Events" button (navigates to export screen, disabled when none selected)
- "New PDF" button (clears state and returns to landing page)
- AppContext extended: `parsedEvents` state with `SET_PARSED_EVENTS`, `TOGGLE_EVENT`, `SELECT_ALL_EVENTS`, `SELECT_NONE_EVENTS`, `ACCEPT_SUGGESTION` actions
- `appReducer` and `AppAction` exported for direct unit testing
- Automatic parser invocation: runs `parseText` when ResultsPage loads with PDF + template
- 25 new ResultsPage unit tests: redirects, rendering, selection, column toggles, date filter, warning display, expand/collapse, navigation, accessibility
- 13 new AppContext reducer unit tests: SET_PARSED_EVENTS, TOGGLE_EVENT, SELECT_ALL, SELECT_NONE, ACCEPT_SUGGESTION (including allowlist, out-of-bounds, and structural field overwrite protection)

### Fixed (Chunk 6 Critic Review)
- Add field allowlist to ACCEPT_SUGGESTION reducer — only `name`, `startDate`, `endDate`, `moveInDate`, `moveOutDate`, `location`, `status` can be overwritten (prevents structural field injection)
- Fix `isWithinDays` timezone handling — parse ISO dates as local time to avoid UTC midnight offset errors
- Prevent parser re-trigger loop when parse result is empty — use `hasParsed` flag instead of checking `parsedEvents.length`
- Fix expanded row `colSpan` calculation (was 1 short, causing misaligned detail rows)
- Add `role="img"` to warning icon `<span>` so `aria-label` is valid per ARIA spec
- Add `aria-expanded` attribute to event name expand/collapse buttons for screen reader support
- Update App.test routing test for ResultsPage redirect behavior (no longer renders placeholder heading)

### Added (Chunk 5: Parser Engine)
- `ParsedEvent` and `ParseWarning` interfaces matching spec 5.2
- `parseText(text, template)` main entry point dispatching by structure type
- Block-based parser (`structure.type: "block"`): splits by `blockDelimiter` regex, extracts name (by position: first_line/after_date/before_date/regex), dates, location, status, custom fields
- Table-based parser (`structure.type: "table"`): detects header row from `tableHeaders`, determines column positions by character offset, maps columns to event fields
- List-based parser (`structure.type: "list"`): applies `linePattern` regex per line, named capture groups map directly to event fields
- Date extraction with named capture groups (`month`, `day`, `year`), 2-digit year support, ambiguity detection (e.g. 1/2/2026)
- Field extraction by known values scan (case-insensitive) with regex fallback for location and status
- Custom field extraction via per-field regex patterns
- SHA-256 event ID generation from name + startDate + location via `crypto.subtle`
- Post-processing pipeline: deduplication by ID, sort by startDate ascending, date logic validation (moveIn ≤ start ≤ end ≤ moveOut)
- Page break marker stripping so events spanning PDF pages are parsed as continuous blocks
- `singleDate` field mapping: assigns same date to both startDate and endDate
- 62 new unit tests: generateEventId (4), stripPageBreaks (3), extractDates (9), extractEventName (6), extractByKnownOrPattern (5), extractCustomFields (3), block parser (9), table parser (4), list parser (5), deduplicateEvents (2), sortByStartDate (2), validateDateLogic (5), postProcess (1), edge cases (4)

### Fixed (Chunk 5 Critic Review)
- Validate calendar dates with per-month day limits (e.g., Feb 31 now rejected with warning instead of producing invalid ISO string)
- Add `safeRegex` wrapper: all user-supplied regex patterns compiled via try/catch to prevent crashes from invalid patterns
- Add `generateEventId` fallback: uses simple string hash when `crypto.subtle` is unavailable
- List parser now reports skipped (non-matching) lines as warnings per spec 5.3
- Guard against zero-length regex matches causing infinite loops in block delimiter scanning
- 9 new tests for Critic fixes (171 total): isValidDate (2), safeRegex (2), invalid date warning (1), skipped-line warnings (1), invalid regex handling (2), end-to-end dedup (1)

### Added (Chunk 4: Template System)
- Zod schema for template profiles (spec 5.1) with full validation of structure, dateFormats, fields
- Zod schema for community template index (spec 5.3)
- TypeScript types inferred from Zod schemas: `ProfileTemplate`, `SavedTemplate`, `CommunityTemplateEntry`
- Template CRUD service: save, load, list, delete templates in localStorage
- Template download as `.json` file with browser download trigger
- Template import from `.json` file with Zod schema validation
- Template ID generation from name (URL-safe slug)
- `markTemplateUsed` for tracking last-used timestamps
- Community template service: fetch `templates/index.json` from GitHub raw URL
- Client-side caching of community index in sessionStorage (1-hour TTL)
- Community template search/filter by name, source, tags, and description (case-insensitive)
- Template Selection page (Screen 2) with three sections:
  - Saved templates: radio select, Use Selected, Download, Share, Delete per template
  - Community templates: search input, tag display, Use button per template
  - Create new template: CTA linking to wizard
- "Share to Community" modal: copy template JSON to clipboard + pre-filled GitHub Issue link
- Import `.json` button on saved templates section
- PDF info banner showing filename, line count, and page count
- "Back to start" navigation clearing PDF and template state
- App state extended: `selectedTemplate` in AppContext with SET_TEMPLATE/CLEAR_TEMPLATE actions
- Route `/templates` for Template Selection page
- Navigation flow updated: PDF extraction → `/templates` (was `/wizard`)
- 61 new unit tests (100 total):
  - Template schema validation (15): required fields, optional fields, enum values, edge cases
  - Community index schema (3): valid index, empty templates, missing version
  - localStorage CRUD (10): save, load, delete, overwrite, corrupted storage, multiple templates
  - Template ID generation (3): slug conversion, special characters, trimming
  - File import (4): valid JSON, invalid JSON, schema failure, read error
  - Community fetch (4): fetch, cache, fetch failure, invalid format
  - Community search (8): empty query, name, source, tag, description, case-insensitive, multi-match, no match
  - Template Selection page (14): PDF banner, headings, saved templates display, selection, navigation, delete with confirm, share modal

### Fixed (Chunk 4 Critic Review)
- Validate community template JSON with Zod schema before dispatching to app state (was accepting unvalidated fetch responses)
- Handle localStorage quota exceeded in saveTemplate with descriptive error
- Add delete confirmation dialog before removing saved templates
- Add `aria-modal="true"`, Escape key dismiss, and auto-focus on share modal
- Handle clipboard API failure in copy-to-clipboard with fallback alert

### Added (Chunk 3: PDF Text Extraction)
- PDF.js integration for client-side text extraction (pdfjs-dist v5, web worker)
- Functional drag-and-drop zone: accepts .pdf only, max 50MB, highlight on drag-over
- "Choose File" button fallback via hidden file input
- Multi-page extraction with page break markers (`--- PAGE BREAK ---`)
- Progress indicator: "Extracting page X of Y..." with spinner
- Image-only PDF detection with user-friendly error message
- Multi-column layout detection with warning message
- App state context (React Context + useReducer) for storing extracted PDF data
- Navigation to wizard route after successful extraction
- File validation: type check, size limit, empty file rejection
- 25 new unit tests: file validation (6), extractText (8), constants (2), DropZone component (9)
- DOMMatrix stub in test setup for pdfjs-dist jsdom compatibility

### Added (Chunk 2: App Shell & Navigation)
- App shell with Header (logo, nav, dark/light toggle) and Footer (attribution, GitHub link)
- Layout wrapper with responsive breakpoints (mobile <640, tablet 640-1024, desktop >1024)
- Dark/light mode with system preference detection, localStorage persistence, and toggle
- Color palette: primary #B91C1C, secondary #1E3A5F, accent #D4A017 with dark mode surface overrides
- Custom font theme: Inter for headings, system font stack for body
- React Router with routes: home, wizard, results, export, 404 catch-all
- Landing page with drop zone shell placeholder
- 404 page ("This page has been scraped clean.") with Go Home link
- Wizard, Results, and Export placeholder pages
- Skip-to-content accessibility link
- Accessible navigation landmarks (nav, main with id)
- 14 unit tests covering routing, layout, a11y, dark mode toggle behavior, navigation

### Fixed (Chunk 2 Critic Review)
- Added `@custom-variant dark` directive for Tailwind v4 class-based dark mode support
- Added `matchMedia` change listener in `useTheme` to respond to live OS theme changes
- Added behavioral tests for dark mode toggle (click → class change, label change, localStorage)
- Added `matchMedia` mock in test setup for jsdom compatibility

### Added (Chunk 1: Repository Scaffolding)
- Project scaffolding: Vite + React + TypeScript
- Tailwind CSS 4 with Vite plugin
- Vitest unit test setup with React Testing Library
- Playwright e2e test setup with smoke test
- PWA manifest (`public/manifest.json`)
- OG and Twitter Card meta tags in `index.html`
- `.env.example` with placeholder environment variables
- MIT License
- README skeleton with logo, tagline, and section stubs
- CONTRIBUTING.md skeleton
- GitHub issue templates: bug report, feature request, template request, parse failure
- GitHub pull request template
- Community template index (`templates/index.json`)
- `.gitignore` per spec (excludes secrets, test PDFs, private templates)
- Placeholder PNG icons for all favicon/PWA sizes (16, 32, 180, 192, 512)

### Fixed (Critic Review)
- Twitter Card meta tags: changed `property` to `name` attribute per spec
- Added missing placeholder icons to prevent 404s from index.html/manifest.json references
- Registered port 5173 with TangleClaw PortHub

### Changed
- Revised 11-chunk build plan (v1 → v2): audited full spec, identified 20 gaps, slotted all into existing chunks
- Deferred post-MVP: Docker self-hosting, white-label env vars, alerting webhooks, OG image creation

### Fixed
- Added TangleClaw global rule: build plans must be copied into project directory and referenced with absolute paths (fixes cross-session plan discovery failure)
- Created PLAN_SENTRY.md fallback in Projects directory for plan location debugging
