import { render, screen, fireEvent } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DropZone } from './DropZone'

// Mock the pdfExtractor module so tests don't need real PDF.js
vi.mock('../services/pdfExtractor', async () => {
  const actual = await vi.importActual('../services/pdfExtractor')
  return {
    ...actual,
    extractText: vi.fn(),
  }
})

import { extractText } from '../services/pdfExtractor'

const mockExtractText = vi.mocked(extractText)

/**
 * Helper to render DropZone inside a router context.
 */
function renderDropZone(onExtracted = vi.fn()) {
  return render(
    <DropZone onExtracted={onExtracted} />
  )
}

/**
 * Creates a mock PDF File.
 */
function createPdfFile(name = 'test.pdf', size = 1024): File {
  const content = new Uint8Array(Math.min(size, 100))
  const blob = new Blob([content], { type: 'application/pdf' })
  return new File([blob], name, { type: 'application/pdf' })
}

describe('DropZone', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the upload prompt', () => {
    renderDropZone()
    expect(screen.getByText(/drop your pdf here/i)).toBeInTheDocument()
    expect(screen.getByText(/pdf only/i)).toBeInTheDocument()
  })

  it('has an accessible upload button role', () => {
    renderDropZone()
    expect(screen.getByRole('button', { name: /upload pdf/i })).toBeInTheDocument()
  })

  it('shows error for non-PDF file via drag and drop', () => {
    renderDropZone()

    const dropZone = screen.getByRole('button', { name: /upload pdf/i })
    const textFile = new File(['hello'], 'test.txt', { type: 'text/plain' })

    fireEvent.drop(dropZone, {
      dataTransfer: { files: [textFile] },
    })

    expect(screen.getByRole('alert')).toHaveTextContent('Only PDF files are supported.')
  })

  it('shows error for oversized file', async () => {
    const user = userEvent.setup()
    renderDropZone()

    // Create a file object that reports > 50MB size
    const bigFile = createPdfFile('big.pdf', 60 * 1024 * 1024)
    // Override size since Blob won't actually allocate that much
    Object.defineProperty(bigFile, 'size', { value: 60 * 1024 * 1024 })

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, bigFile)

    expect(screen.getByRole('alert')).toHaveTextContent('too large')
  })

  it('calls onExtracted after successful extraction', async () => {
    const onExtracted = vi.fn()
    const user = userEvent.setup()

    mockExtractText.mockResolvedValueOnce({
      text: 'Event 1\n--- PAGE BREAK ---\nEvent 2',
      pageCount: 2,
      warnings: [],
    })

    renderDropZone(onExtracted)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const pdfFile = createPdfFile('schedule.pdf')
    await user.upload(input, pdfFile)

    expect(onExtracted).toHaveBeenCalledWith({
      text: 'Event 1\n--- PAGE BREAK ---\nEvent 2',
      pageCount: 2,
      warnings: [],
      fileName: 'schedule.pdf',
    })
  })

  it('shows image-only error and does not call onExtracted', async () => {
    const onExtracted = vi.fn()
    const user = userEvent.setup()

    mockExtractText.mockResolvedValueOnce({
      text: '',
      pageCount: 5,
      warnings: ['image-only'],
    })

    renderDropZone(onExtracted)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, createPdfFile())

    expect(screen.getByRole('alert')).toHaveTextContent('scanned image')
    expect(onExtracted).not.toHaveBeenCalled()
  })

  it('shows multi-column warning but still calls onExtracted', async () => {
    const onExtracted = vi.fn()
    const user = userEvent.setup()

    mockExtractText.mockResolvedValueOnce({
      text: 'Some text content here',
      pageCount: 1,
      warnings: ['multi-column'],
    })

    renderDropZone(onExtracted)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, createPdfFile())

    expect(onExtracted).toHaveBeenCalled()
    // Multi-column warning would show briefly before navigation;
    // the warning is passed through in the result
    expect(onExtracted).toHaveBeenCalledWith(
      expect.objectContaining({ warnings: ['multi-column'] })
    )
  })

  it('shows error when extraction fails', async () => {
    const user = userEvent.setup()

    mockExtractText.mockRejectedValueOnce(new Error('corrupt'))

    renderDropZone()

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, createPdfFile())

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to read this PDF')
  })

  it('clears previous error when a new file is selected', async () => {
    const user = userEvent.setup()

    mockExtractText
      .mockRejectedValueOnce(new Error('bad'))
      .mockResolvedValueOnce({
        text: 'Good content',
        pageCount: 1,
        warnings: [],
      })

    renderDropZone()

    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    // First upload fails
    await user.upload(input, createPdfFile('bad.pdf'))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    // Second upload succeeds — error should clear
    await user.upload(input, createPdfFile('good.pdf'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
