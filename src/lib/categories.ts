import type { Category } from '@/types'

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'transportation',       name: 'Transportation',        icon: 'Car',             isCustom: false, type: 'expense' },
  { id: 'food-groceries',       name: 'Food & Groceries',      icon: 'ShoppingCart',    isCustom: false, type: 'expense' },
  { id: 'health',               name: 'Health',                icon: 'Heart',           isCustom: false, type: 'expense' },
  { id: 'housing',              name: 'Housing',               icon: 'Home',            isCustom: false, type: 'expense' },
  { id: 'fuel-gas',             name: 'Fuel / Gas',            icon: 'Fuel',            isCustom: false, type: 'expense' },
  { id: 'restaurants',          name: 'Restaurants',           icon: 'UtensilsCrossed', isCustom: false, type: 'expense' },
  { id: 'medical-pharmacy',     name: 'Medical / Pharmacy',    icon: 'Pill',            isCustom: false, type: 'expense' },
  { id: 'rent-mortgage',        name: 'Rent / Mortgage',       icon: 'Building',        isCustom: false, type: 'expense' },
  { id: 'vehicle-maintenance',  name: 'Vehicle Maintenance',   icon: 'Wrench',          isCustom: false, type: 'expense' },
  { id: 'supermarket',          name: 'Supermarket',           icon: 'Store',           isCustom: false, type: 'expense' },
  { id: 'health-insurance',     name: 'Health Insurance',      icon: 'Shield',          isCustom: false, type: 'expense' },
  { id: 'utilities',            name: 'Utilities',             icon: 'Zap',             isCustom: false, type: 'expense' },
  { id: 'entertainment',        name: 'Entertainment',         icon: 'Tv',              isCustom: false, type: 'expense' },
  { id: 'education',            name: 'Education',             icon: 'GraduationCap',   isCustom: false, type: 'expense' },
  { id: 'investments-savings',  name: 'Investments / Savings', icon: 'TrendingUp',      isCustom: false, type: 'any' },
  { id: 'salary',               name: 'Salary',                icon: 'Banknote',        isCustom: false, type: 'income' },
  { id: 'freelance',            name: 'Freelance',             icon: 'Laptop',          isCustom: false, type: 'income' },
  { id: 'interest',             name: 'Interest',              icon: 'Percent',         isCustom: false, type: 'income' },
  { id: 'rental-income',        name: 'Rental income',         icon: 'KeyRound',        isCustom: false, type: 'income' },
  { id: 'refund',               name: 'Refund',                icon: 'RotateCcw',       isCustom: false, type: 'income' },
  { id: 'other',                name: 'Other',                 icon: 'MoreHorizontal',  isCustom: false, type: 'any' },
]

const DEFAULT_CATEGORY_IDS = new Set(DEFAULT_CATEGORIES.map((category) => category.id))
const DEFAULT_CATEGORY_BY_ID = Object.fromEntries(
  DEFAULT_CATEGORIES.map((category) => [category.id, category]),
) as Record<string, Category>
const DEFAULT_CATEGORY_NAME_TO_ID = Object.fromEntries(
  DEFAULT_CATEGORIES.map((category) => [category.name, category.id]),
) as Record<string, string>

// Default categories are translated from locale resources by id.
// Custom categories keep the user-provided name.
export function getTranslatedCategoryName(
  category: Pick<Category, 'id' | 'name' | 'isCustom'> | undefined,
  t: (key: string) => string,
): string {
  if (!category) return ''
  if (category.isCustom) return category.name

  const defaultCategory = DEFAULT_CATEGORY_BY_ID[category.id]
  // If a built-in category was renamed by the user, prefer the stored name.
  if (defaultCategory && category.name !== defaultCategory.name) {
    return category.name
  }

  const keyById = `categories.names.${category.id}`
  const translatedById = t(keyById)
  if (translatedById !== keyById) return translatedById

  const mappedId = DEFAULT_CATEGORY_NAME_TO_ID[category.name]
  if (mappedId && DEFAULT_CATEGORY_IDS.has(mappedId)) {
    const keyByNameMap = `categories.names.${mappedId}`
    const translatedByName = t(keyByNameMap)
    if (translatedByName !== keyByNameMap) return translatedByName
  }

  return category.name
}
