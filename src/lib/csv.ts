/**
 * Client-side CSV export and import for transactions.
 *
 * Supports:
 * - native app export/import format
 * - Bluecoins-style transaction export
 */

import type { Account, Category, Label, Transaction, TransactionStatus, TransactionType } from '@/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Escape a single CSV cell value. */
function cell(v: string | number | undefined | null): string {
  if (v === undefined || v === null) return ''
  const s = String(v)
  // Must quote if the value contains comma, double-quote, or newline
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/** Parse a raw CSV cell (strips surrounding quotes, unescapes ""). */
function unquote(s: string): string {
  const trimmed = s.trim()
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/""/g, '"')
  }
  return trimmed
}

function normalizeHeader(value: string): string {
  return unquote(value)
    .replace(/^\uFEFF/, '')
    .replace(/^ï»¿/, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase()
}

function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentCell = ''
  let inQuotes = false

  const text = csvText.replace(/^\uFEFF/, '')

  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    const next = text[index + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentCell += '"'
        index++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentCell)
      currentCell = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        index++
      }
      currentRow.push(currentCell)
      rows.push(currentRow)
      currentRow = []
      currentCell = ''
      continue
    }

    currentCell += char
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell)
    rows.push(currentRow)
  }

  return rows
    .map((row) => row.map(unquote))
    .filter((row) => row.some((cellValue) => cellValue.trim() !== ''))
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item'
}

function hashString(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16)
}

function makeStableId(prefix: string, seed: string): string {
  return `${prefix}-${hashString(seed)}`
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function parseDateToIso(value: string): string | null {
  const trimmed = normalizeWhitespace(value)
  if (!trimmed) return null

  const candidate = trimmed.includes('T')
    ? trimmed
    : trimmed.replace(' ', 'T')

  const parsed = new Date(candidate)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toISOString()
}

function inferAccountType(name: string): Account['type'] {
  const lower = name.toLowerCase()
  if (/\|\s*\d{4}/.test(name)) return 'liability'
  if (/(credit|card|visa|mastercard|amex)/.test(lower)) return 'liability'
  if (/(hsbc zero|hsbc viva|like u|aero)/.test(lower)) return 'liability'
  return 'asset'
}

function parseBluecoinsLabels(raw: string): string[] {
  return raw
    .split(/\s{2,}|[|,;]+/)
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean)
}

function mapStatus(raw: string): TransactionStatus {
  switch (normalizeWhitespace(raw).toLowerCase()) {
    case 'reconciled':
      return 'reconciled'
    case 'cleared':
      return 'cleared'
    case 'pending':
      return 'pending'
    case 'void':
      return 'cancelled'
    case 'cancelled':
      return 'cancelled'
    case 'none':
    case '':
    default:
      return 'cleared'
  }
}

function guessCategoryType(transactionType: TransactionType): Category['type'] {
  if (transactionType === 'income') return 'income'
  if (transactionType === 'expense') return 'expense'
  return 'any'
}

// ─── Export ───────────────────────────────────────────────────────────────────

const HEADERS = [
  'id', 'type', 'date', 'description', 'amount_decimal', 'currency',
  'exchangeRate', 'categoryId', 'account', 'toAccount', 'status',
  'notes', 'labels', 'originalAmount_decimal', 'originalCurrency', 'transferId',
]

/** Convert a cents integer to a decimal string, e.g. 1250 → "12.50" */
function centsToDecimal(cents: number | undefined): string {
  if (cents === undefined || cents === null) return ''
  return (cents / 100).toFixed(2)
}

/**
 * Serialise `transactions` to a CSV string and trigger a browser download.
 *
 * Account IDs are replaced with account names; label IDs are replaced with
 * label names so the file is human-readable. The importer resolves them back
 * to IDs, falling back to the raw value for backward-compat with old CSVs.
 *
 * Returns the CSV string (useful for testing).
 */
