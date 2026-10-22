import { describe, it, expect } from 'vitest'
import { validateSnapshot, pickNewest, combinedSummary, snapshotMode, snapshotAgeDays, budgetPace } from './snapshot.js'
import { monthSummary } from './summary.js'

const NOW = new Date(2026, 9, 18, 9, 12, 0)
const snap = (o = {}) => ({
  format: 'nt-finance-summary', version: 1, month: '2026-10', generated_at: '2026-10-18T08:00:00', currency: 'INR',
  totals: { income: 100000, expense: 60000, net: 40000, savings_rate: 0.4, prev_same_range: null },
  by_category: [{ name: 'Self', spent: 4000, budget: 10000, basis: 'exclude_card' }, { name: 'Home', spent: 20000, budget: null }],
  daily: [{ date: '2026-10-01', expense: 12000, income: 0 }, { date: '2026-10-05', expense: 8000, income: 0 }],
  top_spends: [{ spend_name: 'Rent', category: 'Home', amount: 12000, date: '2026-10-01' }],
  accounts: [{ name: 'HDFC', kind: 'bank', balance: 3027.39 }], card_dues: [{ card: 'HDFC CC', due_date: '2026-11-04', amount: 22538.36 }],
  next_tally: null, included_phone_entry_ids: ['in1'], ...o,
})
let n = 0
const mk = (o) => ({ id: 'p' + ++n, date: '2026-10-18', category: 'Self', spend_name: 'Swiggy', amount: 500, type: 'Expense', from_account: 'HDFC', to_account: null, mode: 'UPI', comment: '', created_at: '2026-10-18T09:00:00', ...o })

describe('validateSnapshot', () => {
  it('accepts a valid file and fills missing lists', () => {
    const { card_dues, accounts, ...rest } = snap()
    const r = validateSnapshot(rest)
    expect(r.ok).toBe(true)
    expect(r.snapshot.card_dues).toEqual([])
  })
  it('rejects wrong format, version, month, totals and malformed rows', () => {
    expect(validateSnapshot(snap({ format: 'nt-finance-capture' })).ok).toBe(false)
    expect(validateSnapshot(snap({ version: 2 })).ok).toBe(false)
    expect(validateSnapshot(snap({ month: '2026-13' })).ok).toBe(false)
    expect(validateSnapshot(snap({ totals: { income: 'x' } })).ok).toBe(false)
    expect(validateSnapshot(snap({ by_category: [{ name: 'A' }] })).ok).toBe(false)
    expect(validateSnapshot(null).ok).toBe(false)
  })
  it('keeps the newest snapshot', () => {
    const a = snap({ generated_at: '2026-10-17T08:00:00' }), b = snap({ generated_at: '2026-10-18T08:00:00' })
    expect(pickNewest(a, b)).toBe(b)
    expect(pickNewest(b, a)).toBe(b)
    expect(pickNewest(null, a)).toBe(a)
  })
})

describe('combinedSummary', () => {
  it('without a snapshot equals the phone-only summary', () => {
    const entries = [mk({ amount: 700 })]
    const c = combinedSummary(entries, null, NOW)
    expect(c.mode).toBe('phone')
    expect(c.expense).toBe(monthSummary(entries, NOW).expense)
    expect(c.hasData).toBe(true)
    expect(combinedSummary([], null, NOW).hasData).toBe(false)
  })
  it('adds only phone entries whose id is not in included_phone_entry_ids', () => {
    const entries = [mk({ id: 'in1', amount: 999 }), mk({ amount: 500 }), mk({ type: 'Income', amount: 2000, category: 'Self', from_account: null, to_account: 'HDFC' }), mk({ type: 'Transfer', amount: 5000, to_account: 'HDFC CC' })]
    const c = combinedSummary(entries, snap(), NOW)
    expect(c.mode).toBe('website')
    expect(c.expense).toBe(60500)
    expect(c.income).toBe(102000)
    expect(c.net).toBe(41500)
    expect(c.phoneAdded).toBe(3)
    // the Self transfer into HDFC CC is a card payment: counted on the exclude_card basis (website addendum 4)
    expect(c.byCategory.find((x) => x.name === 'Self').amount).toBe(9500)
    expect(c.daily.find((d) => d.date === '2026-10-18').amount).toBe(500)
    expect(c.daily[0].amount).toBe(12000)
    expect(c.topSpends[0].spend_name).toBe('Rent')
  })
  it('a big phone spend enters the top spends and the category chart', () => {
    const c = combinedSummary([mk({ amount: 30000, category: 'Travel', spend_name: 'Flight' })], snap(), NOW)
    expect(c.topSpends[0]).toMatchObject({ spend_name: 'Flight', amount: 30000 })
    expect(c.byCategory[0].name).toBe('Travel')
  })
  it('ignores a snapshot of another month and says which', () => {
    const entries = [mk({ amount: 500 })]
    const c = combinedSummary(entries, snap({ month: '2026-09' }), NOW)
    expect(c.mode).toBe('ignored')
    expect(c.ignoredMonth).toBe('2026-09')
    expect(c.expense).toBe(500)
    expect(snapshotMode(snap({ month: '2026-09' }), NOW)).toBe('ignored')
  })
  it('measures snapshot age in days', () => {
    expect(snapshotAgeDays(snap(), NOW)).toBe(0)
    expect(snapshotAgeDays(snap({ generated_at: '2026-10-14T08:00:00' }), NOW)).toBe(4)
    expect(snapshotAgeDays(null, NOW)).toBeNull()
  })
})

