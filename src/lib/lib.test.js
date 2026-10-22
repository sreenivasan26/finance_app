import { describe, it, expect } from 'vitest'
import { formatINR, groupIndian, sanitizeAmountInput, groupAmountInput, fitAmount } from './format.js'
import { monthSummary, dailyCap } from './summary.js'
import { validateEntry, parseAmount, uuid4 } from './validation.js'
import { buildExport, clearExported, clearableEntries, exportStatus, markExported, EXPORT_FIELDS } from './exporter.js'
import { stamp, dayHeader, daysBetween } from './dates.js'

const NOW = new Date(2026, 9, 18, 9, 12, 0) // 18 Oct 2026 09:12 local
const lists = { accounts: ['HDFC', 'CUB', 'Self', 'HDFC CC', 'AMEX CC', 'Pluxee'], categories: ['Self', 'Home', 'Office', 'Savings', 'Travel'] }
let n = 0
const mk = (o) => ({
  id: 'id' + ++n, date: '2026-10-05', category: 'Home', spend_name: 'Rent', amount: 100, type: 'Expense',
  from_account: 'HDFC', to_account: null, mode: 'UPI', comment: '', created_at: '2026-10-05T10:00:00', ...o,
})

describe('Indian formatting', () => {
  it('groups digits 3 then 2', () => {
    expect(groupIndian('1234567')).toBe('12,34,567')
    expect(groupIndian('999')).toBe('999')
    expect(groupIndian('1000')).toBe('1,000')
    expect(groupIndian('100000')).toBe('1,00,000')
  })
  it('formats INR with paise only when present', () => {
    expect(formatINR(38730)).toBe('₹38,730')
    expect(formatINR(467.75)).toBe('₹467.75')
    expect(formatINR(1234567.5)).toBe('₹12,34,567.50')
    expect(formatINR(0)).toBe('₹0')
    expect(formatINR(-1467.75)).toBe('−₹1,467.75')
    expect(formatINR(2900, { sign: true })).toBe('+₹2,900')
    expect(formatINR(5, { decimals: 2 })).toBe('₹5.00')
  })
  it('sanitises the amount box', () => {
    expect(sanitizeAmountInput('12a3.456.7')).toBe('123.45')
    expect(sanitizeAmountInput('007')).toBe('7')
    expect(groupAmountInput('1234567.5')).toBe('12,34,567.5')
  })
})

describe('month summary', () => {
  const entries = [
    mk({ date: '2026-10-01', category: 'Home', amount: 12000 }),
    mk({ date: '2026-10-05', category: 'Savings', amount: 8000 }),
    mk({ date: '2026-10-18', category: 'Home', amount: 640 }),
    mk({ date: '2026-10-10', type: 'Income', amount: 85000, from_account: null, to_account: 'HDFC' }),
    mk({ date: '2026-10-12', type: 'Transfer', amount: 20000, to_account: 'HDFC CC' }),
    mk({ date: '2026-09-30', amount: 99999 }), // last month: excluded
  ]
  const s = monthSummary(entries, NOW)
  it('counts only the current month, excludes transfers from spend and income', () => {
    expect(s.expense).toBe(20640)
    expect(s.income).toBe(85000)
    expect(s.net).toBe(64360)
    expect(s.count).toBe(5)
    expect(s.keptPct).toBe(76)
  })
  it('computes category shares, average per day, daily series and reset date', () => {
    expect(s.byCategory[0]).toMatchObject({ name: 'Home', amount: 12640, pct: 61 })
    expect(s.avgPerDay).toBe(1146.67)
    expect(s.daily).toHaveLength(18)
    expect(s.daily[0].amount).toBe(12000)
    expect(s.resetsOn).toBe('1 Nov')
    expect(s.topSpends[0]).toMatchObject({ amount: 20640, count: 3 }) // same spend_name in the fixture, so grouped
  })
  it('resets on the 1st: the same entries give an empty month in November', () => {
    const nov = monthSummary(entries, new Date(2026, 10, 1, 8, 0, 0))
    expect(nov.expense).toBe(0)
    expect(nov.count).toBe(0)
    expect(nov.keptPct).toBeNull()
    expect(nov.byCategory).toEqual([])
  })
  it('clips daily bars at a cap', () => {
    const days = [200, 300, 250, 400, 12400, 350, 100, 8000].map((amount, i) => ({ day: i + 1, amount }))
    expect(dailyCap(days)).toBe(1000) // p75 = 400 -> cap 1000: the 12.4k and 8k bars are clipped
    expect(dailyCap([{ amount: 700 }])).toBe(1000)
    expect(dailyCap([])).toBe(500)
  })
})

