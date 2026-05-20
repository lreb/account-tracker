import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Category } from '@/types'
import CategoriesSettingsPage from './CategoriesSettingsPage'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockCategories: Category[] = []
const mockRemove = vi.fn()
const mockRestore = vi.fn()

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('@/stores/categories.store', () => ({
  useCategoriesStore: () => ({
    categories: mockCategories,
    remove: mockRemove,
    restore: mockRestore,
  }),
}))

vi.mock('@/components/ui/scroll-to-top-button', () => ({
  ScrollToTopButton: () => null,
}))

// Stub CategoryDialog — reports open state via a dialog role element
vi.mock('./CategoryDialog', () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div role="dialog">
        <button type="button" onClick={onClose}>dialog-close</button>
      </div>
    ) : null,
}))

// Stub CategorySection — renders edit/remove/restore buttons keyed by category id
vi.mock('./CategorySection', () => ({
  default: ({
    type,
    items,
    onEdit,
    onRemove,
    onRestore,
  }: {
    type: string
    items: Category[]
    onEdit: (c: Category) => void
    onRemove: (id: string) => void
    onRestore: (id: string) => void
    t: (k: string) => string
  }) => (
    <div data-testid={`section-${type}`}>
      {items.map((cat) => (
        <div key={cat.id}>
          <button type="button" onClick={() => onEdit(cat)}>edit-{cat.id}</button>
          <button type="button" onClick={() => onRemove(cat.id)}>remove-{cat.id}</button>
          <button type="button" onClick={() => onRestore(cat.id)}>restore-{cat.id}</button>
        </div>
      ))}
    </div>
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

function renderPage() {
  return render(<CategoriesSettingsPage />)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CategoriesSettingsPage', () => {
  beforeEach(() => {
    mockCategories.length = 0
    vi.clearAllMocks()
  })

  describe('page header', () => {
    it('renders the page title', () => {
      renderPage()
      expect(screen.getByText('settings.categories')).toBeInTheDocument()
    })

    it('renders the floating add button', () => {
      renderPage()
      expect(screen.getByRole('button', { name: 'common.add' })).toBeInTheDocument()
    })
  })

  describe('category sections', () => {
    it('renders a section for each category type', () => {
      renderPage()
      expect(screen.getByTestId('section-expense')).toBeInTheDocument()
      expect(screen.getByTestId('section-income')).toBeInTheDocument()
      expect(screen.getByTestId('section-any')).toBeInTheDocument()
    })

    it('routes expense categories to the expense section', () => {
      mockCategories.push(makeCategory({ id: 'e1', type: 'expense' }))
      renderPage()
      expect(screen.getByText('edit-e1')).toBeInTheDocument()
    })

    it('routes income categories to the income section', () => {
      mockCategories.push(makeCategory({ id: 'i1', type: 'income' }))
      renderPage()
      expect(screen.getByText('edit-i1')).toBeInTheDocument()
    })

    it('routes any-type categories to the any section', () => {
      mockCategories.push(makeCategory({ id: 'a1', type: 'any' }))
      renderPage()
      expect(screen.getByText('edit-a1')).toBeInTheDocument()
    })
  })

  describe('add dialog', () => {
    it('dialog is closed on initial render', () => {
      renderPage()
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('FAB button opens the add dialog', () => {
      renderPage()
      fireEvent.click(screen.getByRole('button', { name: 'common.add' }))
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('closing the dialog dismisses it', () => {
      renderPage()
      fireEvent.click(screen.getByRole('button', { name: 'common.add' }))
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      fireEvent.click(screen.getByText('dialog-close'))
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  describe('edit dialog', () => {
    it('clicking the edit button on a category opens the dialog', () => {
      mockCategories.push(makeCategory({ id: 'cat-5', type: 'expense' }))
      renderPage()
      expect(screen.queryByRole('dialog')).toBeNull()
      fireEvent.click(screen.getByText('edit-cat-5'))
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('closing the edit dialog dismisses it', () => {
      mockCategories.push(makeCategory({ id: 'cat-5', type: 'expense' }))
      renderPage()
      fireEvent.click(screen.getByText('edit-cat-5'))
      fireEvent.click(screen.getByText('dialog-close'))
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  describe('store callbacks', () => {
    it('onRemove from a section calls store remove with the category id', () => {
      mockCategories.push(makeCategory({ id: 'cat-10', type: 'expense' }))
      renderPage()
      fireEvent.click(screen.getByText('remove-cat-10'))
      expect(mockRemove).toHaveBeenCalledWith('cat-10')
    })

    it('onRestore from a section calls store restore with the category id', () => {
      mockCategories.push(makeCategory({ id: 'cat-11', type: 'income' }))
      renderPage()
      fireEvent.click(screen.getByText('restore-cat-11'))
      expect(mockRestore).toHaveBeenCalledWith('cat-11')
    })
  })
})
