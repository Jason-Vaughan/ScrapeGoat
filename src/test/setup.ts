import '@testing-library/jest-dom'

/**
 * Stub DOMMatrix for jsdom (required by pdfjs-dist canvas module).
 */
if (typeof globalThis.DOMMatrix === 'undefined') {
  // @ts-expect-error minimal stub for pdfjs-dist import in jsdom
  globalThis.DOMMatrix = class DOMMatrix {
    constructor() {
      return new Proxy(this, {
        get: (_target, prop) => {
          if (typeof prop === 'string' && /^[a-f]$/.test(prop)) return 0
          return undefined
        },
      })
    }
  }
}

/**
 * Mock window.matchMedia for jsdom (not natively supported).
 */
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})
