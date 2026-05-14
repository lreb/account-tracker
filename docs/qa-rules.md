# QA & Testing Standards

Quality assurance guidelines, testing procedures, and acceptance criteria for ExpenseTracking.

---

## Testing Strategy

### Testing Pyramid

```
         ▲
        / \
       /   \ E2E Tests (10%)
      /─────\
     /       \ Integration Tests (30%)
    /─────────\
   /           \ Unit Tests (60%)
  ╱─────────────╲
```

**Distribution**:
- **Unit Tests (60%)**: Pure functions in `src/lib/` — fast, isolated, deterministic
- **Integration Tests (30%)**: Feature modules, form submission, store mutations — slower but realistic
- **E2E Tests (10%)**: Critical user flows across entire app — slowest, most fragile

### Test Coverage Targets

| Area | Target | Current |
|------|--------|---------|
| `src/lib/` (utilities) | 80%+ | TBD |
| `src/stores/` (state) | 70%+ | TBD |
| `src/features/` (features) | 50%+ | TBD |
| Overall | 70%+ | TBD |

---

## Unit Testing

### Framework & Tools

- **Vitest**: Jest-compatible, fast, built for Vite
- **Test Files**: `*.test.ts` or `*.test.tsx` colocated with source
- **Assertions**: Node's `assert` or Vitest's `expect()`

### Running Tests

```bash
npm run test              # Run all tests once
npm run test:watch       # Watch mode (re-run on file change)
npm run test -- src/lib/categories.test.ts  # Run single file
```

### Unit Test Template

```typescript
// src/lib/budgets.test.ts
import { describe, it, expect } from 'vitest';
import { getBudgetUsage } from './budgets';

describe('getBudgetUsage', () => {
  it('returns green status when spending < 75% of limit', () => {
    const result = getBudgetUsage({
      spent: 50,      // cents
      limit: 100,
    });
    expect(result.percent).toBe(50);
    expect(result.status).toBe('green');
  });

  it('returns amber status when spending 75-99% of limit', () => {
    const result = getBudgetUsage({
      spent: 80,
      limit: 100,
    });
    expect(result.status).toBe('amber');
  });

  it('returns red status when spending >= 100% of limit', () => {
    const result = getBudgetUsage({
      spent: 120,
      limit: 100,
    });
    expect(result.percent).toBe(120);
    expect(result.status).toBe('red');
  });
});
```

### Test Categories

| Category | Example | Tool |
|----------|---------|------|
| **Utility Functions** | `convertToBase()`, `formatCurrency()` | Vitest |
| **Calculations** | Budget usage, fuel efficiency | Vitest |
| **Validation** | Zod schemas, input sanitization | Vitest |
| **Data Transforms** | Grouping transactions by date | Vitest |
| **Edge Cases** | Null values, empty arrays, boundary conditions | Vitest |

### Code Coverage Report

```bash
npm run test -- --coverage
```

Generates HTML report in `coverage/` directory. Required before merge:
- Statements: ≥ 70%
- Branches: ≥ 60%
- Functions: ≥ 70%
- Lines: ≥ 70%

---

## Integration Testing (Manual + Automated)

### Feature-Level Testing

**Transactions Feature**:
- [ ] Create transaction (all types: income, expense, transfer)
- [ ] Edit existing transaction
- [ ] Delete transaction (with confirmation)
- [ ] List transactions (sorted, grouped by date)
- [ ] Search/filter transactions
- [ ] Status progression (pending → cleared → reconciled)
- [ ] Cross-currency transfer (with exchange rate)
- [ ] Bulk import from CSV (future)

**Budgets Feature**:
- [ ] Create budget (weekly, monthly, yearly)
- [ ] Set spending limit
- [ ] View budget progress
- [ ] Receive alert at 80% spent
- [ ] Receive alert at 100%+ spent (overspent)
- [ ] Rollover unspent balance to next period
- [ ] Disable/enable rollover
- [ ] Delete budget

**Vehicles Feature**:
- [ ] Create vehicle
- [ ] Add fuel log (with calculation of km/liter, cost/km)
- [ ] View fuel efficiency trends
- [ ] Add service record
- [ ] Set service alert (by km or date)
- [ ] Archive vehicle (retain history)
- [ ] View archived vehicles

