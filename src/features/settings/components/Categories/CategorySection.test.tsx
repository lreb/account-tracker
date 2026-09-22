import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Category } from '@/types'
import CategorySection from './CategorySection'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/categories', () => ({
  getTranslatedCategoryName: (cat: Category) => cat.name,
  sortCategories: (items: Category[]) => [...items],
}))

vi.mock('@/lib/icon-map', () => ({
  CategoryIcon: () => null,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    title,
    variant,
  }: {
    children: React.ReactNode
    onClick?: () => void
    title?: string
    variant?: string
  }) => (
    <button type="button" onClick={onClick} title={title} data-variant={variant}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) => (
    <div data-open={open}>{children}</div>
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockT = (k: string) => k

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

describe('CategorySection', () => {
  const onEdit = vi.fn()
  const onRemove = vi.fn()
  const onRestore = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when there are no active or archived items', () => {
    const { container } = render(
      <CategorySection
        type="expense"
        items={[]}
        onEdit={onEdit}
        onRemove={onRemove}
        onRestore={onRestore}
        t={mockT}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders the section type heading', () => {
    render(
      <CategorySection
        type="expense"
        items={[makeCategory()]}
        onEdit={onEdit}
        onRemove={onRemove}
        onRestore={onRestore}
        t={mockT}
      />,
    )
    expect(screen.getByText('categories.types.expense')).toBeInTheDocument()
  })

  it('renders the income section heading for income type', () => {
    render(
      <CategorySection
        type="income"
        items={[makeCategory({ type: 'income' })]}
        onEdit={onEdit}
        onRemove={onRemove}
        onRestore={onRestore}
        t={mockT}
      />,
    )
    expect(screen.getByText('categories.types.income')).toBeInTheDocument()
  })

  it('renders the active category name', () => {
    render(
      <CategorySection
        type="expense"
        items={[makeCategory({ name: 'Groceries' })]}
        onEdit={onEdit}
        onRemove={onRemove}
        onRestore={onRestore}
        t={mockT}
      />,
    )
    expect(screen.getByText('Groceries')).toBeInTheDocument()
  })

  it('shows the active count in the badge', () => {
    render(
      <CategorySection
        type="expense"
        items={[makeCategory(), makeCategory({ id: 'cat2', name: 'Transport' })]}
        onEdit={onEdit}
        onRemove={onRemove}
        onRestore={onRestore}
        t={mockT}
      />,
    )
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('archive button opens confirmation dialog', () => {
    render(
      <CategorySection
        type="expense"
        items={[makeCategory({ id: 'cat-99' })]}
        onEdit={onEdit}
        onRemove={onRemove}
        onRestore={onRestore}
        t={mockT}
      />,
    )
    const buttons = screen.getAllByRole('button')
    // button[0] = edit, button[1] = archive
    fireEvent.click(buttons[1])
    expect(screen.getByText('categories.archiveConfirmTitle')).toBeInTheDocument()
    expect(onRemove).not.toHaveBeenCalled()
  })

  it('confirming archive calls onRemove with the category id', () => {
    render(
      <CategorySection
        type="expense"
        items={[makeCategory({ id: 'cat-99' })]}
        onEdit={onEdit}
        onRemove={onRemove}
        onRestore={onRestore}
        t={mockT}
      />,
    )
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[1])
    const confirmButtons = screen.getAllByRole('button')
    const archiveBtn = confirmButtons.find(
      (b) => b.textContent === 'categories.archive',
    )
    fireEvent.click(archiveBtn!)
    expect(onRemove).toHaveBeenCalledWith('cat-99')
  })

  it('canceling archive does not call onRemove', () => {
    render(
      <CategorySection
        type="expense"
        items={[makeCategory({ id: 'cat-99' })]}
        onEdit={onEdit}
        onRemove={onRemove}
        onRestore={onRestore}
        t={mockT}
      />,
    )
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[1])
    const allButtons = screen.getAllByRole('button')
    const cancelBtn = allButtons.find(
      (b) => b.textContent === 'common.cancel',
    )
    fireEvent.click(cancelBtn!)
    expect(onRemove).not.toHaveBeenCalled()
  })

  it('edit button calls onEdit with the full category object', () => {
    const cat = makeCategory({ id: 'cat-1', name: 'Food' })
    render(
      <CategorySection
        type="expense"
        items={[cat]}
        onEdit={onEdit}
        onRemove={onRemove}
        onRestore={onRestore}
        t={mockT}
      />,
    )
    // button[0] = edit (Pencil), button[1] = archive (Archive)
    fireEvent.click(screen.getAllByRole('button')[0])
    expect(onEdit).toHaveBeenCalledWith(cat)
  })

  it('remove button calls onRemove with the category id', () => {
    render(
      <CategorySection
        type="expense"
        items={[makeCategory({ id: 'cat-99' })]}
        onEdit={onEdit}
        onRemove={onRemove}
        onRestore={onRestore}
        t={mockT}
      />,
    )
    // Per item: button[0] = edit, button[1] = archive (opens dialog)
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[1])
    // Confirm the dialog
    const confirmButtons = screen.getAllByRole('button')
    const archiveBtn = confirmButtons.find(
      (b) => b.textContent === 'categories.archive',
    )
    fireEvent.click(archiveBtn!)
    expect(onRemove).toHaveBeenCalledWith('cat-99')
  })

  describe('archived items', () => {
    it('does not render the archived section when no archived items exist', () => {
      render(
        <CategorySection
          type="expense"
          items={[makeCategory()]}
          onEdit={onEdit}
          onRemove={onRemove}
          onRestore={onRestore}
          t={mockT}
        />,
      )
      expect(screen.queryByText(/categories\.archived/)).toBeNull()
    })

    it('renders the archived section heading when archived items exist', () => {
      render(
        <CategorySection
          type="expense"
          items={[makeCategory({ deletedAt: '2026-01-01' })]}
          onEdit={onEdit}
          onRemove={onRemove}
          onRestore={onRestore}
          t={mockT}
        />,
      )
      expect(screen.getByText(/categories\.archived/)).toBeInTheDocument()
    })

    it('renders the archived category name', () => {
      render(
        <CategorySection
          type="expense"
          items={[makeCategory({ name: 'OldExpense', deletedAt: '2026-01-01' })]}
          onEdit={onEdit}
          onRemove={onRemove}
          onRestore={onRestore}
          t={mockT}
        />,
      )
      expect(screen.getByText('OldExpense')).toBeInTheDocument()
    })

    it('restore button calls onRestore with the category id', () => {
      render(
        <CategorySection
          type="expense"
          items={[makeCategory({ id: 'archived-1', deletedAt: '2026-01-01' })]}
          onEdit={onEdit}
          onRemove={onRemove}
          onRestore={onRestore}
          t={mockT}
        />,
      )
      fireEvent.click(screen.getByTitle('categories.restore'))
      expect(onRestore).toHaveBeenCalledWith('archived-1')
    })

    it('badge count reflects only active items, not archived', () => {
      render(
        <CategorySection
          type="expense"
          items={[
            makeCategory({ id: 'active-1' }),
            makeCategory({ id: 'archived-1', deletedAt: '2026-01-01' }),
          ]}
          onEdit={onEdit}
          onRemove={onRemove}
          onRestore={onRestore}
          t={mockT}
        />,
      )
      // Badge shows active count (1), not total (2)
      expect(screen.getByText('1')).toBeInTheDocument()
    })
  })
})
