import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'
import { DropZone } from '../components/DropZone'
import type { PdfData } from '../context/AppContext'

/**
 * Landing page with PDF drop zone.
 * On successful extraction, stores data in app state and navigates to wizard.
 */
export function HomePage() {
  const { dispatch } = useAppContext()
  const navigate = useNavigate()

  const handleExtracted = useCallback(
    (result: PdfData) => {
      dispatch({ type: 'SET_PDF_DATA', payload: result })
      navigate('/templates')
    },
    [dispatch, navigate]
  )

  return (
    <div className="flex flex-col items-center gap-8 py-8 sm:py-12">
      <div className="text-center">
        <h1 className="font-heading text-4xl font-bold text-primary sm:text-5xl">
          ScrapeGoat
        </h1>
        <p className="mt-3 text-lg text-on-surface-muted">
          Turn any PDF schedule into calendar events.
        </p>
      </div>

      <DropZone onExtracted={handleExtracted} />
    </div>
  )
}
