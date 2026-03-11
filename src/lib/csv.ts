/**
 * Client-side CSV export and import for transactions.
 *
 * Export columns (in order):
 *   id, type, date, description, amount, currency, exchangeRate,
 *   categoryId, accountId, toAccountId, status, notes, labels,
 *   originalAmount, originalCurrency, transferId
 *
 * Import: re-reads the same column set. Unknown columns are ignored.
 * Amount is stored as cents (integer). The CSV file uses decimal representation
 * (e.g. "12.50") and the importer multiplies by 100 → integer cents.
 */

import type { Account, Label, Transaction } from '@/types'

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

/** Split one CSV line into raw cell strings (handles quoted commas). */
function splitLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++ // skip escaped quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
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
): CsvImportResult {
  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim() !== '')

  if (lines.length < 2) {
    return { imported: [], skipped: 0, errors: ['File appears to be empty.'] }
  }

  const headers = splitLine(lines[0]).map((h) => unquote(h).toLowerCase().trim())

  const idx = (name: string) => headers.indexOf(name)

  const iId          = idx('id')
  const iType        = idx('type')
  const iDate        = idx('date')
  const iDesc        = idx('description')
  const iAmount      = idx('amount_decimal')
  const iCurrency    = idx('currency')
  const iRate        = idx('exchangerate')
  const iCategoryId  = idx('categoryid')
  // support both name-based (new) and id-based (old) column headers
  const iAccountId   = idx('account')   !== -1 ? idx('account')   : idx('accountid')
  const iToAccount   = idx('toaccount') !== -1 ? idx('toaccount') : idx('toaccountid')
  const iStatus      = idx('status')
  const iNotes       = idx('notes')
  const iLabels      = idx('labels')
  const iOrigAmount  = idx('originalamount_decimal')
  const iOrigCurr    = idx('originalcurrency')
  const iTransferId  = idx('transferid')

  // Build name → id lookup maps (case-insensitive)
  const accountByName = new Map(accounts.map((a) => [a.name.toLowerCase(), a.id]))
  const labelByName   = new Map(labels.map((l) => [l.name.toLowerCase(), l.id]))

  /** Resolve an account cell: try name lookup, fall back to raw value (old ID format). */
  const resolveAccount = (val: string) => accountByName.get(val.toLowerCase()) ?? val
  /** Resolve a label cell: try name lookup, fall back to raw value (old ID format). */
  const resolveLabel   = (val: string) => labelByName.get(val.toLowerCase()) ?? val

  const imported: Transaction[] = []
  const errors: string[] = []
  let skipped = 0

  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]).map(unquote)
    const rowNum = i + 1

    const id     = iId   >= 0 ? cells[iId]   : ''
    const type   = iType >= 0 ? cells[iType] : ''
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

    const rawLabels   = iLabels >= 0 ? cells[iLabels] : ''
    const resolvedLabels = rawLabels
      ? rawLabels.split('|').filter(Boolean).map(resolveLabel)
      : []

    const rawAccount   = iAccountId >= 0 ? cells[iAccountId] : ''
    const rawToAccount = iToAccount  >= 0 ? cells[iToAccount]  : ''

    const tx: Transaction = {
      id,
      type:             type as Transaction['type'],
      date:             iDate       >= 0 ? cells[iDate]      : new Date().toISOString(),
      description:      iDesc       >= 0 ? cells[iDesc]      : '',
      amount,
      currency:         iCurrency   >= 0 ? cells[iCurrency]  : 'USD',
      categoryId:       iCategoryId >= 0 ? cells[iCategoryId]: '',
      accountId:        resolveAccount(rawAccount),
      status:           (iStatus    >= 0 ? cells[iStatus]    : 'cleared') as Transaction['status'],
      labels:           resolvedLabels,
    }

    if (rawToAccount)
      tx.toAccountId = resolveAccount(rawToAccount)
    if (iNotes >= 0 && cells[iNotes])
      tx.notes = cells[iNotes]
    if (iRate >= 0 && cells[iRate])
      tx.exchangeRate = parseFloat(cells[iRate]) || undefined
    if (iOrigAmount >= 0 && cells[iOrigAmount])
      tx.originalAmount = decimalToCents(cells[iOrigAmount]) || undefined
    if (iOrigCurr >= 0 && cells[iOrigCurr])
      tx.originalCurrency = cells[iOrigCurr]
    if (iTransferId >= 0 && cells[iTransferId])
      tx.transferId = cells[iTransferId]

    imported.push(tx)
  }

  return { imported, skipped, errors }
}
