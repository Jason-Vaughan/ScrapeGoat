import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'

GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

/** Maximum file size in bytes (50 MB). */
export const MAX_FILE_SIZE = 50 * 1024 * 1024

/** Marker inserted between pages in extracted text. */
export const PAGE_BREAK_MARKER = '\n--- PAGE BREAK ---\n'

/** Threshold: if fewer than this many chars per page on average, likely image-only. */
const IMAGE_ONLY_THRESHOLD = 10

/** Threshold: if items have widely varying x-positions, likely multi-column. */
const MULTI_COLUMN_X_SPREAD = 200

/** Result of PDF text extraction. */
export interface ExtractionResult {
  text: string
  pageCount: number
  warnings: ExtractionWarning[]
}

/** Warning types that can occur during extraction. */
export type ExtractionWarning = 'image-only' | 'multi-column'

/** Progress callback: receives current page and total pages. */
export type ProgressCallback = (currentPage: number, totalPages: number) => void

/**
 * Validates that a File is a PDF within size limits.
 * Returns an error message string, or null if valid.
 */
export function validatePdfFile(file: File): string | null {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return 'Only PDF files are supported.'
  }
  if (file.size > MAX_FILE_SIZE) {
    return `File is too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`
  }
  if (file.size === 0) {
    return 'File is empty.'
  }
  return null
}

/**
 * Extracts text from a PDF file, page by page.
 * Inserts PAGE_BREAK_MARKER between pages.
 * Calls onProgress after each page is extracted.
 * Detects image-only PDFs and multi-column layouts.
 */
export async function extractText(
  file: File,
  onProgress?: ProgressCallback
): Promise<ExtractionResult> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: new Uint8Array(arrayBuffer) }).promise

  const totalPages = pdf.numPages
  const pageTexts: string[] = []
  const warnings: ExtractionWarning[] = []
  let hasMultiColumn = false

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()

    const textItems = content.items.filter(
      (item): item is TextItem => 'str' in item
    )

    // Check for multi-column layout by examining x-position spread
    if (!hasMultiColumn && textItems.length > 5) {
      const xPositions = textItems.map((item) => item.transform[4])
      const minX = Math.min(...xPositions)
      const maxX = Math.max(...xPositions)
      if (maxX - minX > MULTI_COLUMN_X_SPREAD) {
        hasMultiColumn = true
      }
    }

    const pageText = textItems.map((item) => item.str).join(' ')
    pageTexts.push(pageText)

    onProgress?.(i, totalPages)
  }

  // Check for image-only PDF
  const totalChars = pageTexts.reduce((sum, t) => sum + t.trim().length, 0)
  if (totalChars / totalPages < IMAGE_ONLY_THRESHOLD) {
    warnings.push('image-only')
  }

  if (hasMultiColumn) {
    warnings.push('multi-column')
  }

  return {
    text: pageTexts.join(PAGE_BREAK_MARKER),
    pageCount: totalPages,
    warnings,
  }
}
