import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SidebarGoogleAuthSection from './SidebarGoogleAuthSection'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

let mockGoogleClientId = 'test-client-id'

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: () => ({ googleClientId: mockGoogleClientId }),
}))

const mockToastError = vi.hoisted(() => vi.fn())

vi.mock('sonner', () => ({
  toast: { error: mockToastError },
}))

const mockIsSignedIn = vi.fn(() => false)
const mockIsConfigured = vi.fn(() => true)
const mockStartSignIn = vi.fn()
const mockGetProfile = vi.fn()

vi.mock('@/lib/google-drive', () => ({
  isSignedInToGoogle: () => mockIsSignedIn(),
  isGoogleDriveConfigured: (_id: string) => mockIsConfigured(),
  startGoogleSignIn: (...args: unknown[]) => mockStartSignIn(...args),
  getGoogleDriveAccountProfile: () => mockGetProfile(),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderSection(onClose = vi.fn()) {
  return render(
    <MemoryRouter>
      <SidebarGoogleAuthSection onClose={onClose} />
    </MemoryRouter>,
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SidebarGoogleAuthSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGoogleClientId = 'test-client-id'
    mockIsSignedIn.mockReturnValue(false)
    mockIsConfigured.mockReturnValue(true)
    // Default: a never-resolving promise so async side effects don't interfere
    mockGetProfile.mockReturnValue(new Promise(() => {}))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ─── Signed-out state ────────────────────────────────────────────────────

  describe('signed-out state', () => {
    it('shows the Google auth title', () => {
      renderSection()
      expect(screen.getByText('sidebar.googleAuthTitle')).toBeInTheDocument()
    })

    it('shows the login prompt text', () => {
      renderSection()
      expect(screen.getByText('sidebar.googleAuthLoginPrompt')).toBeInTheDocument()
    })

    it('shows the connect button', () => {
      renderSection()
      expect(screen.getByRole('button', { name: /sidebar\.googleAuthLoginAction/i })).toBeInTheDocument()
    })

    it('does not show the connected heading', () => {
      renderSection()
      expect(screen.queryByText('sidebar.googleAuthConnected')).not.toBeInTheDocument()
    })
  })

  // ─── Connect button ──────────────────────────────────────────────────────

  describe('connect button — drive configured', () => {
    it('calls onClose when the button is clicked', () => {
      const onClose = vi.fn()
      renderSection(onClose)
      fireEvent.click(screen.getByRole('button', { name: /sidebar\.googleAuthLoginAction/i }))
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('calls startGoogleSignIn with the client id and the drive callback route', () => {
      renderSection()
      fireEvent.click(screen.getByRole('button', { name: /sidebar\.googleAuthLoginAction/i }))
      expect(mockStartSignIn).toHaveBeenCalledWith('test-client-id', '/settings/google-drive')
    })

    it('does not show a toast error when drive is configured', () => {
      renderSection()
      fireEvent.click(screen.getByRole('button', { name: /sidebar\.googleAuthLoginAction/i }))
      expect(mockToastError).not.toHaveBeenCalled()
    })
  })

  describe('connect button — drive not configured', () => {
    beforeEach(() => {
      mockIsConfigured.mockReturnValue(false)
    })

    it('shows a toast error when drive is not configured', () => {
      renderSection()
      fireEvent.click(screen.getByRole('button', { name: /sidebar\.googleAuthLoginAction/i }))
      expect(mockToastError).toHaveBeenCalledWith('settings.driveNotConfigured')
    })

    it('does not call onClose or startGoogleSignIn when drive is not configured', () => {
      const onClose = vi.fn()
      renderSection(onClose)
      fireEvent.click(screen.getByRole('button', { name: /sidebar\.googleAuthLoginAction/i }))
      expect(onClose).not.toHaveBeenCalled()
      expect(mockStartSignIn).not.toHaveBeenCalled()
    })
  })

  // ─── Signed-in state ─────────────────────────────────────────────────────

  describe('signed-in state', () => {
    beforeEach(() => {
      mockIsSignedIn.mockReturnValue(true)
    })

    it('shows the connected heading', async () => {
      mockGetProfile.mockResolvedValue({ name: 'Jane Doe', email: 'jane@example.com', pictureUrl: null })
      renderSection()
      await waitFor(() =>
        expect(screen.getByText('sidebar.googleAuthConnected')).toBeInTheDocument(),
      )
    })

    it('shows the profile name after the profile loads', async () => {
      mockGetProfile.mockResolvedValue({ name: 'Jane Doe', email: 'jane@example.com', pictureUrl: null })
      renderSection()
      await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument())
    })

    it('shows the profile email after the profile loads', async () => {
      mockGetProfile.mockResolvedValue({ name: 'Jane Doe', email: 'jane@example.com', pictureUrl: null })
      renderSection()
      await waitFor(() => expect(screen.getByText('jane@example.com')).toBeInTheDocument())
    })

    it('shows the avatar image when pictureUrl is set', async () => {
      mockGetProfile.mockResolvedValue({
        name: 'Jane Doe',
        email: 'jane@example.com',
        pictureUrl: 'https://example.com/avatar.jpg',
      })
      renderSection()
      await waitFor(() => {
        const img = screen.getByAltText('sidebar.googleAuthImageAlt')
        expect(img).toBeInTheDocument()
        expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg')
      })
    })

    it('shows a placeholder div (no img) when pictureUrl is absent', async () => {
      mockGetProfile.mockResolvedValue({ name: 'Jane Doe', email: 'jane@example.com', pictureUrl: null })
      renderSection()
      await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument())
      expect(screen.queryByAltText('sidebar.googleAuthImageAlt')).not.toBeInTheDocument()
    })

    it('shows "common.loading" while the profile request is in-flight', async () => {
      mockGetProfile.mockReturnValue(new Promise(() => {})) // never resolves
      renderSection()
      await waitFor(() => expect(screen.getByText('common.loading')).toBeInTheDocument())
    })

    it('shows fallback name and email when the profile request fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      mockGetProfile.mockRejectedValue(new Error('network error'))
      renderSection()
      await waitFor(() =>
        expect(screen.getByText('sidebar.googleAuthFallbackName')).toBeInTheDocument(),
      )
      expect(screen.getByText('sidebar.googleAuthFallbackEmail')).toBeInTheDocument()
    })
  })
})
