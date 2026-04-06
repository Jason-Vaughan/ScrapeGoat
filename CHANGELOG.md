# Changelog

All notable changes to ScrapeGoat are documented in this file.

## [Unreleased]

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
