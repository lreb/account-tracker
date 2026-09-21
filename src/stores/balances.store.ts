import { create } from 'zustand'
import { toast } from 'sonner'
import { db } from '@/db'
import { buildAccountBalanceMap } from '@/lib/balance-sheet'
import { useAccountsStore } from '@/stores/accounts.store'
import { useTransactionsStore } from '@/stores/transactions.store'

interface BalancesState {
  /**
   * accountId → current balance in the account's own currency (integer cents).
   * Cancelled transactions are excluded; hidden accounts are still included so
   * every consumer renders the same value.
   */
  balances: Map<string, number>
  loading: boolean
  load: () => Promise<void>
}

export const useBalancesStore = create<BalancesState>((set) => ({
  balances: new Map(),
  loading: false,

  load: async () => {
    const { accounts } = useAccountsStore.getState()
    set({ loading: true })
    try {
      const activeTx = await db.transactions
        .filter((tx) => tx.status !== 'cancelled')
        .toArray()
      set({ balances: buildAccountBalanceMap(accounts, activeTx) })
    } catch (err) {
      console.error(err)
      toast.error('Failed to load account balances')
    } finally {
      set({ loading: false })
    }
  },
}))

// Keep the balances map in sync with the source stores. Balances are computed
// from Dexie directly (never from the date-filtered store slice), so any
// accounts/transactions mutation is a signal to recompute.
let subscriptionsAttached = false
function attachSubscriptions() {
  if (subscriptionsAttached) return
  subscriptionsAttached = true

  // Guards keep this safe when the dependency stores are mocked as plain hook
  // factories in component tests.
  if (typeof useAccountsStore.subscribe === 'function') {
    useAccountsStore.subscribe((state, prevState) => {
      if (state.accounts !== prevState.accounts) void useBalancesStore.getState().load()
    })
  }

  if (typeof useTransactionsStore.subscribe === 'function') {
    useTransactionsStore.subscribe((state, prevState) => {
      if (state.revision !== prevState.revision) void useBalancesStore.getState().load()
    })
  }
}

attachSubscriptions()