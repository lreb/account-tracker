import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Account } from '@/types'
import AccountFormPage from './AccountFormPage'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn()
const mockAccounts: Account[] = []
const mockAdd = vi.fn(() => Promise.resolve())
const mockUpdate = vi.fn(() => Promise.resolve())
const mockSaveSetting = vi.fn(() => Promise.resolve())
let mockParamId: string | undefined = undefined
let mockSearchParamsString = ''

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: mockParamId }),
    useSearchParams: () => [new URLSearchParams(mockSearchParamsString), vi.fn()],
  }
})

vi.mock('@/stores/accounts.store', () => ({
  useAccountsStore: () => ({ accounts: mockAccounts, add: mockAdd, update: mockUpdate }),
}))

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: () => ({ baseCurrency: 'USD', saveSetting: mockSaveSetting }),
}))

vi.mock('@/constants/account-subtypes', () => ({
  ACCOUNT_SUBTYPE_OPTIONS_BY_TYPE: {
    asset: [{ value: 'checking-debit', labelKey: 'accounts.subtypes.checkingDebit' }],
    liability: [{ value: 'credit-card', labelKey: 'accounts.subtypes.creditCard' }],
  },
  getOtherSubtypeLabelKey: (type: string) =>
    type === 'asset' ? 'accounts.subtypes.otherAsset' : 'accounts.subtypes.otherLiability',
  getOtherSubtypeValue: (type: string) =>
    type === 'asset' ? 'other-asset' : 'other-liability',
}))

vi.mock('@/constants/currencies', () => ({
  COMMON_CURRENCIES: [
    { code: 'USD', label: 'US Dollar (USD)' },
    { code: 'EUR', label: 'Euro (EUR)' },
  ],
}))

