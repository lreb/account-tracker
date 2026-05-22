import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { localDay, getWeeklyPresetRange, getMonthlyPresetRange } from './report-date-helpers'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract local time components from a Date. */
function local(d: Date) {
  return {
    year:  d.getFullYear(),
    month: d.getMonth() + 1, // 1-indexed
    date:  d.getDate(),
    hours: d.getHours(),
    min:   d.getMinutes(),
    sec:   d.getSeconds(),
    ms:    d.getMilliseconds(),
  }
}

// Pinned fake date: Friday, 15 May 2026, local noon
const FAKE_NOW = new Date('2026-05-15T12:00:00')

// ─── localDay ────────────────────────────────────────────────────────────────

describe('localDay', () => {
  it('returns start of day (00:00:00.000) by default', () => {
    const d = new Date('2026-05-15T12:34:56.789')
    const result = local(localDay(d))
    expect(result).toMatchObject({ year: 2026, month: 5, date: 15, hours: 0, min: 0, sec: 0, ms: 0 })
  })

  it('returns end of day (23:59:59.999) when endOfDay=true', () => {
    const d = new Date('2026-05-15T01:00:00.000')
    const result = local(localDay(d, true))
    expect(result).toMatchObject({ year: 2026, month: 5, date: 15, hours: 23, min: 59, sec: 59, ms: 999 })
  })

  it('preserves the local calendar date across different time-of-day inputs', () => {
    const morning = localDay(new Date('2026-12-31T07:00:00'))
    const evening = localDay(new Date('2026-12-31T23:00:00'))
    expect(local(morning).date).toBe(31)
    expect(local(evening).date).toBe(31)
    expect(local(morning).month).toBe(12)
    expect(local(evening).month).toBe(12)
  })

  it('does not produce a UTC (Z) string — boundary is local', () => {
    // A Date created via new Date('yyyy-MM-ddT00:00:00.000') should NOT equal
    // a UTC-midnight Date when the host is not in UTC.
    const result = localDay(new Date('2026-06-01T10:00:00'))
    // Verify local components, not raw ISO string, to stay timezone-agnostic.
    const c = local(result)
    expect(c.hours).toBe(0)
    expect(c.min).toBe(0)
    expect(c.sec).toBe(0)
    expect(c.ms).toBe(0)
  })
})

// ─── getWeeklyPresetRange ─────────────────────────────────────────────────────

describe('getWeeklyPresetRange', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FAKE_NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('thisMonth — May 2026', () => {
    it('from is May 1 at 00:00:00.000 local', () => {
      const { from } = getWeeklyPresetRange('thisMonth')
      expect(local(from)).toMatchObject({ year: 2026, month: 5, date: 1, hours: 0, min: 0, sec: 0, ms: 0 })
    })

    it('to is May 31 at 23:59:59.999 local', () => {
      const { to } = getWeeklyPresetRange('thisMonth')
      expect(local(to)).toMatchObject({ year: 2026, month: 5, date: 31, hours: 23, min: 59, sec: 59, ms: 999 })
    })
  })

  describe('thisWeek — week containing May 15 (Mon=11, Sun=17)', () => {
    it('from is Monday May 11 at 00:00:00.000 local', () => {
      const { from } = getWeeklyPresetRange('thisWeek')
      expect(local(from)).toMatchObject({ year: 2026, month: 5, date: 11, hours: 0, min: 0, sec: 0, ms: 0 })
    })

    it('to is Sunday May 17 at 23:59:59.999 local', () => {
      const { to } = getWeeklyPresetRange('thisWeek')
      expect(local(to)).toMatchObject({ year: 2026, month: 5, date: 17, hours: 23, min: 59, sec: 59, ms: 999 })
    })
  })

  describe('lastMonth — April 2026', () => {
    it('from is April 1 at 00:00:00.000 local', () => {
      const { from } = getWeeklyPresetRange('lastMonth')
      expect(local(from)).toMatchObject({ year: 2026, month: 4, date: 1, hours: 0, min: 0, sec: 0, ms: 0 })
    })

    it('to is April 30 at 23:59:59.999 local', () => {
      const { to } = getWeeklyPresetRange('lastMonth')
      expect(local(to)).toMatchObject({ year: 2026, month: 4, date: 30, hours: 23, min: 59, sec: 59, ms: 999 })
    })
  })

  describe('thisYear — 2026', () => {
    it('from is Jan 1 at 00:00:00.000 local', () => {
      const { from } = getWeeklyPresetRange('thisYear')
      expect(local(from)).toMatchObject({ year: 2026, month: 1, date: 1, hours: 0, min: 0, sec: 0, ms: 0 })
    })

    it('to is Dec 31 at 23:59:59.999 local', () => {
      const { to } = getWeeklyPresetRange('thisYear')
      expect(local(to)).toMatchObject({ year: 2026, month: 12, date: 31, hours: 23, min: 59, sec: 59, ms: 999 })
    })
  })

  it('custom falls back to the current month', () => {
    const custom = getWeeklyPresetRange('custom')
    const thisMonth = getWeeklyPresetRange('thisMonth')
    expect(custom.from.getTime()).toBe(thisMonth.from.getTime())
    expect(custom.to.getTime()).toBe(thisMonth.to.getTime())
  })

  it('from is always before to', () => {
    const keys = ['thisWeek', 'thisMonth', 'lastMonth', 'thisYear', 'custom'] as const
    for (const key of keys) {
      const { from, to } = getWeeklyPresetRange(key)
      expect(from.getTime()).toBeLessThan(to.getTime())
    }
  })
})

