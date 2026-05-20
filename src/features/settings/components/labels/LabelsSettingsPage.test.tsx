import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Label, Transaction } from '@/types'
import LabelsSettingsPage from './LabelsSettingsPage'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockLabels: Label[] = []
const mockTransactions: Transaction[] = []
const mockLoad = vi.fn()
const mockAdd = vi.fn(() => Promise.resolve())
const mockUpdate = vi.fn(() => Promise.resolve())
const mockRemove = vi.fn(() => Promise.resolve())
const mockRemoveLabelFromTransactions = vi.fn(() => Promise.resolve())

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('@/stores/labels.store', () => ({
  useLabelsStore: () => ({
    labels: mockLabels,
    load: mockLoad,
    add: mockAdd,
    update: mockUpdate,
    remove: mockRemove,
  }),
}))

vi.mock('@/stores/transactions.store', () => ({
  useTransactionsStore: (selector?: (s: unknown) => unknown) => {
    const state = {
      transactions: mockTransactions,
      removeLabelFromTransactions: mockRemoveLabelFromTransactions,
    }
    return selector ? selector(state) : state
  },
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
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/scroll-to-top-button', () => ({
  ScrollToTopButton: () => null,
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeLabel(overrides: Partial<Label> = {}): Label {
  return {
    id: 'lbl-1',
    name: 'Business',
    color: '#3b82f6',
    ...overrides,
  }
}

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    type: 'expense',
    amount: 1000,
    date: new Date().toISOString(),
    categoryId: 'cat-1',
    accountId: 'acc-1',
    description: 'Test',
    status: 'cleared',
    currency: 'USD',
    labels: [],
    ...overrides,
  }
}

async function renderPage() {
  const result = render(
    <MemoryRouter>
      <LabelsSettingsPage />
    </MemoryRouter>,
  )
  await act(async () => {})
  return result
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LabelsSettingsPage', () => {
  beforeEach(() => {
    mockLabels.length = 0
    mockTransactions.length = 0
    vi.clearAllMocks()
    mockAdd.mockResolvedValue(undefined)
    mockUpdate.mockResolvedValue(undefined)
    mockRemove.mockResolvedValue(undefined)
    mockRemoveLabelFromTransactions.mockResolvedValue(undefined)
  })

  describe('page header', () => {
    it('renders the page title', async () => {
      await renderPage()
      expect(screen.getByText('settings.labels')).toBeInTheDocument()
    })

    it('calls load on mount', async () => {
      await renderPage()
      expect(mockLoad).toHaveBeenCalledOnce()
    })
  })

  describe('floating add button', () => {
    it('renders the floating add button', async () => {
      await renderPage()
      expect(screen.getByRole('button', { name: 'common.add' })).toBeInTheDocument()
    })

    it('floating add button opens the label dialog', async () => {
      await renderPage()
      expect(screen.queryByRole('dialog')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'common.add' }))
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('dialog shows the new-label title when opened via FAB', async () => {
      await renderPage()
      fireEvent.click(screen.getByRole('button', { name: 'common.add' }))
      expect(screen.getByText('settings.labelsNewLabel')).toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('renders the empty state message when no labels exist', async () => {
      await renderPage()
      expect(screen.getByText('settings.labelsNoLabels')).toBeInTheDocument()
    })

    it('renders the addFirst button in the empty state', async () => {
      await renderPage()
      expect(screen.getByText('settings.labelsAddFirst')).toBeInTheDocument()
    })

    it('addFirst button opens the label dialog', async () => {
      await renderPage()
      fireEvent.click(screen.getByText('settings.labelsAddFirst'))
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('does not render a label list when no labels exist', async () => {
      await renderPage()
      expect(screen.queryByRole('list')).toBeNull()
    })
  })

  describe('label list', () => {
    it('renders the label name', async () => {
      mockLabels.push(makeLabel({ name: 'Travel' }))
      await renderPage()
      expect(screen.getByText('Travel')).toBeInTheDocument()
    })

    it('renders the orphaned badge for orphan labels', async () => {
      mockTransactions.push(makeTx({ labels: ['orphan-id'] }))
      await renderPage()
      expect(screen.getByText('settings.labelsOrphanBadge')).toBeInTheDocument()
    })

    it('edit button opens the label dialog', async () => {
      mockLabels.push(makeLabel({ id: 'lbl-1', name: 'Business' }))
      await renderPage()
      // Button order per label row: [edit, trash] + FAB at end
      fireEvent.click(screen.getAllByRole('button')[0])
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('dialog shows the edit-label title when opened via edit button', async () => {
      mockLabels.push(makeLabel({ id: 'lbl-1', name: 'Business' }))
      await renderPage()
      fireEvent.click(screen.getAllByRole('button')[0])
      expect(screen.getByText('settings.labelsEditLabel')).toBeInTheDocument()
    })
  })

  describe('delete confirmation dialog', () => {
    it('trash button on a regular label opens the delete confirmation dialog', async () => {
      mockLabels.push(makeLabel({ id: 'lbl-1', name: 'Business' }))
      await renderPage()
      expect(screen.queryByRole('dialog')).toBeNull()
      // Button order per label row: [edit(0), trash(1), fab(2)]
      fireEvent.click(screen.getAllByRole('button')[1])
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('delete dialog shows the delete title', async () => {
      mockLabels.push(makeLabel({ id: 'lbl-1', name: 'Business' }))
      await renderPage()
      fireEvent.click(screen.getAllByRole('button')[1])
      expect(screen.getByText('settings.labelsDeleteTitle')).toBeInTheDocument()
    })

    it('delete dialog shows the label name in the description', async () => {
      mockLabels.push(makeLabel({ id: 'lbl-1', name: 'Business' }))
      await renderPage()
      fireEvent.click(screen.getAllByRole('button')[1])
      // t() returns the key, interpolation params are separate — we just check the desc key is present
      expect(screen.getByText('settings.labelsDeleteDesc')).toBeInTheDocument()
    })

    it('cancel button closes the delete dialog', async () => {
      mockLabels.push(makeLabel({ id: 'lbl-1', name: 'Business' }))
      await renderPage()
      fireEvent.click(screen.getAllByRole('button')[1])
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      fireEvent.click(screen.getByText('common.cancel'))
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('confirm delete calls remove with the label id', async () => {
      mockLabels.push(makeLabel({ id: 'lbl-1', name: 'Business' }))
      await renderPage()
      fireEvent.click(screen.getAllByRole('button')[1])
      fireEvent.click(screen.getByText('settings.labelsDeleteAction'))
      await waitFor(() => {
        expect(mockRemove).toHaveBeenCalledWith('lbl-1')
      })
    })

    it('confirm delete also calls removeLabelFromTransactions', async () => {
      mockLabels.push(makeLabel({ id: 'lbl-1', name: 'Business' }))
      await renderPage()
      fireEvent.click(screen.getAllByRole('button')[1])
      fireEvent.click(screen.getByText('settings.labelsDeleteAction'))
      await waitFor(() => {
        expect(mockRemoveLabelFromTransactions).toHaveBeenCalledWith('lbl-1')
      })
    })

    it('delete dialog closes after successful deletion', async () => {
      mockLabels.push(makeLabel({ id: 'lbl-1', name: 'Business' }))
      await renderPage()
      fireEvent.click(screen.getAllByRole('button')[1])
      fireEvent.click(screen.getByText('settings.labelsDeleteAction'))
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull()
      })
    })
  })

  describe('orphan label trash — orphan cleanup dialog', () => {
    it('trash on an orphan label opens the orphan cleanup dialog', async () => {
      mockTransactions.push(makeTx({ labels: ['orphan-id'] }))
      await renderPage()
      expect(screen.queryByRole('dialog')).toBeNull()
      // Button order: [edit(0), trash(1), fab(2)]
      fireEvent.click(screen.getAllByRole('button')[1])
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('orphan cleanup dialog shows the cleanup title', async () => {
      mockTransactions.push(makeTx({ labels: ['orphan-id'] }))
      await renderPage()
      fireEvent.click(screen.getAllByRole('button')[1])
      expect(screen.getByText('settings.labelsOrphanCleanupTitle')).toBeInTheDocument()
    })

    it('cancel closes the orphan cleanup dialog', async () => {
      mockTransactions.push(makeTx({ labels: ['orphan-id'] }))
      await renderPage()
      fireEvent.click(screen.getAllByRole('button')[1])
      fireEvent.click(screen.getByText('common.cancel'))
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('confirm orphan cleanup calls removeLabelFromTransactions', async () => {
      mockTransactions.push(makeTx({ labels: ['orphan-id'] }))
      await renderPage()
      fireEvent.click(screen.getAllByRole('button')[1])
      fireEvent.click(screen.getByText('settings.labelsOrphanCleanupAction'))
      await waitFor(() => {
        expect(mockRemoveLabelFromTransactions).toHaveBeenCalledWith('orphan-id')
      })
    })

    it('confirm orphan cleanup does not call remove', async () => {
      mockTransactions.push(makeTx({ labels: ['orphan-id'] }))
      await renderPage()
      fireEvent.click(screen.getAllByRole('button')[1])
      fireEvent.click(screen.getByText('settings.labelsOrphanCleanupAction'))
      await waitFor(() => {
        expect(mockRemoveLabelFromTransactions).toHaveBeenCalled()
      })
      expect(mockRemove).not.toHaveBeenCalled()
    })
  })

  describe('label form dialog', () => {
    it('save button calls add with the entered name', async () => {
      await renderPage()
      fireEvent.click(screen.getByRole('button', { name: 'common.add' }))
      fireEvent.change(screen.getByPlaceholderText('settings.labelsNamePlaceholder'), {
        target: { value: 'New Tag' },
      })
      fireEvent.click(screen.getByText('common.save'))
      await waitFor(() => {
        expect(mockAdd).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'test-uuid', name: 'New Tag' }),
        )
      })
    })

    it('save button calls update when editing an existing label', async () => {
      mockLabels.push(makeLabel({ id: 'lbl-1', name: 'Business' }))
      await renderPage()
      // open edit dialog (edit button = [0])
      fireEvent.click(screen.getAllByRole('button')[0])
      const nameInput = screen.getByPlaceholderText('settings.labelsNamePlaceholder')
      fireEvent.change(nameInput, { target: { value: 'Business Updated' } })
      fireEvent.click(screen.getByText('common.save'))
      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'lbl-1', name: 'Business Updated' }),
        )
        expect(mockAdd).not.toHaveBeenCalled()
      })
    })

    it('does not call add when name is empty and form is submitted', async () => {
      await renderPage()
      fireEvent.click(screen.getByRole('button', { name: 'common.add' }))
      fireEvent.click(screen.getByText('common.save'))
      await waitFor(() => {
        expect(mockAdd).not.toHaveBeenCalled()
      })
    })

    it('cancel button in the dialog closes it', async () => {
      await renderPage()
      fireEvent.click(screen.getByRole('button', { name: 'common.add' }))
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      fireEvent.click(screen.getByText('common.cancel'))
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })
})
