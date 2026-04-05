/**
 * Landing page with drop zone shell placeholder.
 */
export function HomePage() {
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

      {/* Drop zone shell — functionality wired in Chunk 3 */}
      <div
        className="w-full max-w-lg rounded-xl border-2 border-dashed border-on-surface-muted/30 bg-surface-dim p-12 text-center transition-colors hover:border-primary/50"
        role="region"
        aria-label="PDF upload area"
      >
        <div className="flex flex-col items-center gap-3 text-on-surface-muted">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-12 w-12 opacity-40" aria-hidden="true">
            <path fillRule="evenodd" d="M11.47 2.47a.75.75 0 011.06 0l4.5 4.5a.75.75 0 01-1.06 1.06l-3.22-3.22V16.5a.75.75 0 01-1.5 0V4.81L8.03 8.03a.75.75 0 01-1.06-1.06l4.5-4.5zM3 15.75a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
          </svg>
          <p className="text-sm font-medium">
            Drop your PDF here, or click to browse
          </p>
          <p className="text-xs">
            Supports schedules, syllabi, rosters, and more
          </p>
        </div>
      </div>
    </div>
  )
}
