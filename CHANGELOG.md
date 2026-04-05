# Changelog

All notable changes to ScrapeGoat are documented in this file.

## [Unreleased]

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
