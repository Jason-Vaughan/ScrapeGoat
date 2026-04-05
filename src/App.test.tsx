import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the ScrapeGoat heading', () => {
    render(<App />)
    expect(screen.getByText('ScrapeGoat')).toBeInTheDocument()
  })

  it('renders the tagline', () => {
    render(<App />)
    expect(screen.getByText('PDF Calendar Extractor')).toBeInTheDocument()
  })
})
