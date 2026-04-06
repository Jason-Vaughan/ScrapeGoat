<p align="center">
  <img src="https://github.com/Jason-Vaughan/project-assets/blob/main/scrapegoat-logo.png?raw=true" alt="ScrapeGoat logo" width="200">
</p>

<p align="center">
  <strong>PDF Calendar Extractor</strong>
</p>

<p align="center">
  <code>pwa</code> &middot; <code>gemini ai</code> &middot; <code>pdf.js</code> &middot;
  <code>ics</code> &middot; <code>csv</code> &middot; <code>json</code> &middot;
  <code>markdown</code> &middot; <code>zero cost</code> &middot; <code>privacy first</code>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-beta-orange.svg" alt="Beta">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
</p>

> **Beta Notice:** ScrapeGoat is under active development and has not been fully tested in production. Expect rough edges. Bug reports and feedback are welcome via [GitHub Issues](https://github.com/Jason-Vaughan/ScrapeGoat/issues).

---

## What is ScrapeGoat?

You have a PDF schedule. You need calendar events. Existing tools don't work — they choke on weird date formats, multi-column layouts, and venue-specific quirks. ScrapeGoat fixes that.

Drop a PDF, answer a few multiple-choice questions, and get your events as ICS, CSV, JSON, or Markdown. Everything runs in your browser. Your files never leave your device.

## How It Works

1. **Drop a PDF** — drag and drop any schedule into the browser
2. **Pick a template** — use a saved template, browse community templates, or create a new one
3. **AI wizard** — a guided multiple-choice interview builds a parsing template in about 2 minutes (no technical knowledge needed)
4. **Review events** — check parsed results, flag issues, accept AI-suggested corrections
5. **Export** — download as ICS, CSV, JSON, or Markdown with per-format options

## Features

<details>
<summary><strong>Client-Side PDF Extraction</strong></summary>

- Powered by Mozilla's PDF.js — runs entirely in your browser
- Multi-page extraction with page break markers
- Image-only PDF detection with clear error messages
- Multi-column layout detection with warnings
- Drag-and-drop or file picker, max 50 MB
</details>

<details>
<summary><strong>AI-Powered Template Wizard</strong></summary>

- Guided 6-step interview: document structure, date format, timezone, locations, status codes, event names
- Gemini 2.0 Flash powers the analysis via Cloudflare Worker proxy
- Turnstile bot protection — no API keys needed from users
- Correction flow: flag events, get AI alternatives, iterate up to 3 rounds
- AI-suggested template names
- Progressive timeout UX: 30s warning, 45s cancel option, 60s auto-timeout
- Graceful degradation: rate-limited or offline users can still use saved/community templates
</details>

<details>
<summary><strong>Template System</strong></summary>

- Zod-validated template profiles with block, table, and list parsers
- Save templates to browser localStorage
- Download and import templates as `.json` files
- Browse and search community templates from GitHub
- Share templates to the community via pre-filled GitHub Issues
</details>

<details>
<summary><strong>Powerful Parser Engine</strong></summary>

- Three structure types: block-based, table-based, and list-based
- Named capture groups for flexible date extraction
- Ambiguous date detection (e.g., is 1/2/2026 January 2 or February 1?)
- Known-values scan with regex fallback for location and status
- Custom field extraction via per-field regex patterns
- Post-processing: deduplication, sorting, date logic validation
</details>

<details>
<summary><strong>Four Export Formats</strong></summary>

- **ICS** — RFC 5545 compliant with VTIMEZONE, multi-phase support (Move-In/Event/Move-Out), line folding, STATUS mapping
- **CSV** — UTF-8 BOM for Excel, delimiter choice (comma/tab/semicolon), selectable columns
- **JSON** — matches internal event schema, null fields preserved, optional raw text
- **Markdown** — GFM table or list layout, human-readable dates, attribution footer
- Live preview before download
- All exports generated client-side
</details>

<details>
<summary><strong>PWA & Offline Support</strong></summary>

- Installable on mobile and desktop — add to home screen
- Service worker caches app shell for offline use
- Parsing and exporting work fully offline with saved templates
- Only the AI wizard requires an internet connection
- Offline detection hides the wizard when proxy is unreachable
</details>

<details>
<summary><strong>Accessibility & Responsive Design</strong></summary>

- Keyboard navigable with visible focus indicators
- Screen reader support: ARIA labels, roles, live regions
- Focus trap in modal dialogs
- Skip-to-content link
- Dark/light mode with system preference detection
- Responsive breakpoints: mobile (<640px), tablet (640-1024px), desktop (>1024px)
- Mobile card layout fallback for data tables
</details>

## Screenshots

*Screenshots will be added after the first public deployment.*

## Quick Start

### Use the hosted version

Visit [scrapegoat.pages.dev](https://scrapegoat.pages.dev) — no install required.

### Run locally for development

```bash
# Clone the repo
git clone https://github.com/Jason-Vaughan/ScrapeGoat.git
cd ScrapeGoat

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start the dev server
npm run dev
```

The app runs at `http://localhost:5173`. Parsing and exporting work without any API keys. To use the AI wizard locally, you'll need to set up the Cloudflare Worker — see the [worker README](functions/README.md) or use the Turnstile test keys from `.env.example`.

### Run tests

```bash
# Unit tests
npm test

# E2E tests
npx playwright test
```

## Community Templates

Community templates let you parse common schedule formats without running the AI wizard.

### Browse templates

Templates are listed on the template selection screen after uploading a PDF. You can search by name, source, or tags.

### Use a community template

Click "Use" next to any community template. ScrapeGoat fetches the template JSON from GitHub and applies it to your PDF.

### Contribute a template

1. Create a template using the AI wizard
2. Click "Share" on any saved template
3. Copy the JSON and open the pre-filled GitHub Issue
4. The community reviews and merges it into `templates/index.json`

See [CONTRIBUTING.md](CONTRIBUTING.md) for full details on template contributions.

## Privacy

Your files never leave your device. ScrapeGoat runs entirely in your browser. The only external call is to Google's AI during initial template setup — and even that only sends extracted text, not your file.

- **No user accounts** — nothing to sign up for
- **No cookies or tracking** — no analytics, no telemetry
- **No file uploads** — PDF extraction happens client-side via PDF.js
- **AI calls are minimal** — only extracted text is sent, only during the one-time wizard flow
- **Templates are local** — saved in your browser's localStorage, never sent to a server

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for details on code contributions, template contributions, bug reports, and development setup.

## License

[MIT](LICENSE) — Made by [Jason Vaughan](https://github.com/Jason-Vaughan)
