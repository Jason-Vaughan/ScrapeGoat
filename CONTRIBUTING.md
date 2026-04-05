# Contributing to ScrapeGoat

Thanks for your interest in contributing! ScrapeGoat is an open-source PDF calendar extractor, and contributions of all kinds are welcome.

> **Full contributing guide coming soon.** The sections below will be expanded as the project matures.

## Code Contributions

Fork the repo, create a branch, make your changes, and open a PR. Use the pull request template.

## Template Contributions

Community templates help everyone. To contribute a template:

1. Use the app to create a template via the AI wizard
2. Export the template JSON
3. Fork the repo, add the JSON to `templates/`
4. Update `templates/index.json` with metadata
5. Open a PR using the template PR template

## Bug Reports

Use the [bug report issue template](https://github.com/Jason-Vaughan/ScrapeGoat/issues/new?template=bug_report.md), or let the app auto-file via the failure path.

## Feature Requests

Use the [feature request issue template](https://github.com/Jason-Vaughan/ScrapeGoat/issues/new?template=feature_request.md).

## Development Setup

```bash
git clone https://github.com/Jason-Vaughan/ScrapeGoat.git
cd ScrapeGoat
npm install
npm run dev
```

## Code Style

Follow the project's existing conventions. Run `npm run lint` before submitting.