### Forms & Validation

**Acceptance Criteria**:
- [ ] All required fields enforced
- [ ] Input validation matches schema (zod)
- [ ] Error messages clear and specific
- [ ] Submit button disabled while loading
- [ ] Form resets after successful submit
- [ ] Unsaved changes warning on navigation away
- [ ] Form state persists during page reload (if draft)

**Test Cases**:
```typescript
describe('TransactionForm', () => {
  it('displays validation error for negative amount', async () => {
    // Type -50 in amount field
    // Expect error: "Amount must be > 0"
  });

  it('prevents submit with missing required fields', async () => {
    // Leave category empty
    // Submit button should be disabled
  });

  it('submits form and clears fields on success', async () => {
    // Fill all required fields
    // Click submit
    // Form should reset
    // Success toast should appear
  });
});
```

### Store/State Testing

**Zustand Store Tests**:
```typescript
describe('useTransactionsStore', () => {
  it('loads transactions from Dexie on mount', async () => {
    const store = useTransactionsStore();
    expect(store.loading).toBe(true);
    await waitFor(() => expect(store.loading).toBe(false));
    expect(store.transactions.length).toBeGreaterThan(0);
  });

  it('adds transaction and updates in-memory state', async () => {
    const store = useTransactionsStore();
    const initialCount = store.transactions.length;
    await store.add({ type: 'expense', amount: 5000, ... });
    expect(store.transactions.length).toBe(initialCount + 1);
  });
});
```

---

## End-to-End Testing (Manual + Playwright)

### Critical User Flows

**Flow 1: Record & Review Expense**
1. Open app → Dashboard visible
2. Tap "+" → Transaction form opens
3. Enter amount ($25.50)
4. Select category (groceries)
5. Confirm → Transaction saved
6. View in transaction list
7. Tap to edit → Form re-populates
8. Save changes → Updated in list

**Flow 2: Multi-Currency Transfer**
1. Create USD account + EUR account
2. Try transfer between them
3. Exchange rate dialog opens
4. User confirms rate (or fetches live)
5. Two transactions created (linked debit/credit)
6. Both accounts show correct balances
7. Report shows conversion correctly

**Flow 3: Offline Then Online Sync**
1. Disconnect network
2. Add transaction (works offline)
3. View dashboard (transaction visible)
4. Reconnect network
5. Cloud sync triggers (if enabled)
6. Backup created in cloud
7. Browser cache survives page refresh
8. Data persists across sessions

### Playwright Test Example (Future)

```typescript
// tests/e2e/transaction-flow.spec.ts
import { test, expect } from '@playwright/test';

test('record and review transaction', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  
  // Click add button
  await page.click('[data-testid="add-transaction-btn"]');
  
  // Fill form
  await page.fill('[name="amount"]', '25.50');
  await page.selectOption('[name="category"]', 'food-groceries');
  await page.fill('[name="description"]', 'Whole Foods');
  
  // Submit
  await page.click('[type="submit"]');
  
  // Verify toast & list update
  await expect(page.locator('text=Transaction saved')).toBeVisible();
  await expect(page.locator('text=Whole Foods')).toBeVisible();
});
```

---

## Browser & Platform Compatibility

### Desktop Browsers

| Browser | Version | Status | Note |
|---------|---------|--------|------|
| Chrome | 120+ | ✅ Supported | Latest + 1 |
| Firefox | 120+ | ✅ Supported | Latest + 1 |
| Safari | 15+ | ✅ Supported | IndexedDB + PWA support |
| Edge | 120+ | ✅ Supported | Chromium-based |
| IE 11 | N/A | ❌ Not Supported | No service worker |

### Mobile Browsers

| OS | Browser | Version | Status |
|---|---------|---------|--------|
| Android | Chrome | 120+ | ✅ Supported |
| Android | Firefox | 120+ | ✅ Supported |
| iOS | Safari | 15+ | ✅ Supported |
| iOS | Chrome | 120+ | ⚠️ Limited (uses WebKit) |

### Testing Checklist

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Android Chrome
- [ ] iOS Safari (iPad + iPhone)