export function exportTransactionsCsv(
  transactions: Transaction[],
  accounts: Account[],
  labels: Label[],
  filename = 'transactions.csv',
): string {
  const accountById = new Map(accounts.map((a) => [a.id, a.name]))
  const labelById   = new Map(labels.map((l) => [l.id, l.name]))

  const rows: string[] = [HEADERS.join(',')]

  for (const t of transactions) {
    const accountName   = accountById.get(t.accountId)   ?? t.accountId
    const toAccountName = t.toAccountId ? (accountById.get(t.toAccountId) ?? t.toAccountId) : ''
    const labelNames    = t.labels?.map((lid) => labelById.get(lid) ?? lid).join('|') ?? ''

    rows.push(
      [
        cell(t.id),
        cell(t.type),
        cell(t.date),
        cell(t.description),
        cell(centsToDecimal(t.amount)),
        cell(t.currency),
        cell(t.exchangeRate),
        cell(t.categoryId),
        cell(accountName),
        cell(toAccountName),
        cell(t.status),
        cell(t.notes),
        cell(labelNames),
        cell(centsToDecimal(t.originalAmount)),
        cell(t.originalCurrency),
        cell(t.transferId),
      ].join(','),
    )
  }

  const csv = rows.join('\r\n')
  downloadText(csv, filename, 'text/csv;charset=utf-8;')
  return csv
}

function downloadText(content: string, filename: string, mimeType: string) {
  const blob = new Blob(['\uFEFF' + content], { type: mimeType }) // BOM for Excel UTF-8
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Import ───────────────────────────────────────────────────────────────────

export interface CsvImportResult {
  imported: Transaction[]
  skipped: number     // rows that failed basic validation
  errors: string[]    // human-readable descriptions of skipped rows
  accountsToCreate: Account[]
  categoriesToCreate: Category[]
  labelsToCreate: Label[]
  detectedFormat: 'native' | 'bluecoins' | 'unknown'
}

/** Parse a decimal string to cents integer, e.g. "12.50" → 1250 */
function decimalToCents(s: string): number {
  const n = parseFloat(s)
  if (!isFinite(n)) return 0
  return Math.round(n * 100)
}

/**
 * Parse a CSV string (as produced by exportTransactionsCsv) and return
 * typed Transaction objects. Rows with a missing id, type, or amount are
 * skipped and counted in `skipped`.
 *
 * `accounts` and `labels` are used to resolve human-readable names back to
 * IDs. Falls back to the raw cell value for backward-compat with CSVs that
 * were exported before the name-based format was introduced.
 */
export function parseTransactionsCsv(
  csvText: string,
  accounts: Account[],
  labels: Label[],
  categories: Category[],
): CsvImportResult {
  const rows = parseCsvRows(csvText)

  if (rows.length < 2) {
    return {
      imported: [],
      skipped: 0,
      errors: ['File appears to be empty.'],
      accountsToCreate: [],
      categoriesToCreate: [],
      labelsToCreate: [],
      detectedFormat: 'unknown',
    }
  }

  const headers = rows[0].map(normalizeHeader)

  if (headers.includes('amountdecimal')) {
    return parseNativeTransactionsCsv(rows, headers, accounts, labels)
  }

  if (headers.includes('categorygroup') && headers.includes('settime')) {
    return parseBluecoinsTransactionsCsv(rows, headers, accounts, labels, categories)
  }

  return {
    imported: [],
    skipped: 0,
    errors: ['Unsupported CSV format.'],
    accountsToCreate: [],
    categoriesToCreate: [],
    labelsToCreate: [],
    detectedFormat: 'unknown',
  }
}

function parseNativeTransactionsCsv(
  rows: string[][],
  headers: string[],
  accounts: Account[],
  labels: Label[],
): CsvImportResult {
  const idx = (name: string) => headers.indexOf(name)

  const iId = idx('id')
  const iType = idx('type')
  const iDate = idx('date')
  const iDesc = idx('description')
  const iAmount = idx('amountdecimal')
  const iCurrency = idx('currency')
  const iRate = idx('exchangerate')
  const iCategoryId = idx('categoryid')
  const iAccountId = idx('account') !== -1 ? idx('account') : idx('accountid')
  const iToAccount = idx('toaccount') !== -1 ? idx('toaccount') : idx('toaccountid')
  const iStatus = idx('status')
  const iNotes = idx('notes')
  const iLabels = idx('labels')
  const iOrigAmount = idx('originalamountdecimal')
  const iOrigCurr = idx('originalcurrency')
  const iTransferId = idx('transferid')

  const accountByName = new Map(accounts.map((account) => [account.name.toLowerCase(), account.id]))
  const labelByName = new Map(labels.map((label) => [label.name.toLowerCase(), label.id]))

  const imported: Transaction[] = []
  const errors: string[] = []
  let skipped = 0

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
    const cells = rows[rowIndex]
    const rowNum = rowIndex + 1

    const id = iId >= 0 ? cells[iId] : ''
    const type = iType >= 0 ? normalizeWhitespace(cells[iType]).toLowerCase() : ''
    const amount = iAmount >= 0 ? decimalToCents(cells[iAmount]) : 0

    if (!id) {
      errors.push(`Row ${rowNum}: missing id — skipped`)
      skipped++
      continue
    }

    if (!['income', 'expense', 'transfer'].includes(type)) {
      errors.push(`Row ${rowNum}: invalid type "${type}" — skipped`)
      skipped++
      continue
    }

    if (amount <= 0 && type !== 'transfer') {
      errors.push(`Row ${rowNum}: invalid amount — skipped`)
      skipped++
      continue
    }

    const rawLabels = iLabels >= 0 ? cells[iLabels] : ''
    const resolvedLabels = rawLabels
      ? rawLabels.split('|').map(normalizeWhitespace).filter(Boolean).map((value) => labelByName.get(value.toLowerCase()) ?? value)
      : []

    const rawAccount = iAccountId >= 0 ? cells[iAccountId] : ''
    const rawToAccount = iToAccount >= 0 ? cells[iToAccount] : ''

    const transaction: Transaction = {
      id,
      type: type as Transaction['type'],
      date: iDate >= 0 ? cells[iDate] : new Date().toISOString(),
      description: iDesc >= 0 ? cells[iDesc] : '',
      amount,
      currency: iCurrency >= 0 ? cells[iCurrency] : 'USD',
      categoryId: iCategoryId >= 0 ? cells[iCategoryId] : 'other',
      accountId: accountByName.get(rawAccount.toLowerCase()) ?? rawAccount,
      status: mapStatus(iStatus >= 0 ? cells[iStatus] : 'cleared'),
      labels: resolvedLabels,
    }

    if (rawToAccount) transaction.toAccountId = accountByName.get(rawToAccount.toLowerCase()) ?? rawToAccount
    if (iNotes >= 0 && cells[iNotes]) transaction.notes = cells[iNotes]
    if (iRate >= 0 && cells[iRate]) transaction.exchangeRate = parseFloat(cells[iRate]) || undefined
    if (iOrigAmount >= 0 && cells[iOrigAmount]) transaction.originalAmount = decimalToCents(cells[iOrigAmount]) || undefined
    if (iOrigCurr >= 0 && cells[iOrigCurr]) transaction.originalCurrency = cells[iOrigCurr]
    if (iTransferId >= 0 && cells[iTransferId]) transaction.transferId = cells[iTransferId]

    imported.push(transaction)
  }

  return {
    imported,
    skipped,
    errors,
    accountsToCreate: [],
    categoriesToCreate: [],
    labelsToCreate: [],
    detectedFormat: 'native',
  }
}