vi.mock('uuid', () => ({ v4: () => 'test-uuid' }))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
  }) => (
    <button type={type ?? 'button'} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/input', () => ({
  Input: ({
    id,
    type,
    placeholder,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input id={id} type={type} placeholder={placeholder} {...props} />
  ),
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({
    children,
    htmlFor,
  }: {
    children: React.ReactNode
    htmlFor?: string
  }) => <label htmlFor={htmlFor}>{children}</label>,
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode
    value?: string
    onValueChange?: (v: string) => void
  }) => (
    <div data-value={value} data-onchange={String(onValueChange)}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
  SelectValue: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-value={value}>{children}</div>
  ),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc-edit',
    name: 'Savings',
    type: 'asset',
    subtype: 'checking-debit',
    openingBalance: 50000,
    currency: 'USD',
    hidden: false,
    cancelled: false,
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AccountFormPage />
    </MemoryRouter>,
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AccountFormPage', () => {
  beforeEach(() => {
    mockAccounts.length = 0
    mockParamId = undefined
    mockSearchParamsString = ''
    vi.clearAllMocks()
    mockAdd.mockResolvedValue(undefined)
    mockUpdate.mockResolvedValue(undefined)
    mockSaveSetting.mockResolvedValue(undefined)
  })

  describe('add mode (no id param)', () => {
    it('renders the add heading', () => {
      renderPage()
      expect(screen.getByText(/common\.add/)).toBeInTheDocument()
      expect(screen.getByText(/settings\.accounts/)).toBeInTheDocument()
    })

    it('renders the name input', () => {
      renderPage()
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('back button navigates to /settings/accounts', () => {
      renderPage()
      fireEvent.click(screen.getAllByRole('button')[0])
      expect(mockNavigate).toHaveBeenCalledWith('/settings/accounts')
    })

    it('cancel button navigates to /settings/accounts', () => {
      renderPage()
      fireEvent.click(screen.getByText('common.cancel'))
      expect(mockNavigate).toHaveBeenCalledWith('/settings/accounts')
    })

    it('does not show the onboarding banner by default', () => {
      renderPage()
      expect(screen.queryByText('accounts.onboardingTitle')).not.toBeInTheDocument()
    })

    it('submits the form and calls add with the entered name', async () => {
      renderPage()
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'New Wallet' } })
      fireEvent.click(screen.getByText('common.save'))
      await waitFor(() => {
        expect(mockAdd).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'test-uuid', name: 'New Wallet' }),
        )
      })
    })

    it('navigates to /settings/accounts after successful add', async () => {
      renderPage()
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'New Wallet' } })
      fireEvent.click(screen.getByText('common.save'))
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/settings/accounts')
      })
    })

    it('shows a validation error when name is empty and form is submitted', async () => {
      renderPage()
      fireEvent.click(screen.getByText('common.save'))
      await waitFor(() => {
        expect(mockAdd).not.toHaveBeenCalled()
      })
    })

    it('converts the openingBalance string to cents when saving', async () => {
      renderPage()
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Budget Account' } })
      // Opening balance input: find by id since label is not wired via htmlFor in the mock
      const balanceInput = screen.getByPlaceholderText('0.00')
      fireEvent.change(balanceInput, { target: { value: '25.50' } })
      fireEvent.click(screen.getByText('common.save'))
      await waitFor(() => {
        expect(mockAdd).toHaveBeenCalledWith(
          expect.objectContaining({ openingBalance: 2550 }),
        )
      })
    })
  })

  describe('onboarding mode', () => {
    beforeEach(() => {
      mockSearchParamsString = 'onboarding=1'
    })

    it('shows the onboarding banner when onboarding=1', () => {
      renderPage()
      expect(screen.getByText('accounts.onboardingTitle')).toBeInTheDocument()
    })

    it('shows the onboarding description text', () => {
      renderPage()
      expect(screen.getByText('accounts.onboardingDesc')).toBeInTheDocument()
    })

    it('shows the skip tour button in onboarding mode', () => {
      renderPage()
      expect(screen.getByText('accounts.skipTour')).toBeInTheDocument()
    })

    it('clicking skip tour calls saveSetting and navigates', async () => {
      renderPage()
      fireEvent.click(screen.getByText('accounts.skipTour'))
      await waitFor(() => {
        expect(mockSaveSetting).toHaveBeenCalledWith('accountsOnboardingSeen', '1')
        expect(mockNavigate).toHaveBeenCalledWith('/settings/accounts')
      })
    })

    it('successful submit in onboarding mode calls saveSetting', async () => {
      renderPage()
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'First Account' } })
      fireEvent.click(screen.getByText('common.save'))
      await waitFor(() => {
        expect(mockSaveSetting).toHaveBeenCalledWith('accountsOnboardingSeen', '1')
      })
    })
  })

  describe('edit mode (id param present)', () => {
    beforeEach(() => {
      mockParamId = 'acc-edit'
      mockAccounts.push(makeAccount({ id: 'acc-edit', name: 'Savings' }))
    })

    it('renders the edit heading', () => {
      renderPage()
      expect(screen.getByText(/common\.edit/)).toBeInTheDocument()
    })

    it('pre-fills the name field with the existing account name', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByRole('textbox')).toHaveValue('Savings')
      })
    })

    it('does not show the onboarding banner in edit mode', () => {
      mockSearchParamsString = 'onboarding=1'
      renderPage()
      expect(screen.queryByText('accounts.onboardingTitle')).not.toBeInTheDocument()
    })

    it('does not show the skip tour button in edit mode', () => {
      mockSearchParamsString = 'onboarding=1'
      renderPage()
      expect(screen.queryByText('accounts.skipTour')).not.toBeInTheDocument()
    })

    it('submits and calls update (not add) for existing account', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByRole('textbox')).toHaveValue('Savings')
      })
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Savings Updated' } })
      fireEvent.click(screen.getByText('common.save'))
      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'acc-edit', name: 'Savings Updated' }),
        )
        expect(mockAdd).not.toHaveBeenCalled()
      })
    })

    it('navigates to /settings/accounts after successful update', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByRole('textbox')).toHaveValue('Savings')
      })
      fireEvent.click(screen.getByText('common.save'))
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/settings/accounts')
      })
    })
  })

  describe('redirect when editing unknown account', () => {
    it('redirects to /settings/accounts when id does not match any account', async () => {
      mockParamId = 'non-existent-id'
      // mockAccounts is empty — no account with this id
      renderPage()
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/settings/accounts', { replace: true })
      })
    })
  })

  describe('hidden and cancelled toggles', () => {
    it('renders the hide-from-app toggle', () => {
      renderPage()
      expect(screen.getByText('accounts.hideFromApp')).toBeInTheDocument()
    })

    it('renders the cancelled account toggle', () => {
      renderPage()
      expect(screen.getByText('accounts.cancelledAccount')).toBeInTheDocument()
    })

    it('clicking the hidden toggle switches aria-checked', () => {
      renderPage()
      // Two switches on the page: [0] = hidden, [1] = cancelled
      const hiddenSwitch = screen.getAllByRole('switch')[0]
      expect(hiddenSwitch).toHaveAttribute('aria-checked', 'false')
      fireEvent.click(hiddenSwitch)
      expect(hiddenSwitch).toHaveAttribute('aria-checked', 'true')
    })

    it('clicking the cancelled toggle switches aria-checked', () => {
      renderPage()
      const cancelledSwitch = screen.getAllByRole('switch')[1]
      expect(cancelledSwitch).toHaveAttribute('aria-checked', 'false')
      fireEvent.click(cancelledSwitch)
      expect(cancelledSwitch).toHaveAttribute('aria-checked', 'true')
    })
  })
})
