# Contributing to ScrapeGoat

Thanks for your interest in contributing! ScrapeGoat is an open-source PDF calendar extractor, and contributions of all kinds are welcome — code, templates, bug reports, and feature ideas.

## Code Contributions

1. **Fork** the repo and create a feature branch from `main`
2. **Make your changes** — keep commits small and focused
3. **Write tests** for new functionality (Vitest for unit tests, Playwright for E2E)
4. **Run the test suite** before submitting: `npm test`
5. **Open a PR** using the [pull request template](.github/pull_request_template.md)

### Branch naming

Use descriptive branch names: `feat/export-pdf`, `fix/date-parsing-edge-case`, `docs/update-readme`.

### PR guidelines

- Keep PRs focused on a single change
- Include a clear description of what changed and why
- Link any related issues
- All tests must pass before merging

## Template Contributions

Community templates help everyone parse common schedule formats without running the AI wizard. To contribute a template:

1. **Create a template** using the AI wizard in the app
2. **Test it** — make sure it correctly parses at least a few events from the source PDF
3. **Export the template** — click "Share" on any saved template and copy the JSON
4. **Fork the repo** and add the JSON file to the `templates/` directory
   - File naming: `source-name.json` (lowercase, hyphens, e.g., `javits-center-2026.json`)
5. **Update `templates/index.json`** with metadata:
   ```json
   {
     "id": "javits-center-2026",
     "name": "Javits Center 2026",
     "source": "Javits Center",
     "description": "NYC convention center event schedule",
     "file": "javits-center-2026.json",
     "tags": ["convention", "nyc", "events"],
     "author": "your-github-username",
     "dateAdded": "2026-04-05",
     "eventsTestedCount": 47
   }
   ```
6. **Open a PR** — the community will review and merge it

You can also submit templates without forking: click "Share" in the app, which copies the JSON and opens a pre-filled GitHub Issue.

## Bug Reports

Use the [bug report issue template](https://github.com/Jason-Vaughan/ScrapeGoat/issues/new?template=bug_report.md). Include:

- What happened vs. what you expected
- Steps to reproduce
- PDF details (type of schedule, approximate event count)
- Template used (community template name or custom)
- Browser and OS

The app can also auto-file bug reports from the wizard failure screen — it pre-fills the issue with your wizard state and quiz answers.

## Feature Requests

Use the [feature request issue template](https://github.com/Jason-Vaughan/ScrapeGoat/issues/new?template=feature_request.md). Describe:

- What problem it solves
- What the solution would look like
- Any alternatives you considered

## Development Setup

### Prerequisites

- Node.js 18+
- npm 9+

### Local development

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/ScrapeGoat.git
cd ScrapeGoat

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start the dev server
npm run dev
```

The app runs at `http://localhost:5173`. Parsing and exporting work without any API configuration.

### Environment variables

| Variable | Purpose | Required for |
|----------|---------|-------------|
| `VITE_API_URL` | Cloudflare Worker proxy URL | AI wizard |
| `VITE_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key | AI wizard |
| `GEMINI_API_KEY` | Google Gemini API key | Worker proxy |
| `TURNSTILE_SECRET_KEY` | Turnstile server-side secret | Worker proxy |

For local wizard testing, use the Turnstile test keys documented in `.env.example`.

### How the AI proxy works

The AI wizard sends extracted PDF text to a Cloudflare Worker (`functions/analyze.js`), which forwards it to Google Gemini 2.0 Flash. The Worker enforces 5 defense layers: origin validation, Turnstile verification, rate limiting, payload validation, and request deduplication. The system prompt is hardcoded in the Worker — never sent from the client.

### Running tests

```bash
# Unit tests (Vitest)
npm test

# Unit tests in watch mode
npm run test:watch

# E2E tests (Playwright)
npx playwright test
```

## Code Style

- **TypeScript** — all source files use TypeScript with strict mode
- **React** — functional components with hooks, no class components
- **Tailwind CSS** — utility-first styling, dark mode via `class` strategy
- **JSDoc comments** — all exported functions must have JSDoc documentation
- **Zod validation** — schemas for templates, AI responses, and external data
- **Testing** — write tests alongside implementation; Vitest for logic, Playwright for flows
- **No `console.log`** in production code — use proper error handling
- **Prefer named exports** over default exports (except for `App`)
- **Keep functions focused** — single responsibility, short and readable

<!-- BEGIN mirrored-security-rules
     MIRRORED from https://github.com/Jason-Vaughan/.github/blob/main/CONTRIBUTING.md
     Edit that file first, then update this copy. Do not let them diverge.
     These markers are load-bearing: a drift checker extracts exactly what lies between
     them, so do not remove, rename or reformat them. -->

## Security rules that apply to every repository

- **Clean-room review.** Pull requests from contributors we do not know are reviewed as raw text
  diffs. Maintainers do not check out your branch or run your code on their own machines. Where a
  repository runs CI on pull requests, those runs are sandboxed by GitHub with a read-only token and
  no access to repository secrets. If your logic is sound we re-implement it and credit you as the
  author.
- **Because we reconstruct it, your explanation is worth more than your code.** Describe the bug
  precisely and explain the approach; a clear description gets shipped, a large unexplained diff
  does not.
- **Scope.** One issue per pull request. A diff touching unrelated files is closed regardless of
  quality — from the outside, scope overrun and probing are indistinguishable.
- **Reviewable text only.** No binary files, and no generated, minified or vendored code. Source
  must contain no bidirectional control characters, no zero-width or invisible characters, and no
  non-ASCII homoglyphs standing in for ASCII in identifiers: those make a diff *render* differently
  from what it *executes* (Trojan Source, CVE-2021-42574), which defeats a text audit by
  construction. Ordinary Unicode in prose, comments and string literals is fine.
- **Security reports:** do not open a public issue. Open this repository's **Security** tab and
  choose **Report a vulnerability** — see the [security policy](../../security/policy).

Full contribution guide: https://github.com/Jason-Vaughan/.github/blob/main/CONTRIBUTING.md
<!-- END mirrored-security-rules -->
