import { create } from 'zustand'
import { toast } from 'sonner'
import { v4 as uuid } from 'uuid'
import { db } from '@/db'
import type { ExchangeRate } from '@/types'

interface ExchangeRatesState {
  rates: ExchangeRate[]
  isFetching: boolean
  load: () => Promise<void>
  fetchFromApi: (baseCurrency: string) => Promise<void>
  addManual: (rate: Omit<ExchangeRate, 'id'>) => Promise<void>
  remove: (id: string) => Promise<void>
  /** Returns the most-recent cached rate for the given pair, or null. */
  getRateForPair: (from: string, to: string) => number | null
}

export const useExchangeRatesStore = create<ExchangeRatesState>((set, get) => ({
  rates: [],
  isFetching: false,

  load: async () => {
    try {
      const rows = await db.exchangeRates.orderBy('date').reverse().toArray()
      set({ rates: rows })
    } catch (err) {
      console.error(err)
      toast.error('Failed to load exchange rates')
    }
  },

  fetchFromApi: async (baseCurrency: string) => {
    set({ isFetching: true })
    try {
      const res = await fetch(
        `https://api.frankfurter.app/latest?from=${encodeURIComponent(baseCurrency)}`,
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: { base: string; date: string; rates: Record<string, number> } = await res.json()

      // Upsert each pair: delete existing entry for same from/to/date, then add fresh one
      const today = json.date
      const newRows: ExchangeRate[] = Object.entries(json.rates).map(([toCurrency, rate]) => ({
        id: uuid(),
        fromCurrency: json.base,
        toCurrency,
        rate,
        date: today,
      }))

      await db.transaction('rw', db.exchangeRates, async () => {
        for (const row of newRows) {
          // Remove any existing entry for the same pair + date to avoid duplicates
          await db.exchangeRates
            .where('fromCurrency')
            .equals(row.fromCurrency)
            .and((r) => r.toCurrency === row.toCurrency && r.date === row.date)
            .delete()
          await db.exchangeRates.add(row)
        }
      })

      const updated = await db.exchangeRates.orderBy('date').reverse().toArray()
      set({ rates: updated })
      toast.success(`Rates updated for ${json.date}`)
    } catch (err) {
      console.error(err)
      toast.error('Failed to fetch rates — using cached values')
    } finally {
      set({ isFetching: false })
    }
  },

  addManual: async (rateData) => {
    try {
      const newRate: ExchangeRate = { id: uuid(), ...rateData }
      await db.exchangeRates.add(newRate)
      set((s) => ({ rates: [newRate, ...s.rates] }))
      toast.success('Exchange rate added')
    } catch (err) {
      console.error(err)
      toast.error('Failed to save exchange rate')
    }
  },

  remove: async (id: string) => {
    try {
      await db.exchangeRates.delete(id)
      set((s) => ({ rates: s.rates.filter((r) => r.id !== id) }))
    } catch (err) {
      console.error(err)
      toast.error('Failed to delete exchange rate')
    }
  },

  getRateForPair: (from: string, to: string) => {
    if (from === to) return 1
    const { rates } = get()
    // Most recent first (rates are ordered by date desc after load)
    const match = rates.find((r) => r.fromCurrency === from && r.toCurrency === to)
    if (match) return match.rate
    // Try inverse rate
    const inverse = rates.find((r) => r.fromCurrency === to && r.toCurrency === from)
    if (inverse && inverse.rate !== 0) return 1 / inverse.rate
    return null
  },
}))
