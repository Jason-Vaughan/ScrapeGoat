interface TurnstileProps {
  containerRef: React.RefObject<HTMLDivElement | null>
  configured: boolean
}

/**
 * Renders the Turnstile verification widget container.
 * Hidden when Turnstile is not configured (no site key in env).
 */
export function Turnstile({ containerRef, configured }: TurnstileProps) {
  if (!configured) return null

  return (
    <div className="my-4 flex justify-center">
      <div ref={containerRef} />
    </div>
  )
}