### Known Limitations

- **iOS PWA**: Full offline + install support limited (Apple restrictions)
- **Android Chrome**: Some IndexedDB quota limitations
- **IE 11**: Not supported (EOL, no service worker, weak crypto)

---

## Mobile Device Testing

### Real Device Testing

**Minimum Devices**:
- iPhone 12 or newer (iOS testing)
- Android 11+ phone (Android testing)
- iPad (responsive design on larger screen)

**Testing Procedure**:
1. Install app on device via "Add to Home Screen"
2. Run through critical user flows
3. Test offline (disable Wi-Fi)
4. Test on slow network (Settings → Network throttle)
5. Test in low light (dark mode)
6. Test with screen reader enabled (accessibility)

### Emulator/Simulator Testing

**Android Emulator**:
```bash
# via Android Studio
# Create AVD (Android Virtual Device)
# Run: Nexus 5X (5.2"), Pixel 4 (5.7"), Tablet emulator
# Test: install app, run flows
```

**iOS Simulator**:
```bash
# via Xcode
# Run: iPhone 14, iPhone 14 Plus, iPad Pro
# Test: install app, run flows, check responsive design
```

### Performance on Mobile

**Metrics**:
- Initial load: < 3 seconds on 4G
- Time to interactive: < 5 seconds
- Scroll smoothness: 60 FPS (no jank)
- Memory usage: < 50 MB (check DevTools)

**Tools**:
- Chrome DevTools → Lighthouse (performance audit)
- Network tab → Throttle to 4G to simulate mobile network
- Performance tab → Record and analyze frame drops

---

## Accessibility Testing (a11y)

### Standards

**Target**: WCAG 2.1 Level AA compliance

| Principle | Standard | Requirement |
|-----------|----------|-------------|
| **Perceivable** | 1.4.3 Contrast | Text contrast ≥ 4.5:1 (normal), ≥ 3:1 (large) |
| **Perceivable** | 1.4.5 Images | Meaningful images have alt text |
| **Operable** | 2.1.1 Keyboard | All functionality keyboard accessible |
| **Operable** | 2.4.3 Focus | Focus order logical, visible indicator |
| **Understandable** | 3.1 Language | Page language declared |
| **Understandable** | 3.3.1 Labels | Form fields have labels |
| **Robust** | 4.1.2 Semantics | HTML semantic markup, ARIA where needed |

### Testing Tools

- **Automated**: axe DevTools (browser extension), Lighthouse
- **Manual**: Screen reader (NVDA, JAWS on Windows; VoiceOver on Mac/iOS)
- **Keyboard**: Tab through all interactive elements

### Testing Checklist

- [ ] Color contrast ≥ 4.5:1 (use WebAIM Contrast Checker)
- [ ] All buttons/links keyboard accessible (Tab through)
- [ ] Focus indicator visible on all interactive elements
- [ ] Form labels associated with inputs
- [ ] Images have meaningful alt text (or aria-hidden if decorative)
- [ ] No keyboard traps (focus can move freely)
- [ ] Screen reader can navigate page structure
- [ ] Touch targets ≥ 44x44 px (mobile)

### Accessibility Regression Tests

```typescript
describe('TransactionForm Accessibility', () => {
  it('has associated labels for all inputs', async () => {
    const amountInput = screen.getByLabelText('Amount');
    expect(amountInput).toBeInTheDocument();
  });

  it('shows focus indicator on category select', async () => {
    const categorySelect = screen.getByRole('combobox', { name: 'Category' });
    categorySelect.focus();
    expect(categorySelect).toHaveFocus();
    expect(categorySelect).toHaveCSSProperty('outline');
  });

  it('submit button disabled state communicated to screen readers', async () => {
    const button = screen.getByRole('button', { name: 'Save Transaction' });
    expect(button).toHaveAttribute('disabled');
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });
});
```

---

## Data Validation Testing

### Currency & Amounts

- [ ] Amounts stored as integers (cents), not floats
- [ ] No rounding errors in conversions
- [ ] Exchange rates applied correctly to cross-currency transfers
- [ ] Account balances always match sum of transactions
- [ ] Negative amounts rejected (except transfers out)

