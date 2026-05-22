/**
 * Client-side account statement export — CSV and PDF (print-to-window).
 *
 * Centralised for reuse across any view that displays an account's transaction
 * history with a running balance (e.g. BalanceSheetDetailPage).
 *
 * No extra npm dependencies — PDF is produced via the browser's native
 * print-to-PDF by writing HTML to a new window and calling window.print().
 */

import { format } from 'date-fns'

import type { Account, Transaction } from '@/types'
import { getAccountTransactionAmount } from '@/lib/balance-sheet'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface StatementRow {
  date: string          // YYYY-MM-DD (local time)
  time: string          // HH:mm (local time)
  type: string          // 'Income' | 'Expense' | 'Transfer In' | 'Transfer Out'
  description: string
  category: string      // resolved category name
  status: string        // 'Pending' | 'Cleared' | 'Reconciled' | 'Cancelled'
  signedAmount: number  // signed cents — negative = outflow from account
  balance?: number      // running account balance in cents after this tx
  currency: string      // account ISO 4217 currency
  notes: string
  labels: string        // semicolon-separated label names
}

export interface StatementOptions {
  accountName: string
  currency: string
  currentBalance: number  // cents — displayed in PDF header
  dateFrom?: string       // YYYY-MM-DD — displayed in PDF header only
  dateTo?: string         // YYYY-MM-DD — displayed in PDF header only
}

/**
 * Minimal read-only map interface satisfied by Map<string, BalanceEntry>
 * where BalanceEntry has at least { accountBalance: number }.
 *
 * Using a structural interface avoids Map invariance issues: TypeScript
 * method return types are covariant, so `Map<string, T>.get()` returning
 * `T | undefined` is assignable here when T extends { accountBalance: number }.
 */
export interface BalanceMapLike {
  get(key: string): { accountBalance: number } | undefined
}

/**
 * Minimal read-only map interface satisfied by Map<string, Category> and
 * Map<string, Label> — both types have a `name: string` field.
 */
export interface NamedMapLike {
  get(key: string): { name: string } | undefined
}

// ─── Builder ──────────────────────────────────────────────────────────────────

/**
 * Build statement rows from the filtered transaction list.
 *
 * @param transactions  Filtered transactions, newest-first (as stored in the
 *                      Zustand store / filteredAccountTransactions).
 *                      The output is reversed to oldest-first for a natural
 *                      bank-statement reading order.
 */
export function buildStatementRows(
  transactions: Transaction[],
  account: Account,
  balanceAfterTx: BalanceMapLike,
  categoryMap: NamedMapLike,
  labelMap: NamedMapLike,
): StatementRow[] {
  const chronological = [...transactions].reverse()

  return chronological.map((tx): StatementRow => {
    const signedAmount = getAccountTransactionAmount(tx, account)

    let type: string
    if (tx.type === 'transfer') {
      type = tx.toAccountId === account.id ? 'Transfer In' : 'Transfer Out'
    } else {
      type = tx.type.charAt(0).toUpperCase() + tx.type.slice(1)
    }

    const labelNames = (tx.labels ?? [])
      .map((lid) => labelMap.get(lid)?.name ?? lid)
      .join('; ')

    const txDate = new Date(tx.date)

    return {
      date: format(txDate, 'yyyy-MM-dd'),
      time: format(txDate, 'HH:mm'),
      type,
      description: tx.description,
      category: categoryMap.get(tx.categoryId)?.name ?? '',
      status: tx.status.charAt(0).toUpperCase() + tx.status.slice(1),
      signedAmount,
      balance: balanceAfterTx.get(tx.id)?.accountBalance,
      currency: account.currency,
      notes: tx.notes ?? '',
      labels: labelNames,
    }
  })
}

// ─── CSV export ───────────────────────────────────────────────────────────────

const STATEMENT_CSV_HEADERS = [
  'Date', 'Time', 'Type', 'Description', 'Category', 'Status',
  'Amount', 'Balance', 'Currency', 'Notes', 'Labels',
]

function csvCell(v: string | number | undefined | null): string {
  if (v === undefined || v === null) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function centsToDecimal(cents: number): string {
  return (cents / 100).toFixed(2)
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9]/gi, '-').toLowerCase()
}

