import { useCallback, useRef, useState } from 'react'
import type { DragEvent, ChangeEvent } from 'react'
import {
  validatePdfFile,
  extractText,
  MAX_FILE_SIZE,
} from '../services/pdfExtractor'
import type { ExtractionWarning } from '../services/pdfExtractor'

/** Props for the DropZone component. */
interface DropZoneProps {
  onExtracted: (result: {
    text: string
    pageCount: number
    warnings: ExtractionWarning[]
    fileName: string
  }) => void
}

/**
 * Drag-and-drop zone for PDF upload with extraction progress.
 * Accepts .pdf only, max 50MB. Shows progress and error states.
 */
export function DropZone({ onExtracted }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{
    current: number
    total: number
  } | null>(null)
  const [warnings, setWarnings] = useState<ExtractionWarning[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(
    async (file: File) => {
      setError(null)
      setWarnings([])
      setProgress(null)

      const validationError = validatePdfFile(file)
      if (validationError) {
        setError(validationError)
        return
      }

      try {
        const result = await extractText(file, (current, total) => {
          setProgress({ current, total })
        })

        setProgress(null)

        if (result.warnings.includes('image-only')) {
          setError(
            'This PDF appears to be a scanned image. ScrapeGoat needs text-based PDFs to extract calendar events.'
          )
          setWarnings(result.warnings)
          return
        }

        if (result.warnings.length > 0) {
          setWarnings(result.warnings)
        }

        onExtracted({
          text: result.text,
          pageCount: result.pageCount,
          warnings: result.warnings,
          fileName: file.name,
        })
      } catch {
        setProgress(null)
        setError('Failed to read this PDF. The file may be corrupted or password-protected.')
      }
    },
    [onExtracted]
  )

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)

      const file = e.dataTransfer.files[0]
      if (file) {
        processFile(file)
      }
    },
    [processFile]
  )

  const handleFileInput = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        processFile(file)
      }
      // Reset so the same file can be re-selected
      e.target.value = ''
    },
    [processFile]
  )

  const handleChooseFile = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleChooseFile()
      }
    },
    [handleChooseFile]
  )

  const isExtracting = progress !== null

  return (
    <div className="w-full max-w-lg">
      <div
        className={`rounded-xl border-2 p-12 text-center transition-colors ${
          isDragOver
            ? 'border-solid border-primary bg-primary/10'
            : 'border-dashed border-on-surface-muted/30 bg-surface-dim hover:border-primary/50'
        } ${isExtracting ? 'pointer-events-none opacity-75' : 'cursor-pointer'}`}
        role="button"
        tabIndex={isExtracting ? -1 : 0}
        aria-label="Upload PDF file"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleChooseFile}
        onKeyDown={handleKeyDown}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={handleFileInput}
          aria-hidden="true"
          tabIndex={-1}
        />

        {isExtracting ? (
          <div className="flex flex-col items-center gap-3">
            <div
              className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary"
              role="status"
              aria-busy="true"
              aria-label="Extracting text from PDF"
            />
            <p className="text-sm font-medium text-on-surface">
              Extracting page {progress.current} of {progress.total}...
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-on-surface-muted">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-12 w-12 opacity-40"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M11.47 2.47a.75.75 0 011.06 0l4.5 4.5a.75.75 0 01-1.06 1.06l-3.22-3.22V16.5a.75.75 0 01-1.5 0V4.81L8.03 8.03a.75.75 0 01-1.06-1.06l4.5-4.5zM3 15.75a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-sm font-medium">
              Drop your PDF here, or click to browse
            </p>
            <p className="text-xs">
              PDF only, up to {MAX_FILE_SIZE / 1024 / 1024}MB
            </p>
          </div>
        )}
      </div>

      {error && (
        <div
          className="mt-4 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary-dark dark:text-primary-light"
          role="alert"
        >
          {error}
        </div>
      )}

      {!error && warnings.includes('multi-column') && (
        <div
          className="mt-4 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent-dark dark:text-accent-light"
          role="status"
        >
          This PDF may have a multi-column layout. Extraction results might need
          extra review.
        </div>
      )}
    </div>
  )
}
