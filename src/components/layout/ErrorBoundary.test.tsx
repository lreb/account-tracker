import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ErrorBoundary from './ErrorBoundary'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn()

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// ─── Test helpers ─────────────────────────────────────────────────────────────

// Controls whether ThrowingChild throws on the next render
let shouldThrow = false

function ThrowingChild() {
  if (shouldThrow) throw new Error('test render error')
  return <div>child content</div>
}

function renderBoundary() {
  return render(
    <MemoryRouter>
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    </MemoryRouter>,
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    shouldThrow = false
    // Suppress React's built-in console.error noise from intentional throws
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('normal rendering', () => {
    it('renders children when no error has occurred', () => {
      renderBoundary()
      expect(screen.getByText('child content')).toBeInTheDocument()
    })

    it('does not show the fallback UI when there is no error', () => {
      renderBoundary()
      expect(screen.queryByText('common.error')).not.toBeInTheDocument()
    })
  })

  describe('error state', () => {
    beforeEach(() => {
      shouldThrow = true
    })

    it('shows the warning emoji', () => {
      renderBoundary()
      expect(screen.getByText('⚠️')).toBeInTheDocument()
    })

    it('shows the error heading', () => {
      renderBoundary()
      expect(screen.getByText('common.error')).toBeInTheDocument()
    })

    it('shows the error description', () => {
      renderBoundary()
      expect(screen.getByText('common.errorBoundaryDescription')).toBeInTheDocument()
    })

    it('shows the "Try Again" button', () => {
      renderBoundary()
      expect(screen.getByRole('button', { name: 'common.tryAgain' })).toBeInTheDocument()
    })

    it('shows the "Go to Dashboard" button', () => {
      renderBoundary()
      expect(screen.getByRole('button', { name: 'common.goToDashboard' })).toBeInTheDocument()
    })

    it('hides children while in error state', () => {
      renderBoundary()
      expect(screen.queryByText('child content')).not.toBeInTheDocument()
    })
  })

  describe('"Try Again" button', () => {
    it('resets the boundary so children render again', () => {
      shouldThrow = true
      renderBoundary()
      expect(screen.getByText('common.error')).toBeInTheDocument()

      shouldThrow = false
      fireEvent.click(screen.getByRole('button', { name: 'common.tryAgain' }))

      expect(screen.getByText('child content')).toBeInTheDocument()
      expect(screen.queryByText('common.error')).not.toBeInTheDocument()
    })

    it('does not navigate when "Try Again" is clicked', () => {
      shouldThrow = true
      renderBoundary()
      shouldThrow = false
      fireEvent.click(screen.getByRole('button', { name: 'common.tryAgain' }))
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })

  describe('"Go to Dashboard" button', () => {
    it('resets the boundary and navigates to /', () => {
      shouldThrow = true
      renderBoundary()
      shouldThrow = false
      fireEvent.click(screen.getByRole('button', { name: 'common.goToDashboard' }))

      expect(mockNavigate).toHaveBeenCalledWith('/')
      expect(screen.getByText('child content')).toBeInTheDocument()
    })
  })
})
