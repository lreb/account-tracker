import {
  ACCOUNT_SUBTYPE_OPTIONS_BY_TYPE,
  getOtherSubtypeValue,
} from '@/constants/account-subtypes'
import type { Account, AccountType, Transaction } from '@/types'

// Canonical type display order
const TYPE_ORDER: AccountType[] = ['asset', 'liability']

function subtypeOrder(type: AccountType, subtype: string): number {
  const opts = ACCOUNT_SUBTYPE_OPTIONS_BY_TYPE[type] ?? []
  const idx = opts.findIndex((o) => o.value === subtype)
  return idx === -1 ? opts.length : idx
}

/**
 * Sort accounts by: type → subtype position → name (ascending).
 * Returns a new array; does not mutate the input.
 */
export function sortAccounts<T extends Pick<Account, 'type' | 'subtype' | 'name'>>(accounts: T[]): T[] {
  return [...accounts].sort((a, b) => {
    const tA = TYPE_ORDER.indexOf(a.type)
    const tB = TYPE_ORDER.indexOf(b.type)
    if (tA !== tB) return tA - tB

    const effSubA = a.subtype || getOtherSubtypeValue(a.type)
    const effSubB = b.subtype || getOtherSubtypeValue(b.type)
    const oA = subtypeOrder(a.type, effSubA)
    const oB = subtypeOrder(b.type, effSubB)
    if (oA !== oB) return oA - oB

    return a.name.localeCompare(b.name)
  })
}

export const DEFAULT_ACCOUNT_ID = 'default-account'

export function createDefaultAccount(currency = 'USD'): Account {
  return {
    id: DEFAULT_ACCOUNT_ID,
    name: 'Main Account',
    type: 'asset',
    subtype: '',
    openingBalance: 0,
    currency,
    hidden: false,
  }
}

export function normalizeAccount(account: Account): Account {
  return {
    ...account,
    hidden: account.hidden ?? false,
    subtype: account.subtype ?? '',
  }
}

export function isAccountHidden(account?: Pick<Account, 'hidden'> | null): boolean {
  return account?.hidden === true
}

export function getVisibleAccounts<T extends Pick<Account, 'hidden'>>(accounts: T[]): T[] {
  return accounts.filter((account) => !isAccountHidden(account))
}

export function getVisibleAccountIds(accounts: Array<Pick<Account, 'id' | 'hidden'>>): Set<string> {
  return new Set(getVisibleAccounts(accounts).map((account) => account.id))
}

export function isAccountCancelled(account?: Pick<Account, 'cancelled'> | null): boolean {
  return account?.cancelled === true
}

export function getActiveAccounts<T extends Pick<Account, 'hidden' | 'cancelled'>>(accounts: T[]): T[] {
  return accounts.filter((account) => !isAccountHidden(account) && !isAccountCancelled(account))
}

export function getActiveAccountIds(accounts: Array<Pick<Account, 'id' | 'hidden' | 'cancelled'>>): Set<string> {
  return new Set(getActiveAccounts(accounts).map((account) => account.id))
}

export function getAccountSelectOptions<T extends Pick<Account, 'id' | 'hidden'>>(
  accounts: T[],
  includeIds: string[] = [],
): T[] {
  const includeSet = new Set(includeIds.filter(Boolean))
  return accounts.filter((account) => !isAccountHidden(account) || includeSet.has(account.id))
}

export function isTransactionForVisiblePrimaryAccount(
  transaction: Transaction,
  visibleAccountIds: Set<string>,
): boolean {
  return visibleAccountIds.has(transaction.accountId)
}

export function isTransactionForVisibleAccount(
  transaction: Transaction,
  visibleAccountIds: Set<string>,
): boolean {
  return visibleAccountIds.has(transaction.accountId)
    || (transaction.toAccountId ? visibleAccountIds.has(transaction.toAccountId) : false)
}