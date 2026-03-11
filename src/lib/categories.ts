import type { Category } from '@/types'

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'transportation',       name: 'Transportation',        icon: 'Car',          isCustom: false },
  { id: 'food-groceries',       name: 'Food & Groceries',      icon: 'ShoppingCart', isCustom: false },
  { id: 'health',               name: 'Health',                icon: 'Heart',        isCustom: false },
  { id: 'housing',              name: 'Housing',               icon: 'Home',         isCustom: false },
  { id: 'fuel-gas',             name: 'Fuel / Gas',            icon: 'Fuel',         isCustom: false },
  { id: 'restaurants',          name: 'Restaurants',           icon: 'UtensilsCrossed', isCustom: false },
  { id: 'medical-pharmacy',     name: 'Medical / Pharmacy',    icon: 'Pill',         isCustom: false },
  { id: 'rent-mortgage',        name: 'Rent / Mortgage',       icon: 'Building',     isCustom: false },
  { id: 'vehicle-maintenance',  name: 'Vehicle Maintenance',   icon: 'Wrench',       isCustom: false },
  { id: 'supermarket',          name: 'Supermarket',           icon: 'Store',        isCustom: false },
  { id: 'health-insurance',     name: 'Health Insurance',      icon: 'Shield',       isCustom: false },
  { id: 'utilities',            name: 'Utilities',             icon: 'Zap',          isCustom: false },
  { id: 'entertainment',        name: 'Entertainment',         icon: 'Tv',           isCustom: false },
  { id: 'education',            name: 'Education',             icon: 'GraduationCap',isCustom: false },
  { id: 'investments-savings',  name: 'Investments / Savings', icon: 'TrendingUp',   isCustom: false },
  { id: 'other',                name: 'Other',                 icon: 'MoreHorizontal',isCustom: false },
]
