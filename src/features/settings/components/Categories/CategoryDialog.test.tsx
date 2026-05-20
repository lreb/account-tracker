import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { Category } from '@/types'
import CategoryDialog from './CategoryDialog'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockAdd = vi.fn()
const mockUpdate = vi.fn()
const mockOnClose = vi.fn()

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('@/stores/categories.store', () => ({
  useCategoriesStore: () => ({
    add: mockAdd,
    update: mockUpdate,
  }),
}))

// Small ICON_MAP to avoid rendering hundreds of icon buttons
vi.mock('@/lib/icon-map.constants', () => ({
  ICON_MAP: { MoreHorizontal: null, Utensils: null },
}))

vi.mock('@/lib/icon-map', () => ({
  CategoryIcon: () => null,
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

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
  Input: React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    (props, ref) => <input {...props} ref={ref} />,
  ),
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-value={value}>{children}</div>
  ),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat1',
    name: 'Food',
    icon: 'Utensils',
    isCustom: true,
    type: 'expense',
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CategoryDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not render when open is false', () => {
    render(<CategoryDialog open={false} onClose={mockOnClose} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders the dialog when open is true', () => {
    render(<CategoryDialog open={true} onClose={mockOnClose} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  describe('add mode (no editing prop)', () => {
    it('renders the new category title', () => {
      render(<CategoryDialog open={true} onClose={mockOnClose} />)
      expect(screen.getByText('categories.newCategory')).toBeInTheDocument()
    })

    it('renders the name input with placeholder', () => {
      render(<CategoryDialog open={true} onClose={mockOnClose} />)
      expect(screen.getByPlaceholderText('categories.namePlaceholder')).toBeInTheDocument()
    })

    it('name input starts empty', () => {
      render(<CategoryDialog open={true} onClose={mockOnClose} />)
      expect(screen.getByPlaceholderText('categories.namePlaceholder')).toHaveValue('')
    })

    it('cancel button calls onClose', () => {
      render(<CategoryDialog open={true} onClose={mockOnClose} />)
      fireEvent.click(screen.getByText('common.cancel'))
      expect(mockOnClose).toHaveBeenCalled()
    })

    it('submits the form and calls add with the entered name', async () => {
      render(<CategoryDialog open={true} onClose={mockOnClose} />)
      fireEvent.change(screen.getByPlaceholderText('categories.namePlaceholder'), {
        target: { value: 'Transport' },
      })
      fireEvent.click(screen.getByText('common.save'))
      await waitFor(() => {
        expect(mockAdd).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Transport',
            isCustom: true,
            type: 'expense',
          }),
        )
      })
    })

    it('calls onClose after successful submit', async () => {
      render(<CategoryDialog open={true} onClose={mockOnClose} />)
      fireEvent.change(screen.getByPlaceholderText('categories.namePlaceholder'), {
        target: { value: 'Transport' },
      })
      fireEvent.click(screen.getByText('common.save'))
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled()
      })
    })

    it('does not call add when name is empty', async () => {
      render(<CategoryDialog open={true} onClose={mockOnClose} />)
      // name input is empty — validation should fail
      fireEvent.click(screen.getByText('common.save'))
      await waitFor(() => {
        expect(mockAdd).not.toHaveBeenCalled()
      })
    })
  })

  describe('edit mode (editing prop provided)', () => {
    it('renders the edit category title', () => {
      render(<CategoryDialog open={true} onClose={mockOnClose} editing={makeCategory()} />)
      expect(screen.getByText('categories.editCategory')).toBeInTheDocument()
    })

    it('pre-fills the name input with the existing category name', () => {
      render(
        <CategoryDialog open={true} onClose={mockOnClose} editing={makeCategory({ name: 'Food' })} />,
      )
      expect(screen.getByPlaceholderText('categories.namePlaceholder')).toHaveValue('Food')
    })

    it('submits the form and calls update with the new name', async () => {
      const existing = makeCategory({ id: 'cat-1', name: 'Food' })
      render(<CategoryDialog open={true} onClose={mockOnClose} editing={existing} />)
      const input = screen.getByPlaceholderText('categories.namePlaceholder')
      fireEvent.change(input, { target: { value: 'Groceries' } })
      fireEvent.click(screen.getByText('common.save'))
      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'cat-1', name: 'Groceries' }),
        )
      })
    })

    it('does not call add when in edit mode', async () => {
      const existing = makeCategory({ name: 'Food' })
      render(<CategoryDialog open={true} onClose={mockOnClose} editing={existing} />)
      fireEvent.change(screen.getByPlaceholderText('categories.namePlaceholder'), {
        target: { value: 'Groceries' },
      })
      fireEvent.click(screen.getByText('common.save'))
      await waitFor(() => {
        expect(mockAdd).not.toHaveBeenCalled()
      })
    })
  })

  describe('icon picker', () => {
    it('renders a button for each icon in ICON_MAP', () => {
      render(<CategoryDialog open={true} onClose={mockOnClose} />)
      // ICON_MAP mock has 2 keys: MoreHorizontal, Utensils
      expect(screen.getByTitle('MoreHorizontal')).toBeInTheDocument()
      expect(screen.getByTitle('Utensils')).toBeInTheDocument()
    })
  })
})
