import { describe, expect, it } from 'vitest'

import { getTranslatedCategoryName } from '@/lib/categories'

describe('getTranslatedCategoryName', () => {
  it('returns custom category name as-is', () => {
    const t = (key: string) => key

    const result = getTranslatedCategoryName(
      { id: 'custom-1', name: 'My Personal Category', isCustom: true },
      t,
    )

    expect(result).toBe('My Personal Category')
  })

  it('returns translated default category name when not renamed', () => {
    const t = (key: string) => {
      if (key === 'categories.names.transportation') return 'Transporte'
      return key
    }

    const result = getTranslatedCategoryName(
      { id: 'transportation', name: 'Transportation', isCustom: false },
      t,
    )

    expect(result).toBe('Transporte')
  })

  it('returns stored name for renamed default categories', () => {
    const t = (key: string) => {
      if (key === 'categories.names.transportation') return 'Transporte'
      return key
    }

    const result = getTranslatedCategoryName(
      { id: 'transportation', name: 'Commute', isCustom: false },
      t,
    )

    expect(result).toBe('Commute')
  })

  it('falls back to stored name when translation key is missing', () => {
    const t = (key: string) => key

    const result = getTranslatedCategoryName(
      { id: 'unknown-default', name: 'Fallback Name', isCustom: false },
      t,
    )

    expect(result).toBe('Fallback Name')
  })
})
