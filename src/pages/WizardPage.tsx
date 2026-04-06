import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'
import { useWizardReducer, QUIZ_STEPS } from '../hooks/useWizardReducer'
import type { WizardStepId, FlaggedEvent, CorrectionAlternative } from '../hooks/useWizardReducer'
import { analyzeDocument } from '../services/mockAiService'
import { buildTemplate } from '../services/templateBuilder'
import { saveTemplate, generateTemplateId, downloadTemplate } from '../services/templateStorage'

// Wizard UI components
import { WizardProgress } from '../components/wizard/WizardProgress'
import { WizardNavBar } from '../components/wizard/WizardNavBar'
import { WizardLoadingScreen } from '../components/wizard/WizardLoadingScreen'
import { WizardCancelDialog } from '../components/wizard/WizardCancelDialog'
import { DocumentStructureStep } from '../components/wizard/DocumentStructureStep'
import { DateFormatStep } from '../components/wizard/DateFormatStep'
import { TimezoneStep } from '../components/wizard/TimezoneStep'
import { LocationsStep } from '../components/wizard/LocationsStep'
import { StatusCodesStep } from '../components/wizard/StatusCodesStep'
import { EventNamesStep } from '../components/wizard/EventNamesStep'
import { ReviewTestStep } from '../components/wizard/ReviewTestStep'
import { CorrectionStep } from '../components/wizard/CorrectionStep'
import { SaveTemplateStep } from '../components/wizard/SaveTemplateStep'
import { FailurePage } from '../components/wizard/FailurePage'

/**
 * Wizard page orchestrator (Screens 3a–3j).
 * Manages the multi-step template-building flow using a local reducer.
 * Only the final ProfileTemplate is dispatched to app-wide state.
 */
