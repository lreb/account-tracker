import type { Account, Transaction } from '@/types'

export function normalizeAccount(account: Account): Account {
  return {
    ...account,
    hidden: account.hidden ?? false,
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