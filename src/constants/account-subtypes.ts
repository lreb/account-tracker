import type { AccountType } from '@/types'

export type AccountSubtypeOption = {
  value: string
  labelKey: string
}

export const ACCOUNT_SUBTYPE_OPTIONS_BY_TYPE: Record<AccountType, AccountSubtypeOption[]> = {
  asset: [
    { value: 'checking-debit', labelKey: 'accounts.subtypes.checkingDebit' },
    { value: 'savings', labelKey: 'accounts.subtypes.savings' },
    { value: 'investment', labelKey: 'accounts.subtypes.investment' },
    { value: 'cash', labelKey: 'accounts.subtypes.cash' },
    { value: 'real-estate', labelKey: 'accounts.subtypes.realEstate' },
    { value: 'vehicle', labelKey: 'accounts.subtypes.vehicle' },
    { value: 'business-asset', labelKey: 'accounts.subtypes.businessAsset' },
    { value: 'other-asset', labelKey: 'accounts.subtypes.otherAsset' },
  ],
  liability: [
    { value: 'credit-card', labelKey: 'accounts.subtypes.creditCard' },
    { value: 'mortgage-home-loan', labelKey: 'accounts.subtypes.mortgageHomeLoan' },
    { value: 'auto-loan', labelKey: 'accounts.subtypes.autoLoan' },
    { value: 'personal-loan', labelKey: 'accounts.subtypes.personalLoan' },
    { value: 'tax-debt', labelKey: 'accounts.subtypes.taxDebt' },
    { value: 'business-loan', labelKey: 'accounts.subtypes.businessLoan' },
    { value: 'accounts-payable', labelKey: 'accounts.subtypes.accountsPayable' },
    { value: 'other-liability', labelKey: 'accounts.subtypes.otherLiability' },
  ],
}

export function getOtherSubtypeLabelKey(type: AccountType): string {
  return type === 'asset' ? 'accounts.subtypes.otherAsset' : 'accounts.subtypes.otherLiability'
}

export function getOtherSubtypeValue(type: AccountType): string {
  return type === 'asset' ? 'other-asset' : 'other-liability'
}