**Test**:
```typescript
describe('Currency Conversion', () => {
  it('converts 100 USD to EUR without rounding error', () => {
    const cents = 10000; // $100.00
    const rate = 0.92;
    const result = convertToBase(cents, rate);
    expect(result).toBe(9200); // €92.00, not 9199.999...
  });
});
```

### Date Handling

- [ ] Transactions display in user's local timezone (not UTC)
- [ ] Budget periods align to calendar boundaries (not offset)
- [ ] Date pickers accept valid dates only
- [ ] Leap years handled correctly
- [ ] DST transitions don't cause date shifts

### Categories & Labels

- [ ] Predefined categories cannot be deleted
- [ ] Renaming category updates all retroactively
- [ ] Custom category creation requires unique name
- [ ] Category icons display correctly
- [ ] Label suggestions work (previously used labels)

### Status Transitions

- [ ] `pending` → `cleared` only (no reverse without explicit edit)
- [ ] `cleared` → `reconciled` only (no reverse)
- [ ] `reconciled` cannot be edited to pending/cleared
- [ ] `cancelled` transactions don't affect balance
- [ ] Status changes persist across sessions

---

## Offline Functionality Testing

### Critical Offline Flows

1. **Add transaction offline** → Saved locally → Syncs on online
2. **View transaction list offline** → Shows all local transactions
3. **Create budget offline** → Persists locally
4. **Calculate budget usage offline** → Accurate (no network call)
5. **Export data offline** → Works (no cloud upload yet)

### Testing Procedure

```
1. Open app in Chrome
2. DevTools → Network → Offline (simulate offline)
3. Add transaction → Should succeed (no error)
4. Go to Dashboard → Transaction shows
5. Go to DevTools → Network → Online
6. Transaction should sync (if cloud sync enabled)
7. Refresh page → Data persists
```

### Offline Test Cases

```typescript
describe('Offline Mode', () => {
  it('allows adding transaction when offline', async () => {
    // Simulate offline
    global.navigator.onLine = false;
    
    const store = useTransactionsStore();
    await store.add({ type: 'expense', amount: 5000, ... });
    
    // Transaction in state immediately (optimistic)
    expect(store.transactions[0].id).toBeDefined();
  });

  it('queues sync when back online', async () => {
    // Add transaction offline
    global.navigator.onLine = false;
    await store.add(transaction);
    
    // Go online
    global.navigator.onLine = true;
    window.dispatchEvent(new Event('online'));
    
    // Sync should trigger
    await waitFor(() => expect(syncQueue).toBeEmpty());
  });
});
```

---

## Regression Testing

### Critical Paths (Always Test)

**Before Every Release**:
- [ ] Create transaction (income, expense, transfer)
- [ ] Edit transaction
- [ ] Delete transaction
- [ ] Create budget
- [ ] View budget progress on dashboard
- [ ] Cross-currency transfer (with exchange rate)
- [ ] Category rename (check retroactive update)
- [ ] Add fuel log (verify calculations)
- [ ] Export data to JSON
- [ ] Import data from JSON backup
- [ ] Factory reset
- [ ] Cloud sync (Google Drive, if enabled)
- [ ] PWA install and offline mode
- [ ] Dark mode toggle

### Regression Test Suite

```typescript
describe('Critical Regression Tests', () => {
  describe('Transaction Recording', () => {
    it('creates expense transaction with correct balance', async () => {
      // Create account with opening balance 100
      // Add $50 expense
      // Verify balance = 50
    });

    it('retains transaction after page reload', async () => {
      // Create transaction
      // Reload page
      // Verify transaction still visible
    });
  });

  describe('Category Renaming', () => {
    it('updates all transactions retroactively when category renamed', async () => {
      // Create transaction with category "food-groceries"
      // Rename category to "groceries-shopping"
      // Verify transaction shows new category name (not old)
    });

    it('doesn\'t break icons when category renamed', async () => {
      // Rename category
      // Verify icon still displays correctly
    });
  });

  describe('Cross-Currency Transfers', () => {
    it('creates two linked transactions with correct rates', async () => {
      // Transfer $100 USD → €92 EUR at rate 0.92
      // Verify: source has -10000 cents, dest has +9200 cents
      // Verify: exchangeRate = 0.92 stored correctly
    });
  });

  describe('Budget Calculations', () => {
    it('calculates usage correctly at read time', async () => {
      // Create budget: $100/month
      // Add $80 in expenses to category
      // Verify: usage = 80%, status = amber
    });
  });

  describe('Offline Mode', () => {
    it('loads and displays transactions offline', async () => {
      // Go offline
      // Reload page
      // Verify transactions still visible
    });
  });

  describe('Data Export/Import', () => {
    it('exports and imports data without corruption', async () => {
      // Export as JSON
      // Factory reset
      // Import exported JSON
      // Verify data matches original
    });
  });
});
```