// ─── getMonthlyPresetRange ────────────────────────────────────────────────────

describe('getMonthlyPresetRange', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FAKE_NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('thisMonth → May 1–31 2026', () => {
    const { from, to } = getMonthlyPresetRange('thisMonth')
    expect(local(from)).toMatchObject({ year: 2026, month: 5, date: 1 })
    expect(local(to)).toMatchObject({ year: 2026, month: 5, date: 31 })
  })

  it('lastMonth → April 1–30 2026', () => {
    const { from, to } = getMonthlyPresetRange('lastMonth')
    expect(local(from)).toMatchObject({ year: 2026, month: 4, date: 1 })
    expect(local(to)).toMatchObject({ year: 2026, month: 4, date: 30 })
  })

  it('last3 → from=March 1, to=May 31 (3 calendar months)', () => {
    const { from, to } = getMonthlyPresetRange('last3')
    expect(local(from)).toMatchObject({ year: 2026, month: 3, date: 1 })
    expect(local(to)).toMatchObject({ year: 2026, month: 5, date: 31 })
  })

  it('last6 → from=December 1 2025, to=May 31 2026 (6 calendar months)', () => {
    const { from, to } = getMonthlyPresetRange('last6')
    expect(local(from)).toMatchObject({ year: 2025, month: 12, date: 1 })
    expect(local(to)).toMatchObject({ year: 2026, month: 5, date: 31 })
  })

  it('thisYear → Jan 1–Dec 31 2026', () => {
    const { from, to } = getMonthlyPresetRange('thisYear')
    expect(local(from)).toMatchObject({ year: 2026, month: 1, date: 1 })
    expect(local(to)).toMatchObject({ year: 2026, month: 12, date: 31 })
  })

  it('custom falls back to the current month', () => {
    const custom = getMonthlyPresetRange('custom')
    const thisMonth = getMonthlyPresetRange('thisMonth')
    expect(custom.from.getTime()).toBe(thisMonth.from.getTime())
    expect(custom.to.getTime()).toBe(thisMonth.to.getTime())
  })

  it('all boundaries are at local day edges (00:00:00.000 / 23:59:59.999)', () => {
    const keys = ['thisMonth', 'lastMonth', 'last3', 'last6', 'thisYear', 'custom'] as const
    for (const key of keys) {
      const { from, to } = getMonthlyPresetRange(key)
      const f = local(from)
      const t = local(to)
      expect(f.hours).toBe(0)
      expect(f.min).toBe(0)
      expect(f.sec).toBe(0)
      expect(f.ms).toBe(0)
      expect(t.hours).toBe(23)
      expect(t.min).toBe(59)
      expect(t.sec).toBe(59)
      expect(t.ms).toBe(999)
    }
  })

  it('from is always before to', () => {
    const keys = ['thisMonth', 'lastMonth', 'last3', 'last6', 'thisYear', 'custom'] as const
    for (const key of keys) {
      const { from, to } = getMonthlyPresetRange(key)
      expect(from.getTime()).toBeLessThan(to.getTime())
    }
  })
})
