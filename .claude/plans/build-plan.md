# ScrapeGoat Build Plan v2 (Revised)

Revision of the 11-chunk plan approved 2026-04-05. This version explicitly slots all spec requirements into chunks, closing gaps identified in the spec-vs-plan audit.

**Deferred to post-MVP:**
- Self-hosting white-label env vars (`SITE_NAME`, `SITE_LOGO` overrides)
- Alerting webhooks (Discord/Slack at 80% quota cap)
- OG image creation (1200x630px design task — do anytime before public launch)
- Docker self-hosting (Section 11, Option B)

**Key decisions (from Discovery):**
- Vite + React + TS (not Next.js — pure SPA, no SSR)
- React Context + useReducer for state
- Zod for schema validation
- Mock AI first, real Gemini later
- No AI co-author lines in commits

---

## Chunk 1: Repository Scaffolding & GitHub Infrastructure

**Deliverables:**
- `npm create vite@latest` — React + TypeScript template
- Tailwind CSS 4 setup
- Vitest config + Playwright config (smoke test passing)
- `.gitignore` (per spec Section 8.6)
- `.env.example` with placeholder vars (`GEMINI_API_KEY`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_SITE_KEY`, `VITE_API_URL`)
- `LICENSE` (MIT, full text)
- `README.md` (skeleton — logo, tagline, "under construction" note, license badge)
- `CONTRIBUTING.md` (skeleton — "full guide coming soon")
- `CHANGELOG.md` (initialized with `[Unreleased]` section)
- `.github/ISSUE_TEMPLATE/bug_report.md` (per spec 10.3)
- `.github/ISSUE_TEMPLATE/feature_request.md` (per spec 10.3)
- `.github/ISSUE_TEMPLATE/template_request.md` (per spec 10.3)
- `.github/ISSUE_TEMPLATE/parse_failure.md` (per spec 10.3)
- `.github/pull_request_template.md` (per spec 10.4)
- `public/manifest.json` (PWA manifest per spec 7.5)
- `index.html` with OG meta tags + social cards (per spec 7.7)
- `templates/index.json` (empty schema: `{ "version": "1.0", "lastUpdated": "...", "templates": [] }`)
- Favicon multi-size generation from source icon (per spec 7.6) — if `scrapegoat_icon.png` is available; otherwise placeholder
- Create GitHub repo `Jason-Vaughan/ScrapeGoat`, push initial commit
- Set GitHub Topics (per spec 10.1): `pdf-parser`, `pdf-to-ics`, `calendar-extractor`, etc.
- Create GitHub Labels (per spec 10.5): all 15 labels with specified colors

**Exit criteria:** `npm run dev` serves the app, `npm test` runs Vitest smoke test, repo is public on GitHub with labels and topics set.

---

## Chunk 2: App Shell & Navigation

**Deliverables:**
- Header component (logo, nav, dark/light mode toggle)
- Footer component (open source link, "Made by Jason Vaughan")
- Layout wrapper with responsive breakpoints (per spec 7.4: mobile <640px, tablet 640-1024px, desktop >1024px)
- Dark/light mode (respect `prefers-color-scheme`, toggle available, Tailwind `class` strategy) (spec 7.1)
- Color palette implementation (spec 7.2: primary #B91C1C, secondary #1E3A5F, accent #D4A017, etc.)
- System font stack (Inter or similar for headings)
- Router setup (React Router or equivalent) — routes for: home, wizard, results, export
- 404 page ("This page has been scraped clean." per spec 7.8)
- Accessibility foundation: keyboard navigation, focus management, skip-to-content link, sufficient contrast (spec 7.1)
- Landing page placeholder (Screen 1 layout with drop zone shell — no functionality yet)

**Exit criteria:** App shell renders on all breakpoints, dark/light toggle works, 404 route works, passes basic a11y audit (axe-core or similar).

---

## Chunk 3: PDF Text Extraction

**Deliverables:**
- PDF.js integration (client-side, loaded as web worker)
- Drag-and-drop zone on landing page (Screen 1 per spec 7.3):
  - Accepts `.pdf` only, max 50MB
  - Highlight on drag-over (dashed → solid border)
  - "Choose File" button fallback
- Multi-page extraction with page break markers (`\n--- PAGE BREAK ---\n`) (spec 2.4)
- Progress indicator: "Extracting page 12 of 47..." (spec 2.4, 7.9)
- Error handling: image-only PDF detection ("This PDF appears to be a scanned image...") (spec 7.3 Screen 1)
- Multi-column layout detection + warning ("This PDF may have a multi-column layout...") (spec 2.4)
- Store extracted text in app state after successful extraction
- Navigate to template selection screen after extraction
- Unit tests: multi-page concatenation, progress callback, error cases

**Exit criteria:** Can drop a PDF, see page-by-page progress, get concatenated text with page break markers. Image-only and multi-column warnings display correctly.

---

## Chunk 4: Template System

**Deliverables:**
- Profile JSON schema definition (Zod schema matching spec 5.1)
- Template CRUD in localStorage (save, load, list, delete) (spec 5.4)
- Template download as `.json` file (spec 5.4)
- Template import from `.json` file upload
- Community template library:
  - Fetch `templates/index.json` from raw GitHub URL (spec 5.3)
  - Client-side caching of index
  - Search/filter by name, source, tags (spec 7.3 Screen 2)
- Template Selection screen (Screen 2 per spec 7.3):
  - "Use a saved template" section with localStorage templates
  - "Browse community templates" section with search
  - "Create a new template" CTA (links to wizard — placeholder for now)
- "Share to Community" flow (spec 5.3):
  - Copy template JSON to clipboard
  - Display instructions with link to pre-filled GitHub Issue (`?template=template_request&title=...`)
- Unit tests: Zod schema validation, localStorage CRUD, community fetch mock

**Exit criteria:** Can save/load/delete templates in localStorage, download as file, import from file. Community templates fetched and searchable. "Share to Community" copies JSON and opens GitHub Issue link.

---

## Chunk 5: Parser Engine

**Deliverables:**
- `ParsedEvent` interface + `ParseWarning` interface (spec 5.2)
- Block-based parser (`structure.type: "block"`) (spec 5.3):
  - Split text by `blockDelimiter` regex
  - Extract event name (by position: first_line, after_date, before_date, regex)
  - Extract dates via `dateFormats[].pattern` with named capture groups
  - Extract location (knownValues scan then regex fallback)
  - Extract status (same logic as location)
  - Extract custom fields
  - Generate warnings (missing fields, date ambiguity)
  - Generate ID: SHA256 hash of (name + startDate + location)
- Table-based parser (`structure.type: "table"`) (spec 5.3)
- List-based parser (`structure.type: "list"`) (spec 5.3)
- Post-processing (all types) (spec 5.3):
  - Deduplicate by ID
  - Sort by startDate ascending
  - Validate date logic (moveIn <= start <= end <= moveOut)
  - Set `isSelected = true` for all events
- Page break marker handling: event blocks spanning page breaks are treated as one block (spec 2.4)
- Unit tests: one test suite per structure type, edge cases (ambiguous dates, missing fields, cross-page events)

**Exit criteria:** Parser produces correct `ParsedEvent[]` from all three structure types. All post-processing rules enforced. Tests pass.

---

## Chunk 6: Results UI

**Deliverables:**
- Parsed Results screen (Screen 4 per spec 7.3):
  - Event table with checkbox column for selection
  - Column toggle pills (Start, End, Move-In, Move-Out, Status)
  - Date range dropdown filter
  - Warning icon on events with parse warnings — click to expand details
  - Warning detail: field, issue, raw value, suggestion, [Accept Suggestion] button
  - Click event name → detail view with raw PDF text
  - "Select All" / "Select None" buttons
  - Event count summary ("43 of 47 events selected")
  - "Export Selected Events" button → navigate to export screen
  - "New PDF" button → back to landing
- Responsive table (collapses to card layout on mobile)
- Unit tests: selection state, column toggle, filter, warning display

**Exit criteria:** Results screen renders parsed events in a table, all interactive controls work (selection, column toggles, date filter, warning expansion). Responsive on mobile.

---

## Chunk 7: Export Engine

**Deliverables:**
- ICS generator (spec 6.1, 6.5):
  - RFC 5545 compliant, VTIMEZONE support, VALUE=DATE for all-day
  - DTEND exclusive (add 1 day), line folding at 75 octets, CRLF endings
  - Multi-phase support (Move-In/Event/Move-Out as separate VEVENTs)
  - UID = SHA256 hash + `@scrapegoat`
  - STATUS mapping (Confirmed→CONFIRMED, etc.)
- CSV generator (spec 6.2, 6.5):
  - Header row, all fields quoted, ISO dates
  - UTF-8 with BOM (Excel compatibility)
  - **Delimiter choice: comma / tab / semicolon** (spec Screen 5)
  - User-selectable columns
- JSON generator (spec 6.3, 6.5):
  - Matches internal event schema, null fields as `null`, pretty-printed
  - **Include rawText toggle** (spec Screen 5)
- MD generator (spec 6.4, 6.5):
  - GFM table format, human-readable dates (Mon DD)
  - Header with template name + export date, footer with count + attribution
  - **Table vs list layout toggle** (spec Screen 5)
- Export screen (Screen 5 per spec 7.3):
  - Four format cards (ICS, CSV, JSON, MD)
  - Per-format options panel (timezone selector, phase toggles, delimiter, toggles)
  - Preview panel (first few lines of selected format)
  - Download button — generates file client-side, triggers browser download
  - File naming: `scrapegoat-export-YYYY-MM-DD.{ics|csv|json|md}` (spec 6.6)
  - "Save Template" / "Share to Community" buttons at bottom
- Unit tests: one suite per export format (ICS RFC compliance, CSV escaping, JSON schema, MD formatting)

**Exit criteria:** All four export formats generate correct output. Export screen shows format-specific options and preview. Download works. Tests pass.

---

## Chunk 8: AI Wizard (Mock)

**Deliverables:**
- Wizard flow UI — Screens 3a-3h (spec 7.3):
  - Progress bar (Step X of 6)
  - Screen 3a: Document structure (radio select with examples)
  - Screen 3b: Date format + ambiguity highlighting (spec 4.4 Round 2)
  - Screen 3c: Timezone (radio + search IANA list) (spec 4.4 Round 2b)
  - Screen 3d: Locations/facilities (checkbox multi-select)
  - Screen 3e: Status codes (checkbox multi-select)
  - Screen 3f: Event name position (radio select)
  - Screen 3g: Review & Test table (run test parse, show results with checkmark/X per event)
  - Screen 3h: Correction flow (checkbox "what's wrong" → radio "alternatives") (spec 4.4 Step 3)
    - Max 2-3 correction rounds per event
  - Screen 3i: Save template (name input, save to browser / download / share checkboxes)
- Failure path — Screen 3j (spec 4.5):
  - "We couldn't fully parse this calendar" message
  - "Report This Issue" → pre-filled GitHub Issue (spec 4.5 Tier 3):
    - Include wizard step reached, quiz answers, failure details
    - PDF attachment consent step ("publicly visible on GitHub" warning)
    - Option: submit with/without PDF, or cancel
  - "Try Again" / "Start Over" / "Go Home" buttons
- **Graceful degradation UI messages** (spec 3.3):
  - Rate limited: "Template builder temporarily busy..." with note about saved templates still working
  - API down: "Template builder unavailable..." same note
  - Generic error with clear "what still works" messaging
- Mock AI service layer (returns hardcoded structured responses matching spec 4.4 contracts)
- Loading states for AI analysis (spec 7.9): spinner + rotating tips ("Looking for date patterns...", "Identifying locations...", "Detecting event names...")
- "Cancel" confirmation ("Your progress will be lost")
- Back button navigation between wizard steps
- Skip option on every step
- Unit tests: wizard state machine, correction loop, failure path routing

**Exit criteria:** Full wizard flow works end-to-end with mock AI data. Can complete quiz, review parsed results, correct flagged events, save template. Failure path and bug report flow work. Graceful degradation messages display correctly.

---

## Chunk 9: Cloudflare Worker (AI Proxy)

**Deliverables:**
- `functions/analyze.js` — Cloudflare Worker (spec 8.4)
- **Defense Layer 1: Turnstile verification** (spec 3.3) — validate one-time bot-check token
- **Defense Layer 2: Rate limiting** (spec 3.3) — per-IP (10/hr, 20/day) + global (500/day) via Workers KV
- **Defense Layer 3: Origin validation** (spec 3.3) — allowed origins only
- **Defense Layer 4: Payload validation** (spec 3.3) — calendarText 50-30K chars, valid action, 100KB max body
- **Defense Layer 5: Request deduplication** (spec 3.3) — SHA-256 hash + KV cache (1hr TTL)
- Defense Layer 6 (alerting) — **deferred** to post-MVP
- Full request lifecycle (spec 8.4): origin → turnstile → rate limit → payload → dedup → build request → call Gemini → validate response → cache → increment counters → return
- System prompt hardcoded in Worker (spec 4.3) — never from client
- Gemini model: `gemini-2.0-flash` (spec 8.2)
- Environment variables: `GEMINI_API_KEY`, `TURNSTILE_SECRET_KEY`, `KV_NAMESPACE`
- Error responses: 400, 403, 429, 502, 503 with user-friendly messages
- Cloudflare Web Analytics toggle (spec 7.10) — deployment config note in README/docs
- Integration tests: mock Gemini responses, test each defense layer independently

**Exit criteria:** Worker deploys to Cloudflare, correctly proxies to Gemini, all 5 defense layers enforced. Rate limiting tracks in KV. Dedup cache works.

---

## Chunk 10: Real Gemini Integration

**Deliverables:**
- Replace mock AI service with real Gemini API calls via the Worker proxy
- Turnstile widget integration on client side:
  - Load Turnstile script on "Create Template" screen
  - Generate one-time token before `/api/analyze` call
  - Include token in request header
- Initial analysis request (spec 4.4): send extracted text, receive quiz options
- Correction request (spec 4.4): send flagged fields + raw text, receive alternatives
- Zod validation of all Gemini responses against expected schemas (spec 3.2)
- Malformed response handling: discard and show error (spec 4.5)
- **Template name auto-suggestion by AI** (spec Screen 3h): AI suggests name based on PDF content
- **Timeout UX** (spec 7.9):
  - 30s: "This is taking longer than usual..."
  - 45s: "Still working..." with cancel option
  - 60s: timeout error with retry option
- Error response handling: `unrecognized_format` (spec 4.4) → show "not calendar data" message
- E2E test: full wizard flow against real (or mocked-at-network-level) Gemini

**Exit criteria:** Full wizard flow works with real Gemini API. Turnstile token generated and validated. Timeout UX works. Malformed responses caught by Zod validation.

---

## Chunk 11: PWA, Polish & Docs

**Deliverables:**
- Service worker for offline caching of app shell (spec 2.1) — parsing/export work offline, only wizard needs network
- **Offline mode detection** (spec 11.2 Option C): if no proxy configured/reachable, hide "Create New Template" button, show only "Load Template" and "Browse Community Templates"
- PWA install prompt (add to home screen on mobile/desktop)
- Full `README.md` (spec 10.2 — all 10 sections: logo, narrative, how it works, features with `<details>`, screenshots, quick start, community templates, privacy, contributing, license)
- Full `CONTRIBUTING.md` (spec 10.6 — all 7 sections: welcome, code contributions, template contributions, bug reports, feature requests, dev setup, code style)
- Final CHANGELOG.md update for v1.0
- Responsive polish pass across all screens
- Accessibility audit pass (keyboard nav, screen reader, contrast) across all screens
- Cross-browser testing (Chrome, Safari, Firefox, Edge)
- Janitor pass: dead code, unused imports, debug logs, unresolved TODOs

**Exit criteria:** PWA installs on mobile/desktop, offline mode works (app functional without proxy minus wizard). README and CONTRIBUTING complete. All screens responsive and accessible. Clean build, all tests pass.

---

## Chunk order & dependencies

```
1. Scaffold ──→ 2. Shell ──→ 3. PDF ──→ 4. Templates ──→ 5. Parser
                                                              │
                    8. Wizard (mock) ←── 6. Results ←─────────┘
                         │                    │
                    9. CF Worker         7. Export
                         │
                   10. Real Gemini
                         │
                   11. PWA/Polish
```

Each session = one chunk. Finish, test, commit, wrap.