### Regression Cadence

- **Per PR**: Manual testing of changed feature
- **Before Release**: Full regression test suite on all critical paths
- **Post-Release**: Smoke test on live environment (first 48 hours)

---

## Performance Testing

### Benchmarks

| Metric | Target | Test |
|--------|--------|------|
| Initial Load | < 2 sec | Lighthouse, 4G throttle |
| Time to Interactive | < 3 sec | DevTools Performance tab |
| Bundle Size | < 300 KB (gzipped) | `npm run build` output |
| List Render (1000 items) | < 100 ms | Measure with `performance.now()` |
| Dashboard Render | < 500 ms | Measure with React DevTools Profiler |

### Tools

- **Lighthouse** (Chrome DevTools): Performance, accessibility, PWA audits
- **Web Vitals**: LCP, FID, CLS metrics
- **React DevTools Profiler**: Component render times
- **Chrome DevTools Network**: Waterfall, cache effectiveness

### Performance Test Cases

```typescript
describe('Performance', () => {
  it('renders transaction list with 1000 items in < 100ms', async () => {
    const transactions = generateMockTransactions(1000);
    
    const start = performance.now();
    render(<TransactionList transactions={transactions} />);
    const elapsed = performance.now() - start;
    
    expect(elapsed).toBeLessThan(100);
  });

  it('memoizes dashboard calculations', async () => {
    const { rerender } = render(<Dashboard transactions={txs} accounts={accs} />);
    
    // Rerender with same props
    rerender(<Dashboard transactions={txs} accounts={accs} />);
    
    // Should not recalculate (memoization should prevent)
    // Verify with spy on calculation function
  });
});
```

---

## Testing Before Merge

### Checklist for PR Review

- [ ] Code reviewed for correctness
- [ ] ESLint passes: `npm run lint`
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] All tests pass: `npm run test`
- [ ] New code has tests (≥70% coverage)
- [ ] Manual testing completed (feature works as designed)
- [ ] No console errors/warnings
- [ ] Accessibility checklist completed
- [ ] Performance not degraded (bundle size, render time)
- [ ] Offline mode tested (if applicable)
- [ ] Cross-browser tested (Chrome + Firefox minimum)

---

## Test Data & Fixtures

### Mock Data Factory

```typescript
// tests/fixtures/index.ts
export const mockTransaction = (overrides = {}): Transaction => ({
  id: 'tx-123',
  type: 'expense',
  amount: 5000,
  date: new Date().toISOString().split('T')[0],
  categoryId: 'food-groceries',
  accountId: 'acc-1',
  description: 'Groceries',
  status: 'cleared',
  currency: 'USD',
  ...overrides,
});

export const mockAccount = (overrides = {}): Account => ({
  id: 'acc-1',
  name: 'Checking',
  type: 'bank',
  openingBalance: 100000,
  currency: 'USD',
  ...overrides,
});

export const generateMockTransactions = (count: number): Transaction[] =>
  Array.from({ length: count }, (_, i) =>
    mockTransaction({
      id: `tx-${i}`,
      amount: Math.random() * 10000,
    })
  );
```

---

## Questions & Issues

For QA questions or test failures:
- **GitHub Issues**: QA bugs, test infrastructure problems
- **Test Failures**: Share error logs, reproduction steps
- **Coverage Reports**: Discuss with team how to improve coverage

---

## References

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Web Vitals](https://web.dev/vitals/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)