describe('Self budget pace', () => {
  it('uses snapshot spent and budget plus phone additions', () => {
    const c = combinedSummary([mk({ amount: 1000 })], snap(), NOW)
    const p = budgetPace(c, NOW)
    expect(p).toMatchObject({ spent: 5000, budget: 10000, left: 5000, daysToGo: 13, monthPct: 58, usedPct: 50, abovePace: false, over: false })
    const hot = budgetPace(combinedSummary([mk({ amount: 4000 })], snap(), NOW), NOW)
    expect(hot.abovePace).toBe(true)
  })
  it('is absent without a snapshot or a budget', () => {
    expect(budgetPace(combinedSummary([], null, NOW), NOW)).toBeNull()
    expect(budgetPace(combinedSummary([], snap({ by_category: [{ name: 'Self', spent: 1, budget: null }] }), NOW), NOW)).toBeNull()
  })
})

describe('F1/F2/F6 basis, split and grouped top spends', () => {
  const s2 = (o = {}) => snap({
    by_category: [{ name: 'Self', spent: 4000, budget: 10000, basis: 'exclude_card', split: { pluxee: 500, cc: 0, upi: 3000, other: 500 } }],
    accounts: [{ name: 'HDFC CC', kind: 'card', balance: 0 }], ...o,
  })
  it('exclude_card basis ignores CC phone entries and counts card payments', () => {
    const entries = [mk({ mode: 'CC', amount: 900 }), mk({ mode: 'UPI', amount: 300 }), mk({ type: 'Transfer', amount: 700, to_account: 'HDFC CC' })]
    const c = combinedSummary(entries, s2(), NOW)
    expect(c.expense).toBe(60000 + 900 + 300)
    const self = c.byCategory.find((x) => x.name === 'Self')
    expect(self.amount).toBe(5000)
    expect(self.split).toEqual({ pluxee: 500, cc: 0, upi: 3300, other: 1200 })
    expect(budgetPace(c, NOW).spent).toBe(5000)
    expect(budgetPace(c, NOW).split.upi).toBe(3300)
  })
  it('all basis counts CC entries', () => {
    const sn = s2({ by_category: [{ name: 'Self', spent: 4000, budget: 10000, basis: 'all' }] })
    const c = combinedSummary([mk({ mode: 'CC', amount: 900 })], sn, NOW)
    expect(c.byCategory[0].amount).toBe(4900)
  })
  it('groups top spends by name, case-insensitively, with counts', () => {
    const sn = s2({ top_spends: [{ spend_name: 'Swiggy', category: 'Self', amount: 1000, date: '2026-10-02', count: 2 }] })
    const c = combinedSummary([mk({ spend_name: ' swiggy ', amount: 500 }), mk({ spend_name: 'Uber', amount: 100 })], sn, NOW)
    expect(c.topSpends[0]).toMatchObject({ spend_name: 'swiggy', amount: 1500, count: 3, date: '2026-10-18' })
    expect(c.topSpends[1]).toMatchObject({ spend_name: 'Uber', count: 1 })
  })
  it('phone-only top spends are grouped and skip recurring entries', () => {
    const s = monthSummary([mk({ amount: 200 }), mk({ spend_name: 'SWIGGY', amount: 300 }), mk({ spend_name: 'EMI', amount: 9000, source: 'recurring' })], NOW)
    expect(s.topSpends).toHaveLength(1)
    expect(s.topSpends[0]).toMatchObject({ amount: 500, count: 2 })
  })
  it('next tally is exposed on the pace', () => {
    const c = combinedSummary([], s2({ next_tally: { category: 'Self', amount: 823, date: '2026-11-01' } }), NOW)
    expect(budgetPace(c, NOW).nextTally.amount).toBe(823)
  })
})