export function WizardPage() {
  const { state: appState, dispatch: appDispatch } = useAppContext()
  const navigate = useNavigate()
  const [wiz, wizDispatch] = useWizardReducer()
  const [analyzeKey, setAnalyzeKey] = useState(0)

  // Guard: redirect to home if no PDF data
  useEffect(() => {
    if (!appState.pdfData) {
      navigate('/', { replace: true })
    }
  }, [appState.pdfData, navigate])

  // Kick off AI analysis on mount and on retry
  useEffect(() => {
    if (!appState.pdfData) return
    let cancelled = false

    async function analyze() {
      wizDispatch({ type: 'ANALYSIS_START' })
      try {
        const analysis = await analyzeDocument(appState.pdfData!.text)
        if (!cancelled) {
          wizDispatch({ type: 'ANALYSIS_SUCCESS', payload: analysis })
          // Pre-select high-confidence locations and status codes
          const locations = analysis.locations.candidates
            .filter((c) => c.confidence === 'high')
            .map((c) => c.name)
          const statusCodes = analysis.statusCodes.candidates
            .filter((c) => c.confidence === 'high')
            .map((c) => c.name)
          if (locations.length > 0) {
            wizDispatch({ type: 'SET_LOCATIONS', payload: locations })
          }
          if (statusCodes.length > 0) {
            wizDispatch({ type: 'SET_STATUS_CODES', payload: statusCodes })
          }
        }
      } catch (err) {
        if (!cancelled) {
          const errorType =
            (err as Error & { errorType?: string }).errorType ?? 'generic'
          wizDispatch({
            type: 'ANALYSIS_FAILURE',
            payload: {
              type: errorType as 'rate_limited' | 'api_down' | 'generic',
              message: (err as Error).message,
            },
          })
        }
      }
    }

    analyze()
    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appState.pdfData, wizDispatch, analyzeKey])

  // --- Callbacks ---

  const handleCancel = useCallback(() => {
    wizDispatch({ type: 'TOGGLE_CANCEL_DIALOG' })
  }, [wizDispatch])

  const handleLeave = useCallback(() => {
    appDispatch({ type: 'CLEAR_TEMPLATE' })
    navigate('/templates')
  }, [appDispatch, navigate])

  const handleNext = useCallback(() => {
    wizDispatch({ type: 'NEXT_STEP' })
  }, [wizDispatch])

  const handlePrev = useCallback(() => {
    wizDispatch({ type: 'PREV_STEP' })
  }, [wizDispatch])

  const handleSkip = useCallback(() => {
    wizDispatch({ type: 'SKIP_STEP' })
  }, [wizDispatch])

  const handleRetry = useCallback(() => {
    wizDispatch({ type: 'RETRY' })
    setAnalyzeKey((k) => k + 1)
  }, [wizDispatch])

  const handleStartOver = useCallback(() => {
    appDispatch({ type: 'CLEAR_PDF_DATA' })
    navigate('/')
  }, [appDispatch, navigate])

  const handleGoHome = useCallback(() => {
    navigate('/')
  }, [navigate])

  const handleLooksGood = useCallback(() => {
    wizDispatch({ type: 'GO_TO_STEP', payload: 'saveTemplate' })
  }, [wizDispatch])

  const handleFixFlagged = useCallback(
    (flagged: FlaggedEvent[]) => {
      wizDispatch({ type: 'FLAG_EVENTS', payload: flagged })
    },
    [wizDispatch]
  )

  const handleSetCorrections = useCallback(
    (eventId: string, corrections: CorrectionAlternative[]) => {
      wizDispatch({
        type: 'SET_CORRECTIONS',
        payload: { eventId, corrections },
      })
    },
    [wizDispatch]
  )

  const handleResolve = useCallback(
    (eventId: string) => {
      wizDispatch({ type: 'RESOLVE_FLAG', payload: eventId })
    },
    [wizDispatch]
  )

  const handleAdvance = useCallback(() => {
    wizDispatch({ type: 'ADVANCE_FLAGGED' })
  }, [wizDispatch])

  const handleFailure = useCallback(() => {
    wizDispatch({ type: 'GO_TO_STEP', payload: 'failure' })
  }, [wizDispatch])

  const handleSave = useCallback(() => {
    if (!wiz.aiAnalysis) return

    try {
      const template = buildTemplate(wiz.templateName, wiz.answers, wiz.aiAnalysis)

      if (wiz.saveOptions.browser) {
        const id = generateTemplateId(wiz.templateName)
        saveTemplate(id, template)
      }

      if (wiz.saveOptions.download) {
        downloadTemplate(template)
      }

      // Dispatch to app state and navigate to results
      appDispatch({ type: 'SET_TEMPLATE', payload: template })
      navigate('/results')
    } catch {
      wizDispatch({ type: 'GO_TO_STEP', payload: 'failure' })
    }
  }, [
    wiz.aiAnalysis,
    wiz.templateName,
    wiz.answers,
    wiz.saveOptions,
    appDispatch,
    wizDispatch,
    navigate,
  ])

  // --- Render helpers ---

  /** Whether the "Next" button should be enabled for the current step. */
  function canNext(): boolean {
    switch (wiz.currentStep) {
      case 'documentStructure':
        return wiz.answers.documentStructure !== null
      case 'dateFormat':
        return wiz.answers.dateFormat !== null
      case 'timezone':
        return wiz.answers.timezone !== null
      case 'locations':
        return true // can proceed with empty selection
      case 'statusCodes':
        return true
      case 'eventNames':
        return wiz.answers.eventNamePosition !== null
      default:
        return true
    }
  }

  if (!appState.pdfData) return null

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Cancel dialog */}
      <WizardCancelDialog
        open={wiz.cancelDialogOpen}
        onStay={handleCancel}
        onLeave={handleLeave}
      />

      {/* Step content */}
      {renderStep(wiz.currentStep)}
    </div>
  )

  /**
   * Render the appropriate component for the current wizard step.
   */
  function renderStep(step: WizardStepId) {
    // Loading screen
    if (step === 'loading') {
      return <WizardLoadingScreen />
    }

    // Failure page
    if (step === 'failure') {
      return (
        <FailurePage
          error={wiz.error}
          answers={wiz.answers}
          onRetry={handleRetry}
          onStartOver={handleStartOver}
          onGoHome={handleGoHome}
        />
      )
    }

    // Save template
    if (step === 'saveTemplate') {
      return (
        <SaveTemplateStep
          templateName={wiz.templateName}
          saveOptions={wiz.saveOptions}
          eventCount={wiz.testParseResults.length}
          onNameChange={(name) =>
            wizDispatch({ type: 'SET_TEMPLATE_NAME', payload: name })
          }
          onOptionsChange={(opts) =>
            wizDispatch({ type: 'SET_SAVE_OPTIONS', payload: opts })
          }
          onSave={handleSave}
        />
      )
    }

    // Review & test
    if (step === 'reviewTest') {
      return (
        <ReviewTestStep
          pdfText={appState.pdfData!.text}
          answers={wiz.answers}
          analysis={wiz.aiAnalysis!}
          testResults={wiz.testParseResults}
          onTestResults={(events) =>
            wizDispatch({ type: 'SET_TEST_RESULTS', payload: events })
          }
          onLooksGood={handleLooksGood}
          onFixFlagged={handleFixFlagged}
          onFailure={handleFailure}
        />
      )
    }

    // Correction flow
    if (step === 'correction') {
      return (
        <CorrectionStep
          flaggedEvents={wiz.flaggedEvents}
          currentIndex={wiz.currentFlaggedIndex}
          testResults={wiz.testParseResults}
          onSetCorrections={handleSetCorrections}
          onResolve={handleResolve}
          onAdvance={handleAdvance}
        />
      )
    }

    // Quiz steps (3a-3f) — have progress bar and nav bar
    if (!wiz.aiAnalysis) return null

    return (
      <>
        <WizardProgress currentStep={step} />
        {renderQuizStep(step)}
        <WizardNavBar
          currentStep={step}
          canNext={canNext()}
          onNext={handleNext}
          onPrev={handlePrev}
          onSkip={handleSkip}
          onCancel={handleCancel}
        />
      </>
    )
  }

  /**
   * Render the inner quiz step content.
   */
  function renderQuizStep(step: WizardStepId) {
    switch (step) {
      case 'documentStructure':
        return (
          <DocumentStructureStep
            analysis={wiz.aiAnalysis!}
            selected={wiz.answers.documentStructure}
            onSelect={(v) =>
              wizDispatch({ type: 'SET_STRUCTURE', payload: v })
            }
          />
        )
      case 'dateFormat':
        return (
          <DateFormatStep
            analysis={wiz.aiAnalysis!}
            selected={wiz.answers.dateFormat}
            onSelect={(v) =>
              wizDispatch({ type: 'SET_DATE_FORMAT', payload: v })
            }
          />
        )
      case 'timezone':
        return (
          <TimezoneStep
            analysis={wiz.aiAnalysis!}
            selected={wiz.answers.timezone}
            onSelect={(v) =>
              wizDispatch({ type: 'SET_TIMEZONE', payload: v })
            }
          />
        )
      case 'locations':
        return (
          <LocationsStep
            analysis={wiz.aiAnalysis!}
            selected={wiz.answers.locations}
            onSelect={(v) =>
              wizDispatch({ type: 'SET_LOCATIONS', payload: v })
            }
          />
        )
      case 'statusCodes':
        return (
          <StatusCodesStep
            analysis={wiz.aiAnalysis!}
            selected={wiz.answers.statusCodes}
            onSelect={(v) =>
              wizDispatch({ type: 'SET_STATUS_CODES', payload: v })
            }
          />
        )
      case 'eventNames':
        return (
          <EventNamesStep
            analysis={wiz.aiAnalysis!}
            selected={wiz.answers.eventNamePosition}
            onSelect={(v) =>
              wizDispatch({ type: 'SET_EVENT_NAME_POSITION', payload: v })
            }
          />
        )
      default:
        return null
    }
  }
}
