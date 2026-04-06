import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useFocusTrap } from '../hooks/useFocusTrap'
import {
  listTemplates,
  deleteTemplate,
  markTemplateUsed,
  downloadTemplate,
  importTemplateFromFile,
  saveTemplate,
  generateTemplateId,
} from '../services/templateStorage'
import {
  fetchCommunityTemplates,
  searchCommunityTemplates,
} from '../services/communityTemplates'
import { templateSchema } from '../schemas/templateSchema'
import type { ProfileTemplate, SavedTemplate, CommunityTemplateEntry } from '../schemas/templateSchema'

const GITHUB_ISSUE_URL =
  'https://github.com/Jason-Vaughan/ScrapeGoat/issues/new?template=template_request.md&title=%5BTemplate%5D+'

/**
 * Template Selection screen (Screen 2).
 * Shows saved templates, community templates, and a create-new CTA.
 */
export function TemplateSelectionPage() {
  const { state, dispatch } = useAppContext()
  const navigate = useNavigate()
  const { wizardAvailable } = useOnlineStatus()

  // Redirect to home if no PDF data loaded
  useEffect(() => {
    if (!state.pdfData) {
      navigate('/', { replace: true })
    }
  }, [state.pdfData, navigate])

  // Saved templates
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([])
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null)

  // Community templates
  const [communityTemplates, setCommunityTemplates] = useState<CommunityTemplateEntry[]>([])
  const [communityLoading, setCommunityLoading] = useState(false)
  const [communityError, setCommunityError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Import
  const importInputRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState<string | null>(null)

  // Share modal
  const [shareTemplate, setShareTemplate] = useState<ProfileTemplate | null>(null)
  const [copied, setCopied] = useState(false)
  const shareTrapRef = useFocusTrap(shareTemplate !== null)

  // Load saved templates on mount
  useEffect(() => {
    setSavedTemplates(listTemplates())
  }, [])

  // Fetch community templates on mount
  useEffect(() => {
    setCommunityLoading(true)
    fetchCommunityTemplates()
      .then(setCommunityTemplates)
      .catch(() => setCommunityError('Could not load community templates.'))
      .finally(() => setCommunityLoading(false))
  }, [])

  const filteredCommunity = searchCommunityTemplates(communityTemplates, searchQuery)

  /** Use a saved template — store in context and navigate to results. */
  const handleUseSaved = useCallback(() => {
    if (!selectedSavedId) return
    const saved = savedTemplates.find((t) => t.id === selectedSavedId)
    if (!saved) return
    markTemplateUsed(saved.id)
    dispatch({ type: 'SET_TEMPLATE', payload: saved.template })
    navigate('/results')
  }, [selectedSavedId, savedTemplates, dispatch, navigate])

  /** Delete a saved template after confirmation. */
  const handleDeleteSaved = useCallback(
    (id: string) => {
      const saved = savedTemplates.find((t) => t.id === id)
      const name = saved?.template.name ?? 'this template'
      if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return
      deleteTemplate(id)
      setSavedTemplates(listTemplates())
      if (selectedSavedId === id) setSelectedSavedId(null)
    },
    [selectedSavedId, savedTemplates]
  )

  /** Download a saved template as .json. */
  const handleDownloadSaved = useCallback(
    (id: string) => {
      const saved = savedTemplates.find((t) => t.id === id)
      if (saved) downloadTemplate(saved.template)
    },
    [savedTemplates]
  )

  /** Import a template from a .json file. */
  const handleImportFile = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      e.target.value = ''
      setImportError(null)
      try {
        const template = await importTemplateFromFile(file)
        const id = generateTemplateId(template.name)
        saveTemplate(id, template)
        setSavedTemplates(listTemplates())
      } catch (err) {
        setImportError(
          err instanceof Error ? err.message : 'Failed to import template'
        )
      }
    },
    []
  )

  /** Use a community template — fetch its full JSON and navigate. */
  const handleUseCommunity = useCallback(
    async (entry: CommunityTemplateEntry) => {
      try {
        const url = `https://raw.githubusercontent.com/Jason-Vaughan/ScrapeGoat/main/templates/${entry.file}`
        const res = await fetch(url)
        if (!res.ok) throw new Error('fetch failed')
        const json = await res.json()
        const parsed = templateSchema.safeParse(json)
        if (!parsed.success) throw new Error('invalid template')
        dispatch({ type: 'SET_TEMPLATE', payload: parsed.data })
        navigate('/results')
      } catch {
        setCommunityError(`Failed to load template "${entry.name}".`)
      }
    },
    [dispatch, navigate]
  )

  /** Open share-to-community modal for a saved template. */
  const handleShareToCommunity = useCallback(
    (id: string) => {
      const saved = savedTemplates.find((t) => t.id === id)
      if (saved) {
        setShareTemplate(saved.template)
        setCopied(false)
      }
    },
    [savedTemplates]
  )

  /** Copy template JSON to clipboard. */
  const handleCopyJson = useCallback(async () => {
    if (!shareTemplate) return
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(shareTemplate, null, 2)
      )
      setCopied(true)
    } catch {
      // Fallback: clipboard API not available (e.g., non-HTTPS)
      setCopied(false)
      alert('Could not copy to clipboard. Please copy the template JSON manually from the downloaded file.')
    }
  }, [shareTemplate])

  if (!state.pdfData) return null

  const { fileName, pageCount } = state.pdfData
  const lineCount = state.pdfData.text.split('\n').length

  return (
    <div className="mx-auto max-w-2xl py-8">
      {/* PDF info banner */}
      <div className="mb-6 rounded-lg border border-green-600/30 bg-green-600/10 px-4 py-3 text-sm">
        <span className="font-medium text-green-700 dark:text-green-400">
          PDF loaded:
        </span>{' '}
        <span className="break-all text-on-surface">
          &ldquo;{fileName}&rdquo; ({lineCount} lines, {pageCount}{' '}
          {pageCount === 1 ? 'page' : 'pages'})
        </span>
      </div>

      <h1 className="mb-6 font-heading text-2xl font-bold">
        How would you like to parse this?
      </h1>

      {/* Section 1: Saved templates */}
      <section className="mb-6 rounded-xl border border-on-surface-muted/20 bg-surface-dim p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">
            Use a saved template
          </h2>
          <button
            type="button"
            className="text-xs text-primary underline hover:text-primary-dark dark:hover:text-primary-light"
            onClick={() => importInputRef.current?.click()}
          >
            Import .json
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleImportFile}
            aria-hidden="true"
          />
        </div>

        {importError && (
          <div
            className="mb-3 rounded border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary-dark dark:text-primary-light"
            role="alert"
          >
            {importError}
          </div>
        )}

        {savedTemplates.length === 0 ? (
          <p className="text-sm text-on-surface-muted">
            No saved templates yet. Create one with the wizard or import a .json
            file.
          </p>
        ) : (
          <>
            <p className="mb-2 text-sm text-on-surface-muted">
              You have {savedTemplates.length} saved{' '}
              {savedTemplates.length === 1 ? 'template' : 'templates'}
            </p>
            <ul className="space-y-2" role="radiogroup" aria-label="Saved templates">
              {savedTemplates.map((saved) => (
                <li
                  key={saved.id}
                  className="flex items-center gap-3 rounded-lg border border-on-surface-muted/10 bg-surface px-3 py-2"
                >
                  <input
                    type="radio"
                    name="saved-template"
                    id={`saved-${saved.id}`}
                    value={saved.id}
                    checked={selectedSavedId === saved.id}
                    onChange={() => setSelectedSavedId(saved.id)}
                    className="accent-primary"
                  />
                  <label
                    htmlFor={`saved-${saved.id}`}
                    className="flex-1 text-sm"
                  >
                    <span className="font-medium">{saved.template.name}</span>
                    {saved.lastUsed && (
                      <span className="ml-2 text-xs text-on-surface-muted">
                        last used{' '}
                        {new Date(saved.lastUsed).toLocaleDateString()}
                      </span>
                    )}
                  </label>
                  <button
                    type="button"
                    className="rounded px-2 py-1.5 text-xs text-on-surface-muted hover:bg-surface-dim hover:text-primary transition-colors"
                    onClick={() => handleDownloadSaved(saved.id)}
                    aria-label={`Download ${saved.template.name}`}
                  >
                    Download
                  </button>
                  <button
                    type="button"
                    className="rounded px-2 py-1.5 text-xs text-on-surface-muted hover:bg-surface-dim hover:text-primary transition-colors"
                    onClick={() => handleShareToCommunity(saved.id)}
                    aria-label={`Share ${saved.template.name}`}
                  >
                    Share
                  </button>
                  <button
                    type="button"
                    className="rounded px-2 py-1.5 text-xs text-on-surface-muted hover:bg-surface-dim hover:text-primary transition-colors"
                    onClick={() => handleDeleteSaved(saved.id)}
                    aria-label={`Delete ${saved.template.name}`}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={!selectedSavedId}
              className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={handleUseSaved}
            >
              Use Selected
            </button>
          </>
        )}
      </section>

      {/* Section 2: Community templates */}
      <section className="mb-6 rounded-xl border border-on-surface-muted/20 bg-surface-dim p-5">
        <h2 className="mb-3 font-heading text-lg font-semibold">
          Browse community templates
        </h2>

        {communityLoading && (
          <p className="text-sm text-on-surface-muted">
            Loading community templates...
          </p>
        )}

        {communityError && (
          <div
            className="mb-3 rounded border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary-dark dark:text-primary-light"
            role="alert"
          >
            {communityError}
          </div>
        )}

        {!communityLoading && !communityError && (
          <>
            <p className="mb-2 text-sm text-on-surface-muted">
              {communityTemplates.length} templates shared by the community
            </p>
            <input
              type="search"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mb-3 w-full rounded-lg border border-on-surface-muted/20 bg-surface px-3 py-2 text-sm placeholder:text-on-surface-muted/50 focus:border-primary focus:outline-none"
              aria-label="Search community templates"
            />

            {communityTemplates.length === 0 ? (
              <p className="text-sm text-on-surface-muted">
                No community templates available yet. Be the first to share one!
              </p>
            ) : filteredCommunity.length === 0 ? (
              <p className="text-sm text-on-surface-muted">
                No templates match &ldquo;{searchQuery}&rdquo;.
              </p>
            ) : (
              <ul className="space-y-2">
                {filteredCommunity.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between rounded-lg border border-on-surface-muted/10 bg-surface px-3 py-2"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">{entry.name}</p>
                      <p className="text-xs text-on-surface-muted">
                        {entry.source} &middot; {entry.eventsTestedCount} events
                        tested
                      </p>
                      {entry.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {entry.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-on-surface-muted/10 px-2 py-0.5 text-xs text-on-surface-muted"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="ml-3 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white"
                      onClick={() => handleUseCommunity(entry)}
                    >
                      Use
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      {/* Section 3: Create new template (hidden when proxy is unreachable) */}
      {wizardAvailable ? (
        <section className="rounded-xl border border-on-surface-muted/20 bg-surface-dim p-5">
          <h2 className="mb-2 font-heading text-lg font-semibold">
            Create a new template
          </h2>
          <p className="mb-3 text-sm text-on-surface-muted">
            Our AI assistant will help you build one in about 2 minutes.
          </p>
          <button
            type="button"
            className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-white"
            onClick={() => navigate('/wizard')}
          >
            Start Template Wizard
          </button>
        </section>
      ) : (
        <section className="rounded-xl border border-on-surface-muted/20 bg-surface-dim p-5">
          <h2 className="mb-2 font-heading text-lg font-semibold text-on-surface-muted">
            Template Wizard unavailable
          </h2>
          <p className="text-sm text-on-surface-muted">
            The AI template wizard requires an internet connection. You can still
            use saved templates, browse community templates, or import a .json file.
          </p>
        </section>
      )}

      {/* Back to start link */}
      <div className="mt-6 text-center">
        <button
          type="button"
          className="text-sm text-on-surface-muted underline hover:text-primary"
          onClick={() => {
            dispatch({ type: 'CLEAR_PDF_DATA' })
            dispatch({ type: 'CLEAR_TEMPLATE' })
            navigate('/')
          }}
        >
          Back to start
        </button>
      </div>

      {/* Share to Community modal */}
      {shareTemplate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-label="Share to Community"
          onClick={() => setShareTemplate(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setShareTemplate(null)
          }}
        >
          <div
            ref={shareTrapRef}
            className="mx-2 w-full max-w-md rounded-xl bg-surface p-5 shadow-xl sm:mx-4 sm:p-6"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 font-heading text-lg font-semibold">
              Share to Community
            </h3>
            <p className="mb-4 text-sm text-on-surface-muted">
              {copied
                ? 'Template JSON copied to clipboard!'
                : 'Copy your template JSON, then open a GitHub Issue to submit it.'}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
                onClick={handleCopyJson}
              >
                {copied ? 'Copied!' : 'Copy JSON'}
              </button>
              <a
                href={`${GITHUB_ISSUE_URL}${encodeURIComponent(shareTemplate.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary"
              >
                Open GitHub Issue
              </a>
              <button
                type="button"
                className="text-sm text-on-surface-muted underline"
                onClick={() => setShareTemplate(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
