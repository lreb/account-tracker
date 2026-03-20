import type { Account, Transaction } from '@/types'

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