interface BluecoinsRow {
  rowNum: number
  rawType: string
  dateIso: string
  description: string
  amountCents: number
  currency: string
  exchangeRate?: number
  categoryName: string
  accountName: string
  notes?: string
  labels: string[]
  status: TransactionStatus
}

function parseBluecoinsTransactionsCsv(
  rows: string[][],
  headers: string[],
  accounts: Account[],
  labels: Label[],
  categories: Category[],
): CsvImportResult {
  const idx = (name: string) => headers.indexOf(name)

  const iType = idx('type')
  const iDate = idx('date')
  const iName = idx('name')
  const iAmount = idx('amount')
  const iCurrency = idx('currency')
  const iRate = idx('exchangerate')
  const iCategoryGroup = idx('categorygroup')
  const iCategory = idx('category')
  const iAccount = idx('account')
  const iNotes = idx('notes')
  const iLabels = idx('labels')
  const iStatus = idx('status')

  const existingAccounts = new Map(accounts.map((account) => [account.name.toLowerCase(), account]))
  const existingCategories = new Map(categories.map((category) => [category.name.toLowerCase(), category]))
  const existingLabels = new Map(labels.map((label) => [label.name.toLowerCase(), label]))

  const accountsToCreate = new Map<string, Account>()
  const categoriesToCreate = new Map<string, Category>()
  const labelsToCreate = new Map<string, Label>()
  const startingBalances = new Map<string, number>()
  const nonTransferRows: BluecoinsRow[] = []
  const transferRows: BluecoinsRow[] = []
  const imported: Transaction[] = []
  const errors: string[] = []
  let skipped = 0

  const ensureAccount = (accountName: string, currency: string) => {
    const normalized = normalizeWhitespace(accountName)
    const key = normalized.toLowerCase()
    if (existingAccounts.has(key) || accountsToCreate.has(key)) return

    accountsToCreate.set(key, {
      id: `import-account-${slugify(normalized)}`,
      name: normalized,
      currency: currency || 'USD',
      openingBalance: startingBalances.get(key) ?? 0,
      type: inferAccountType(normalized),
      hidden: false,
    })
  }

  const ensureCategory = (categoryName: string, transactionType: TransactionType) => {
    const normalized = normalizeWhitespace(categoryName)
    const key = normalized.toLowerCase()
    if (!normalized || existingCategories.has(key) || categoriesToCreate.has(key)) return

    categoriesToCreate.set(key, {
      id: `import-category-${slugify(normalized)}`,
      name: normalized,
      icon: 'MoreHorizontal',
      isCustom: true,
      type: guessCategoryType(transactionType),
    })
  }

  const ensureLabel = (labelName: string) => {
    const normalized = normalizeWhitespace(labelName)
    const key = normalized.toLowerCase()
    if (!normalized || existingLabels.has(key) || labelsToCreate.has(key)) return

    labelsToCreate.set(key, {
      id: `import-label-${slugify(normalized)}`,
      name: normalized,
    })
  }

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
    const cells = rows[rowIndex]
    const rowNum = rowIndex + 1
    const rawType = iType >= 0 ? normalizeWhitespace(cells[iType]) : ''
    const dateIso = iDate >= 0 ? parseDateToIso(cells[iDate]) : null
    const description = normalizeWhitespace(iName >= 0 ? cells[iName] : '')
    const amountCentsSigned = iAmount >= 0 ? decimalToCents(cells[iAmount]) : 0
    const currency = normalizeWhitespace(iCurrency >= 0 ? cells[iCurrency] : 'USD') || 'USD'
    const exchangeRate = iRate >= 0 && cells[iRate] ? parseFloat(cells[iRate]) || undefined : undefined
    const categoryGroup = normalizeWhitespace(iCategoryGroup >= 0 ? cells[iCategoryGroup] : '')
    const categoryName = normalizeWhitespace(iCategory >= 0 ? cells[iCategory] : '') || categoryGroup || 'Other'
    const accountName = normalizeWhitespace(iAccount >= 0 ? cells[iAccount] : '')
    const notes = normalizeWhitespace(iNotes >= 0 ? cells[iNotes] : '') || undefined
    const rowLabels = parseBluecoinsLabels(iLabels >= 0 ? cells[iLabels] : '')
    const status = mapStatus(iStatus >= 0 ? cells[iStatus] : '')

    if (!rawType || !dateIso || !description || !accountName) {
      errors.push(`Row ${rowNum}: missing required fields — skipped`)
      skipped++
      continue
    }

    if (rawType.toLowerCase() === 'starting balance') {
      startingBalances.set(accountName.toLowerCase(), amountCentsSigned)
      ensureAccount(accountName, currency)
      const account = accountsToCreate.get(accountName.toLowerCase())
      if (account) account.openingBalance = amountCentsSigned
      continue
    }

    const row: BluecoinsRow = {
      rowNum,
      rawType,
      dateIso,
      description,
      amountCents: amountCentsSigned,
      currency,
      exchangeRate,
      categoryName,
      accountName,
      notes,
      labels: rowLabels,
      status,
    }

    if (rawType.toLowerCase() === 'transfer') {
      ensureAccount(accountName, currency)
      rowLabels.forEach(ensureLabel)
      transferRows.push(row)
      continue
    }

    let transactionType: TransactionType = rawType.toLowerCase() === 'income' ? 'income' : 'expense'
    if (transactionType === 'income' && amountCentsSigned < 0) transactionType = 'expense'
    if (transactionType === 'expense' && amountCentsSigned > 0) transactionType = 'income'

    ensureAccount(accountName, currency)
    ensureCategory(categoryName, transactionType)
    rowLabels.forEach(ensureLabel)
    nonTransferRows.push(row)
  }

  const resolveAccountId = (name: string) => {
    const key = name.toLowerCase()
    return existingAccounts.get(key)?.id ?? accountsToCreate.get(key)?.id ?? `import-account-${slugify(name)}`
  }
  const resolveCategoryId = (name: string) => {
    const key = name.toLowerCase()
    return existingCategories.get(key)?.id ?? categoriesToCreate.get(key)?.id ?? 'other'
  }
  const resolveLabelIds = (names: string[]) => names.map((name) => {
    const key = name.toLowerCase()
    return existingLabels.get(key)?.id ?? labelsToCreate.get(key)?.id ?? `import-label-${slugify(name)}`
  })

  for (const row of nonTransferRows) {
    const transactionType: TransactionType = row.rawType.toLowerCase() === 'income'
      ? (row.amountCents < 0 ? 'expense' : 'income')
      : (row.amountCents > 0 ? 'income' : 'expense')

    const transaction: Transaction = {
      id: makeStableId('import-tx', `${transactionType}|${row.dateIso}|${row.accountName}|${row.description}|${Math.abs(row.amountCents)}|${row.currency}|${row.notes ?? ''}`),
      type: transactionType,
      date: row.dateIso,
      description: row.description,
      amount: Math.abs(row.amountCents),
      currency: row.currency,
      exchangeRate: row.exchangeRate,
      categoryId: resolveCategoryId(row.categoryName),
      accountId: resolveAccountId(row.accountName),
      status: row.status,
      labels: resolveLabelIds(row.labels),
      notes: row.notes,
    }

    imported.push(transaction)
  }

  ensureCategory('Transfer', 'transfer')
  const transferCategoryId = resolveCategoryId('Transfer')
  const pendingTransfers = new Map<string, BluecoinsRow[]>()

  for (const row of transferRows) {
    const signature = [
      row.dateIso,
      row.description.toLowerCase(),
      (row.notes ?? '').toLowerCase(),
      row.status,
    ].join('|')

    const bucket = pendingTransfers.get(signature) ?? []
    const matchIndex = bucket.findIndex((candidate) => {
      if (candidate.accountName === row.accountName) return false
      return Math.sign(candidate.amountCents) !== Math.sign(row.amountCents)
    })

    if (matchIndex === -1) {
      bucket.push(row)
      pendingTransfers.set(signature, bucket)
      continue
    }

    const counterpart = bucket.splice(matchIndex, 1)[0]
    if (bucket.length === 0) pendingTransfers.delete(signature)
    else pendingTransfers.set(signature, bucket)

    const source = row.amountCents < 0 ? row : counterpart
    const destination = row.amountCents < 0 ? counterpart : row
    const mergedLabels = Array.from(new Set([...source.labels, ...destination.labels]))
    mergedLabels.forEach(ensureLabel)

    const transferSeed = `${source.dateIso}|${source.description}|${source.accountName}|${destination.accountName}|${Math.abs(source.amountCents)}|${Math.abs(destination.amountCents)}|${source.currency}|${destination.currency}`
    const transaction: Transaction = {
      id: makeStableId('import-transfer', transferSeed),
      transferId: makeStableId('transfer-link', transferSeed),
      type: 'transfer',
      date: source.dateIso,
      description: source.description,
      amount: Math.abs(source.amountCents),
      currency: source.currency,
      exchangeRate: source.exchangeRate ?? destination.exchangeRate,
      categoryId: transferCategoryId,
      accountId: resolveAccountId(source.accountName),
      toAccountId: resolveAccountId(destination.accountName),
      status: source.status,
      labels: resolveLabelIds(mergedLabels),
      notes: [source.notes, destination.notes].filter(Boolean).join(' | ') || undefined,
    }

    if (source.currency !== destination.currency || Math.abs(source.amountCents) !== Math.abs(destination.amountCents)) {
      transaction.originalAmount = Math.abs(destination.amountCents)
      transaction.originalCurrency = destination.currency
    }

    imported.push(transaction)
  }

  for (const [signature, pending] of pendingTransfers) {
    for (const row of pending) {
      errors.push(`Row ${row.rowNum}: transfer could not be paired for "${row.description}" — skipped`)
      skipped++
    }
    pendingTransfers.delete(signature)
  }

  return {
    imported,
    skipped,
    errors,
    accountsToCreate: Array.from(accountsToCreate.values()),
    categoriesToCreate: Array.from(categoriesToCreate.values()),
    labelsToCreate: Array.from(labelsToCreate.values()),
    detectedFormat: 'bluecoins',
  }
}
