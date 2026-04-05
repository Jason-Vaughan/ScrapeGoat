# Changelog

All notable changes to ScrapeGoat are documented in this file.

## [Unreleased]

### Added
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

### Changed
- Revised 11-chunk build plan (v1 → v2): audited full spec, identified 20 gaps, slotted all into existing chunks
- Deferred post-MVP: Docker self-hosting, white-label env vars, alerting webhooks, OG image creation

### Fixed
- Added TangleClaw global rule: build plans must be copied into project directory and referenced with absolute paths (fixes cross-session plan discovery failure)
- Created PLAN_SENTRY.md fallback in Projects directory for plan location debugging
