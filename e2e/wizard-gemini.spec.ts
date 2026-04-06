import { test, expect } from '@playwright/test'
import path from 'path'

/**
 * E2E test: Wizard flow with network-level Gemini mock.
 * Intercepts POST /api/analyze and returns a mocked AI analysis response,
 * verifying the wizard progresses from loading → first quiz step.
 */

/** Minimal valid AI analysis response. */
const mockAnalysis = {
  documentStructure: {
    options: [
      { label: 'Events in separate blocks', value: 'block', source: 'Event A\nMarch 15...' },
      { label: 'Table format', value: 'table', source: 'No table detected' },
      { label: 'List format', value: 'list', source: 'No list detected' },
    ],
  },
  dateFormats: {
    detected: [
      {
        label: 'MM/DD/YYYY',
        pattern: '(?<month>\\d{1,2})/(?<day>\\d{1,2})/(?<year>\\d{2,4})',
        format: 'MM/DD/YYYY',
        examples: ['03/15/2026'],
        source: '03/15/2026',
      },
    ],
  },
  locations: {
    candidates: [
      { name: 'Main Hall', confidence: 'high', source: 'Main Hall' },
    ],
  },
  statusCodes: {
    candidates: [
      { name: 'Confirmed', confidence: 'high', source: 'Confirmed' },
    ],
  },
  eventNames: {
    candidates: [
      { name: 'Tech Conference', source: 'Tech Conference 2026' },
    ],
  },
  estimatedEventCount: 5,
  detectedTimezone: 'America/New_York',
  notes: null,
  suggestedTemplateName: 'Tech Conference Calendar',
}

test('wizard flow: PDF upload → AI analysis → first quiz step', async ({ page }) => {
  // Intercept the Worker proxy at network level and return mock response
  await page.route('**/api/analyze', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockAnalysis),
    })
  })

  // Go to homepage
  await page.goto('/')

  // Upload a test PDF via the file input
  // Create a minimal PDF-like file for the drop zone
  // The app validates .pdf extension and extracts text via PDF.js
  // We need to provide a real (minimal) PDF for PDF.js to process
  const fileInput = page.locator('input[type="file"]')
  if (await fileInput.count() > 0) {
    // The drop zone has a hidden file input — use it
    await fileInput.setInputFiles({
      name: 'test-calendar.pdf',
      mimeType: 'application/pdf',
      buffer: createMinimalPdf(),
    })

    // Wait for extraction and navigation to template selection or wizard
    // The app navigates to /templates after extraction, then to /wizard from there
    await page.waitForURL('**/templates', { timeout: 10000 })

    // Click "Create a new template" to go to wizard
    const createBtn = page.getByText('Create a new template')
    if (await createBtn.isVisible()) {
      await createBtn.click()
    }

    // Should see the loading screen first
    await expect(page.getByText('Analyzing your document')).toBeVisible({ timeout: 5000 })

    // Then the first quiz step after the mock response arrives
    await expect(page.getByText('How is this calendar organized?')).toBeVisible({ timeout: 10000 })

    // Verify the quiz options from our mock are shown
    await expect(page.getByText('Events in separate blocks')).toBeVisible()
  }
})

test('wizard flow: unrecognized_format shows error page', async ({ page }) => {
  // Intercept and return unrecognized_format
  await page.route('**/api/analyze', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'unrecognized_format',
        message: 'Not calendar data',
      }),
    })
  })

  await page.goto('/')

  const fileInput = page.locator('input[type="file"]')
  if (await fileInput.count() > 0) {
    await fileInput.setInputFiles({
      name: 'test.pdf',
      mimeType: 'application/pdf',
      buffer: createMinimalPdf(),
    })

    await page.waitForURL('**/templates', { timeout: 10000 })

    const createBtn = page.getByText('Create a new template')
    if (await createBtn.isVisible()) {
      await createBtn.click()
    }

    // Should show the unrecognized format error
    await expect(
      page.getByText("This doesn\u2019t look like a calendar")
    ).toBeVisible({ timeout: 10000 })
  }
})

/**
 * Create a minimal valid PDF buffer.
 * This is the smallest valid PDF that PDF.js can open and extract text from.
 */
function createMinimalPdf(): Buffer {
  const content = [
    '%PDF-1.0',
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
    '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj',
    '4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj',
    '5 0 obj<</Length 44>>stream',
    'BT /F1 12 Tf 100 700 Td (Test Event 03/15/2026) Tj ET',
    'endstream endobj',
    'xref',
    '0 6',
    '0000000000 65535 f ',
    '0000000009 00000 n ',
    '0000000058 00000 n ',
    '0000000115 00000 n ',
    '0000000266 00000 n ',
    '0000000340 00000 n ',
    'trailer<</Size 6/Root 1 0 R>>',
    'startxref',
    '434',
    '%%EOF',
  ].join('\n')
  return Buffer.from(content)
}