describe('validation', () => {
  const ok = { type: 'Expense', amount: '467.75', date: '2026-10-18', category: 'Self', spend_name: ' Swiggy ', mode: 'CC', from_account: 'HDFC CC', to_account: 'HDFC', comment: '' }
  it('accepts a valid expense and normalises it', () => {
    const r = validateEntry(ok, lists)
    expect(r.ok).toBe(true)
    expect(r.entry).toMatchObject({ amount: 467.75, spend_name: 'Swiggy', from_account: 'HDFC CC', to_account: null })
  })
  it('rejects amount <= 0 or not a number, bad date, unknown category/account', () => {
    expect(validateEntry({ ...ok, amount: '0' }, lists).errors.amount).toBeTruthy()
    expect(validateEntry({ ...ok, amount: '' }, lists).errors.amount).toBeTruthy()
    expect(validateEntry({ ...ok, amount: '-5' }, lists).errors.amount).toBeTruthy()
    expect(validateEntry({ ...ok, date: '2026-02-30' }, lists).errors.date).toBeTruthy()
    expect(validateEntry({ ...ok, category: 'Nope' }, lists).errors.category).toBeTruthy()
    expect(validateEntry({ ...ok, from_account: 'Nope' }, lists).errors.from_account).toBeTruthy()
    expect(validateEntry({ ...ok, spend_name: '  ' }, lists).errors.spend_name).toBeTruthy()
    expect(validateEntry({ ...ok, mode: 'Cash' }, lists).errors.mode).toBeTruthy()
  })
  it('Transfer needs a tracked To account and two different accounts', () => {
    const t = { ...ok, type: 'Transfer', from_account: 'HDFC', to_account: null }
    expect(validateEntry(t, lists).errors.to_account).toBeTruthy()
    const fromOutside = validateEntry({ ...t, from_account: null, to_account: 'HDFC CC' }, lists)
    expect(fromOutside.ok).toBe(true)
    expect(fromOutside.entry).toMatchObject({ from_account: null, to_account: 'HDFC CC', type: 'Transfer' })
    expect(validateEntry({ ...t, from_account: null, to_account: null }, lists).errors.to_account).toBeTruthy() // Outside to Outside
    expect(validateEntry({ ...t, to_account: 'HDFC' }, lists).errors.to_account).toMatch(/different/)
    expect(validateEntry({ ...t, to_account: 'HDFC CC' }, lists).ok).toBe(true)
  })
  it('Income drops from_account', () => {
    expect(validateEntry({ ...ok, type: 'Income', to_account: 'HDFC' }, lists).entry.from_account).toBeNull()
  })
  it('parses amounts and makes uuid4 ids', () => {
    expect(parseAmount('1,234.5')).toBe(1234.5)
    expect(parseAmount('abc')).toBeNaN()
    expect(uuid4()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})

describe('export', () => {
  const a = mk({ date: '2026-09-20' })
  const b = mk({ date: '2026-10-02' })
  const c = mk({ date: '2026-10-17', comment: undefined })
  it('has the exact contract shape and file name', () => {
    const x = buildExport([c, a, b], [], NOW)
    expect(x.filename).toBe('finance-capture-20261018-091200.json')
    expect(Object.keys(x.payload)).toEqual(['format', 'version', 'device', 'exported_at', 'entries'])
    expect(x.payload).toMatchObject({ format: 'nt-finance-capture', version: 1, device: 'iphone', exported_at: '2026-10-18T09:12:00' })
    expect(x.payload.entries.map((e) => e.id)).toEqual([a.id, b.id, c.id])
    expect(Object.keys(x.payload.entries[0])).toEqual(EXPORT_FIELDS)
    expect(x.payload.entries[2].comment).toBe('')
    expect(JSON.parse(x.json)).toEqual(x.payload)
  })
  it('exports only entries not exported yet and records them', () => {
    const meta = markExported({ exportedIds: [] }, [a.id], NOW)
    expect(meta.lastExport).toBe('2026-10-18T09:12:00')
    const x = buildExport([a, b, c], meta.exportedIds, NOW)
    expect(x.ids).toEqual([b.id, c.id])
    expect(stamp(NOW)).toBe('20261018-091200')
  })
  it('clear exported removes only exported entries dated before this month', () => {
    const all = [a, b, c]
    const exported = [a.id, b.id]
    expect(clearableEntries(all, exported, NOW).map((e) => e.id)).toEqual([a.id])
    const r = clearExported(all, exported, NOW)
    expect(r.entries.map((e) => e.id)).toEqual([b.id, c.id]) // current-month b stays even though exported
    expect(r.exportedIds).toEqual([b.id])
    expect(r.removed).toBe(1)
    // The Summary never changes from clearing
    expect(monthSummary(r.entries, NOW)).toEqual(monthSummary(all, NOW))
  })
  it('never removes unexported entries, even from earlier months', () => {
    expect(clearExported([a], [], NOW).entries).toEqual([a])
  })
})

describe('warning and badge status', () => {
  const e1 = mk({ date: '2026-10-17' })
  it('warns when something is unexported', () => {
    const s = exportStatus([e1], { exportedIds: [], lastExport: '2026-10-18T08:00:00' }, NOW)
    expect(s).toMatchObject({ unexported: 1, warn: true })
  })
  it('is good when all exported within 7 days', () => {
    const s = exportStatus([e1], { exportedIds: [e1.id], lastExport: '2026-10-11T08:00:00' }, NOW)
    expect(s).toMatchObject({ unexported: 0, daysSince: 7, warn: false })
  })
  it('warns when the last export is older than 7 days', () => {
    const s = exportStatus([e1], { exportedIds: [e1.id], lastExport: '2026-10-09T18:40:00' }, NOW)
    expect(s).toMatchObject({ daysSince: 9, stale: true, warn: true })
  })
  it('does not nag on an empty phone', () => {
    expect(exportStatus([], { exportedIds: [], lastExport: null }, NOW).warn).toBe(false)
  })
})

describe('dates', () => {
  it('labels days', () => {
    expect(dayHeader('2026-10-18', NOW)).toBe('TODAY · SUN 18 OCT')
    expect(dayHeader('2026-10-17', NOW)).toBe('SAT 17 OCT')
    expect(daysBetween('2026-10-09T18:40:00', '2026-10-18')).toBe(9)
  })
})

describe('hero amount fitting', () => {
  it('keeps short figures large with paise when they fit', () => {
    expect(fitAmount(38730)).toEqual({ text: '₹38,730', size: 28 })
    expect(fitAmount(467.75)).toEqual({ text: '₹467.75', size: 28 })
    expect(fitAmount(95097.25)).toEqual({ text: '₹95,097.25', size: 24 })
  })
  it('drops paise and steps the font down for 7 and 8 figure values', () => {
    expect(fitAmount(1234567.89)).toEqual({ text: '₹12,34,568', size: 24 })
    expect(fitAmount(12345678.9)).toEqual({ text: '₹1,23,45,679', size: 20 })
    expect(fitAmount(1234567890)).toEqual({ text: '₹1,23,45,67,890', size: 17 })
  })
})
