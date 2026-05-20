import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import GoogleDriveSyncPage from './GoogleDriveSyncPage'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn()

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('@/stores/transactions.store', () => ({
  useTransactionsStore: () => ({ load: vi.fn() }),
}))

vi.mock('@/stores/accounts.store', () => ({
  useAccountsStore: () => ({ load: vi.fn() }),
}))

vi.mock('@/stores/categories.store', () => ({
  useCategoriesStore: () => ({ load: vi.fn() }),
}))

vi.mock('@/stores/labels.store', () => ({
  useLabelsStore: () => ({ load: vi.fn() }),
}))

vi.mock('@/stores/budgets.store', () => ({
  useBudgetsStore: () => ({ load: vi.fn() }),
}))

vi.mock('@/stores/vehicles.store', () => ({
  useVehiclesStore: () => ({ load: vi.fn() }),
}))

const mockSaveSetting = vi.fn()
let mockGoogleClientId = ''

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: () => ({
    load: vi.fn(),
    saveSetting: mockSaveSetting,
    googleClientId: mockGoogleClientId,
  }),
}))

vi.mock('@/stores/exchange-rates.store', () => ({
  useExchangeRatesStore: () => ({ load: vi.fn() }),
}))

const mockIsSignedIn = vi.fn(() => false)
const mockIsConfigured = vi.fn(() => false)
const mockStartSignIn = vi.fn(() => Promise.resolve())
const mockSignOut = vi.fn()
const mockUpload = vi.fn(() => Promise.resolve())
const mockDownload = vi.fn(() => Promise.resolve('{}'))

vi.mock('@/lib/google-drive', () => ({
  isSignedInToGoogle: () => mockIsSignedIn(),
  isGoogleDriveConfigured: () => mockIsConfigured(),
  startGoogleSignIn: () => mockStartSignIn(),
  signOutOfGoogle: () => mockSignOut(),
  uploadBackupToDrive: () => mockUpload(),
  downloadBackupFromDrive: () => mockDownload(),
}))

vi.mock('@/lib/backup', () => ({
  buildFullBackup: vi.fn(() => Promise.resolve({})),
  parseBackupFile: vi.fn(() => ({})),
  restoreFromBackup: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children, onClick, disabled, variant,
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    variant?: string
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} data-variant={variant}>
      {children}
    </button>
  ),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderPage() {
  return render(
    <MemoryRouter>
      <GoogleDriveSyncPage />
    </MemoryRouter>,
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GoogleDriveSyncPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsSignedIn.mockReturnValue(false)
    mockIsConfigured.mockReturnValue(false)
    mockGoogleClientId = ''
  })

  describe('page header', () => {
    it('renders the page title', () => {
      renderPage()
      expect(screen.getByText('settings.googleDriveTitle')).toBeInTheDocument()
    })

    it('back button navigates to /settings', () => {
      renderPage()
      fireEvent.click(screen.getByRole('button', { name: 'common.back' }))
      expect(mockNavigate).toHaveBeenCalledWith('/settings')
    })
  })

  describe('signed-out state', () => {
    it('renders the connect button when not signed in', () => {
      renderPage()
      expect(screen.getByText('settings.driveConnect')).toBeInTheDocument()
    })

    it('renders the configure button when not signed in', () => {
      renderPage()
      expect(screen.getByText('settings.driveConfigureBtn')).toBeInTheDocument()
    })

    it('does not render backup/restore buttons when not signed in', () => {
      renderPage()
      expect(screen.queryByText('settings.driveBackup')).toBeNull()
      expect(screen.queryByText('settings.driveRestore')).toBeNull()
    })

    it('clicking configure button opens the client-id form', () => {
      renderPage()
      fireEvent.click(screen.getByText('settings.driveConfigureBtn'))
      expect(screen.getByPlaceholderText('12345678-xxxx.apps.googleusercontent.com')).toBeInTheDocument()
    })
  })

  describe('signed-in state', () => {
    beforeEach(() => {
      mockIsSignedIn.mockReturnValue(true)
    })

    it('renders the connected indicator', () => {
      renderPage()
      expect(screen.getByText('settings.driveConnected')).toBeInTheDocument()
    })

    it('renders the backup button', () => {
      renderPage()
      expect(screen.getByText('settings.driveBackup')).toBeInTheDocument()
    })

    it('renders the restore button', () => {
      renderPage()
      expect(screen.getByText('settings.driveRestore')).toBeInTheDocument()
    })

    it('renders the disconnect button', () => {
      renderPage()
      expect(screen.getByText('settings.driveDisconnect')).toBeInTheDocument()
    })

    it('clicking restore opens the confirmation dialog', () => {
      renderPage()
      expect(screen.queryByRole('dialog')).toBeNull()
      fireEvent.click(screen.getByText('settings.driveRestore'))
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('restore dialog shows data-override warning message', () => {
      renderPage()
      fireEvent.click(screen.getByText('settings.driveRestore'))
      expect(screen.getByText('settings.restoreConfirmDesc')).toBeInTheDocument()
    })

    it('restore dialog shows the confirmation title', () => {
      renderPage()
      fireEvent.click(screen.getByText('settings.driveRestore'))
      expect(screen.getByText('settings.restoreConfirmTitle')).toBeInTheDocument()
    })
  })

  describe('configure form', () => {
    it('cancel button closes the form', () => {
      renderPage()
      fireEvent.click(screen.getByText('settings.driveConfigureBtn'))
      // form is open
      expect(screen.getByPlaceholderText('12345678-xxxx.apps.googleusercontent.com')).toBeInTheDocument()
      fireEvent.click(screen.getByText('common.cancel'))
      // form should be closed
      expect(screen.queryByPlaceholderText('12345678-xxxx.apps.googleusercontent.com')).toBeNull()
    })
  })
})
