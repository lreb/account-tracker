import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'

// Node.js 26 defines localStorage / sessionStorage as experimental accessor
// globals (getter + setter) that return undefined when --localstorage-file is
// not provided. The setter is a no-op, so jsdom's normal `global.x = value`
// assignment silently fails and the getter keeps returning undefined.
// Because the properties are configurable we can replace each accessor with a
// writable data property containing an in-memory implementation — this is
// transparent to all test code and still lets jsdom override if it needs to.
function createMemoryStorage(): Storage {
  const store: Record<string, string> = {}
  return {
    get length() {
      return Object.keys(store).length
    },
    key(index: number) {
      return Object.keys(store)[index] ?? null
    },
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null
    },
    setItem(key: string, value: string) {
      store[key] = String(value)
    },
    removeItem(key: string) {
      delete store[key]
    },
    clear() {
      Object.keys(store).forEach((k) => delete store[k])
    },
  } as Storage
}

for (const key of ['localStorage', 'sessionStorage'] as const) {
  const desc = Object.getOwnPropertyDescriptor(globalThis, key)
  if (desc?.configurable) {
    Object.defineProperty(globalThis, key, {
      value: createMemoryStorage(),
      writable: true,
      configurable: true,
      enumerable: false,
    })
  }
}
