/**
 * i18n keys used as Zod validation messages.
 * Schemas import from here; components translate with t(message).
 */
export const vm = {
  nameRequired:        'validation.nameRequired',
  currencyRequired:    'validation.currencyRequired',
  dateRequired:        'validation.dateRequired',
  accountRequired:     'validation.accountRequired',
  toAccountRequired:   'validation.toAccountRequired',
  categoryRequired:    'validation.categoryRequired',
  descriptionRequired: 'validation.descriptionRequired',
  serviceTypeRequired: 'validation.serviceTypeRequired',
  startDateRequired:   'validation.startDateRequired',
  iconRequired:        'validation.iconRequired',
  amountRequired:      'validation.amountRequired',
  mustBeNumber:        'validation.mustBeNumber',
  mustBePositive:      'validation.mustBePositive',
  mustBeNonNegative:   'validation.mustBeNonNegative',
  invalidAmount:       'validation.invalidAmount',
  invalidLiters:       'validation.invalidLiters',
  integerKmOnly:       'validation.integerKmOnly',
  max30chars:          'validation.max30chars',
  amountPositive:      'validation.amountPositive',
} as const