export function exportStatementCsv(
  rows: StatementRow[],
  options: Pick<StatementOptions, 'accountName' | 'currency'>,
  filename?: string,
): void {
  const lines: string[] = [STATEMENT_CSV_HEADERS.join(',')]

  for (const row of rows) {
    lines.push([
      csvCell(row.date),
      csvCell(row.time),
      csvCell(row.type),
      csvCell(row.description),
      csvCell(row.category),
      csvCell(row.status),
      csvCell(centsToDecimal(row.signedAmount)),
      csvCell(row.balance !== undefined ? centsToDecimal(row.balance) : ''),
      csvCell(row.currency),
      csvCell(row.notes),
      csvCell(row.labels),
    ].join(','))
  }

  const content = lines.join('\r\n')
  // BOM prefix ensures Excel opens UTF-8 files correctly
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename ?? `statement-${sanitizeFilename(options.accountName)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── PDF via print window ─────────────────────────────────────────────────────

/** Escape a string for safe inclusion in HTML. */
function he(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100)
}

/**
 * Open a print-ready HTML page in a new window and trigger the browser's
 * print-to-PDF dialog. Falls back to downloading an `.html` file when the
 * popup is blocked.
 */
export function exportStatementPdf(
  rows: StatementRow[],
  options: StatementOptions,
): void {
  const { accountName, currency, currentBalance, dateFrom, dateTo } = options

  const periodLabel =
    dateFrom && dateTo ? `${dateFrom} \u2013 ${dateTo}`
    : dateFrom         ? `From ${dateFrom}`
    : dateTo           ? `Until ${dateTo}`
    : 'All time'

  const tableRows = rows
    .map((row) => {
      const positive = row.signedAmount >= 0
      const amountStr = (positive ? '+' : '') + centsToDecimal(row.signedAmount)
      const balStr = row.balance !== undefined ? centsToDecimal(row.balance) : '\u2014'
      const color = positive ? '#16a34a' : '#dc2626'
      return `<tr>
        <td>${he(row.date)}</td>
        <td>${he(row.time)}</td>
        <td>${he(row.type)}</td>
        <td class="desc">${he(row.description)}${row.notes ? `<br><span class="note">${he(row.notes)}</span>` : ''}</td>
        <td>${he(row.category)}</td>
        <td class="st">${he(row.status)}</td>
        <td class="num" style="color:${color}">${he(amountStr)}</td>
        <td class="num">${he(balStr)}</td>
      </tr>`
    })
    .join('\n')

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8">
<title>Statement \u2014 ${he(accountName)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,Arial,sans-serif;font-size:11px;color:#111;padding:20px}
  h1{font-size:15px;font-weight:700;margin-bottom:10px}
  .meta{display:flex;flex-wrap:wrap;gap:10px 28px;margin-bottom:14px;font-size:10px;color:#555}
  .meta b{color:#111}
  table{width:100%;border-collapse:collapse}
  th{background:#f3f4f6;text-align:left;padding:5px 7px;font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;border-bottom:2px solid #e5e7eb}
  td{padding:4px 7px;border-bottom:1px solid #f3f4f6;vertical-align:top}
  tr:last-child td{border-bottom:none}
  .num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
  .desc{max-width:200px}
  .note{color:#9ca3af;font-size:9px}
  .st{white-space:nowrap}
  .footer{margin-top:14px;border-top:1px solid #e5e7eb;padding-top:8px;font-size:9px;color:#9ca3af;display:flex;justify-content:space-between}
  @media print{body{padding:0}@page{margin:15mm}}
</style>
</head>
<body>
<h1>Account Statement \u2014 ${he(accountName)}</h1>
<div class="meta">
  <span><b>Currency:</b> ${he(currency)}</span>
  <span><b>Period:</b> ${he(periodLabel)}</span>
  <span><b>Current balance:</b> ${he(formatMoney(currentBalance, currency))}</span>
  <span><b>Transactions:</b> ${rows.length}</span>
</div>
<table>
  <thead><tr>
    <th>Date</th><th>Time</th><th>Type</th><th>Description</th>
    <th>Category</th><th>Status</th><th class="num">Amount</th><th class="num">Balance</th>
  </tr></thead>
  <tbody>
    ${tableRows}
  </tbody>
</table>
<div class="footer">
  <span>Generated ${new Date().toLocaleDateString()}</span>
  <span>${he(accountName)}</span>
</div>
<script>window.onload = function () { window.print() }</` + `script>
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) {
    // Popup blocked — fall back to downloading an HTML file the user can open
    // and print manually.
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `statement-${sanitizeFilename(accountName)}.html`
    a.click()
    URL.revokeObjectURL(url)
    return
  }

  win.document.write(html)
  win.document.close()
}
