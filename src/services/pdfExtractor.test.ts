import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validatePdfFile, MAX_FILE_SIZE, PAGE_BREAK_MARKER } from './pdfExtractor'

// Mock pdfjs-dist to test extractText without a real PDF
vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn(),
  GlobalWorkerOptions: { workerSrc: '' },
}))

import { getDocument } from 'pdfjs-dist'
import { extractText } from './pdfExtractor'

const mockGetDocument = vi.mocked(getDocument)

/**
 * Creates a mock File with the given properties.
 */
function createMockFile(
  name: string,
  size: number,
  type: string
): File {
  const content = new Uint8Array(Math.min(size, 100))
  const blob = new Blob([content], { type })
  return new File([blob], name, { type })
}

/**
 * Creates a mock PDF document with pages that return specified text items.
 * Each entry in `pages` is an array of text strings for that page.
 */
function createMockPdf(pages: Array<Array<{ str: string; transform: number[] }>>) {
  const mockPages = pages.map((items) => ({
    getTextContent: vi.fn().mockResolvedValue({
      items: items.map((item) => ({ ...item })),
    }),
  }))

  const mockDoc = {
    numPages: pages.length,
    getPage: vi.fn((num: number) => Promise.resolve(mockPages[num - 1])),
  }

  mockGetDocument.mockReturnValue({ promise: Promise.resolve(mockDoc) } as ReturnType<typeof getDocument>)
  return mockDoc
}

/**
 * Helper: create simple text items with a default x-position.
 */
function textItem(str: string, x = 50): { str: string; transform: number[] } {
  return { str, transform: [1, 0, 0, 1, x, 0] }
}

describe('validatePdfFile', () => {
  it('accepts a valid PDF file', () => {
    const file = createMockFile('test.pdf', 1024, 'application/pdf')
    expect(validatePdfFile(file)).toBeNull()
  })

  it('accepts a PDF by extension even without correct MIME type', () => {
    const file = createMockFile('test.pdf', 1024, 'application/octet-stream')
    expect(validatePdfFile(file)).toBeNull()
  })

  it('rejects non-PDF files', () => {
    const file = createMockFile('test.txt', 1024, 'text/plain')
    expect(validatePdfFile(file)).toBe('Only PDF files are supported.')
  })

  it('rejects files over 50MB', () => {
    const file = createMockFile('big.pdf', 100, 'application/pdf')
    Object.defineProperty(file, 'size', { value: MAX_FILE_SIZE + 1 })
    expect(validatePdfFile(file)).toMatch(/too large/)
  })

  it('rejects empty files', () => {
    const file = new File([], 'empty.pdf', { type: 'application/pdf' })
    expect(validatePdfFile(file)).toBe('File is empty.')
  })

  it('accepts a file exactly at the size limit', () => {
    const file = createMockFile('max.pdf', MAX_FILE_SIZE, 'application/pdf')
    expect(validatePdfFile(file)).toBeNull()
  })
})

describe('constants', () => {
  it('MAX_FILE_SIZE is 50MB', () => {
    expect(MAX_FILE_SIZE).toBe(50 * 1024 * 1024)
  })

  it('PAGE_BREAK_MARKER has correct format', () => {
    expect(PAGE_BREAK_MARKER).toBe('\n--- PAGE BREAK ---\n')
  })
})

describe('extractText', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('extracts text from a single page', async () => {
    createMockPdf([[textItem('Hello'), textItem('World')]])
    const file = createMockFile('test.pdf', 100, 'application/pdf')

    const result = await extractText(file)

    expect(result.text).toBe('Hello World')
    expect(result.pageCount).toBe(1)
    expect(result.warnings).toEqual([])
  })

  it('concatenates pages with page break markers', async () => {
    createMockPdf([
      [textItem('Page 1 content')],
      [textItem('Page 2 content')],
      [textItem('Page 3 content')],
    ])
    const file = createMockFile('test.pdf', 100, 'application/pdf')

    const result = await extractText(file)

    expect(result.text).toBe(
      `Page 1 content${PAGE_BREAK_MARKER}Page 2 content${PAGE_BREAK_MARKER}Page 3 content`
    )
    expect(result.pageCount).toBe(3)
  })

  it('calls progress callback for each page', async () => {
    createMockPdf([
      [textItem('A')],
      [textItem('B')],
      [textItem('C')],
    ])
    const file = createMockFile('test.pdf', 100, 'application/pdf')
    const onProgress = vi.fn()

    await extractText(file, onProgress)

    expect(onProgress).toHaveBeenCalledTimes(3)
    expect(onProgress).toHaveBeenNthCalledWith(1, 1, 3)
    expect(onProgress).toHaveBeenNthCalledWith(2, 2, 3)
    expect(onProgress).toHaveBeenNthCalledWith(3, 3, 3)
  })

  it('detects image-only PDFs with very little text', async () => {
    createMockPdf([
      [textItem('')],
      [textItem('')],
      [textItem('')],
    ])
    const file = createMockFile('scan.pdf', 100, 'application/pdf')

    const result = await extractText(file)

    expect(result.warnings).toContain('image-only')
  })

  it('does not flag image-only for text-rich PDFs', async () => {
    createMockPdf([
      [textItem('This is a long text with plenty of characters for extraction')],
    ])
    const file = createMockFile('text.pdf', 100, 'application/pdf')

    const result = await extractText(file)

    expect(result.warnings).not.toContain('image-only')
  })

  it('detects multi-column layout from wide x-position spread', async () => {
    createMockPdf([
      [
        textItem('Left col', 50),
        textItem('Left col 2', 55),
        textItem('Left col 3', 60),
        textItem('Right col', 350),
        textItem('Right col 2', 355),
        textItem('Right col 3', 360),
      ],
    ])
    const file = createMockFile('multi.pdf', 100, 'application/pdf')

    const result = await extractText(file)

    expect(result.warnings).toContain('multi-column')
  })

  it('does not flag multi-column for narrow layouts', async () => {
    createMockPdf([
      [
        textItem('Line 1', 50),
        textItem('Line 2', 52),
        textItem('Line 3', 50),
        textItem('Line 4', 55),
        textItem('Line 5', 48),
        textItem('Line 6', 50),
      ],
    ])
    const file = createMockFile('narrow.pdf', 100, 'application/pdf')

    const result = await extractText(file)

    expect(result.warnings).not.toContain('multi-column')
  })

  it('handles pages with no text items gracefully', async () => {
    createMockPdf([[], [textItem('Some text')]])
    const file = createMockFile('sparse.pdf', 100, 'application/pdf')

    const result = await extractText(file)

    expect(result.text).toBe(`${PAGE_BREAK_MARKER}Some text`)
    expect(result.pageCount).toBe(2)
  })
})
