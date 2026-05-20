import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('./RecurringTransactionForm', () => ({
  default: () => <div data-testid="recurring-form" />,
}))

import RecurringTransactionFormPage from './RecurringTransactionFormPage'

describe('RecurringTransactionFormPage', () => {
  it('renders without crashing', () => {
    const { container } = render(<RecurringTransactionFormPage />)
    expect(container.firstChild).not.toBeNull()
  })

  it('renders the RecurringTransactionForm component', () => {
    render(<RecurringTransactionFormPage />)
    expect(screen.getByTestId('recurring-form')).toBeInTheDocument()
  })
})
