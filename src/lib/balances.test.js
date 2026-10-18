import { describe, it, expect } from 'vitest'
import { adjustedBalances, adjustedDues, cardDueDate, unsyncedEntries } from './balances.js'

const snap = (o = {}) => ({
  month: '2026-10', included_phone_entry_ids: ['inc1'],
  accounts: [{ name: 'HDFC', kind: 'bank', balance: 10000 }, { name: 'CUB', kind: 'bank', balance: 500 }, { name: 'HDFC CC', kind: 'card', balance: -3000 }],
  card_dues: [{ card: 'HDFC CC', due_date: '2026-11-04', amount: 3000 }], ...o,
})
let n = 0
const mk = (o) => ({ id: 'e' + ++n, date: '2026-10-18', category: 'Self', spend_name: 'x', amount: 100, type: 'Expense', from_account: 'HDFC', to_account: null, ...o })

describe('balance arithmetic', () => {
  it('expense subtracts from from_account', () => {
    const r = adjustedBalances(snap(), [mk({ amount: 250 })])
    expect(r.rows.find((x) => x.name === 'HDFC')).toMatchObject({ balance: 9750, changed: true, delta: -250 })
    expect(r.rows.find((x) => x.name === 'CUB').changed).toBe(false)
    expect(r.syncedCount).toBe(1)
  })
  it('income adds to to_account', () => {
    const r = adjustedBalances(snap(), [mk({ type: 'Income', from_account: null, to_account: 'CUB', amount: 4000 })])
    expect(r.rows.find((x) => x.name === 'CUB').balance).toBe(4500)
  })
  it('transfer moves money between both accounts', () => {
    const r = adjustedBalances(snap(), [mk({ type: 'Transfer', from_account: 'HDFC', to_account: 'HDFC CC', amount: 3000 })])
    expect(r.rows.find((x) => x.name === 'HDFC').balance).toBe(7000)
    expect(r.rows.find((x) => x.name === 'HDFC CC').balance).toBe(0)
    expect(r.syncedCount).toBe(1)
  })
  it('a card spend lowers the card balance (more owed)', () => {
    const r = adjustedBalances(snap(), [mk({ from_account: 'HDFC CC', amount: 1200 })])
    expect(r.rows.find((x) => x.name === 'HDFC CC').balance).toBe(-4200)
  })
  it('ignores unknown or null accounts', () => {
    const r = adjustedBalances(snap(), [mk({ from_account: 'Nowhere' }), mk({ from_account: null })])
    expect(r.rows.every((x) => !x.changed)).toBe(true)
    expect(r.syncedCount).toBe(0)
  })
  it('skips entries already in the snapshot and entries before the snapshot month; counts later months', () => {
    const entries = [mk({ id: 'inc1', amount: 999 }), mk({ date: '2026-09-30', amount: 777 }), mk({ date: '2026-11-02', amount: 50 })]
    expect(unsyncedEntries(snap(), entries)).toHaveLength(1)
    expect(adjustedBalances(snap(), entries).rows.find((x) => x.name === 'HDFC').balance).toBe(9950)
  })
  it('without a snapshot there is nothing', () => {
    expect(adjustedBalances(null, [mk()])).toEqual({ rows: [], syncedCount: 0 })
    expect(adjustedDues(null, [mk()])).toEqual({ rows: [], credits: [], changed: 0 })
  })
})

describe('card due date rule', () => {
  it('day 13 is due next month, day 14 the month after', () => {
    expect(cardDueDate('2026-10-13')).toBe('2026-11-04')
    expect(cardDueDate('2026-10-14')).toBe('2026-12-04')
    expect(cardDueDate('2026-10-01')).toBe('2026-11-04')
  })
  it('rolls the year in December and November', () => {
    expect(cardDueDate('2026-12-13')).toBe('2027-01-04')
    expect(cardDueDate('2026-12-14')).toBe('2027-02-04')
    expect(cardDueDate('2026-11-20')).toBe('2027-01-04')
  })
})

describe('card dues', () => {
  it('adds a card spend to the due on its computed date, creating a row when needed', () => {
    const r = adjustedDues(snap(), [mk({ from_account: 'HDFC CC', amount: 500, date: '2026-10-10' }), mk({ from_account: 'HDFC CC', amount: 700, date: '2026-10-20' })])
    expect(r.rows.find((x) => x.due_date === '2026-11-04')).toMatchObject({ amount: 3500, changed: true })
    expect(r.rows.find((x) => x.due_date === '2026-12-04')).toMatchObject({ amount: 700, base: 0 })
  })
  it('does not add spends from non-card accounts or entries already included', () => {
    const r = adjustedDues(snap(), [mk({ from_account: 'HDFC', amount: 500 }), mk({ id: 'inc1', from_account: 'HDFC CC', amount: 900 })])
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0].amount).toBe(3000)
    expect(r.changed).toBe(0)
  })
  it('a payment into the card pays the earliest open due first', () => {
    const s = snap({ card_dues: [{ card: 'HDFC CC', due_date: '2026-12-04', amount: 2000 }, { card: 'HDFC CC', due_date: '2026-11-04', amount: 3000 }] })
    const r = adjustedDues(s, [mk({ type: 'Transfer', from_account: 'HDFC', to_account: 'HDFC CC', amount: 3500 })])
    expect(r.rows.map((x) => [x.due_date, x.amount])).toEqual([['2026-11-04', 0], ['2026-12-04', 1500]])
    expect(r.credits).toEqual([])
  })
  it('the remainder after all dues is shown as credit, never below 0', () => {
    const r = adjustedDues(snap(), [mk({ type: 'Transfer', from_account: 'HDFC', to_account: 'HDFC CC', amount: 3800 })])
    expect(r.rows[0].amount).toBe(0)
    expect(r.credits).toEqual([{ card: 'HDFC CC', amount: 800 }])
  })
  it('snapshot dues that are zero stay zero (a payment becomes credit)', () => {
    const s = snap({ card_dues: [{ card: 'HDFC CC', due_date: '2026-11-04', amount: 0 }] })
    const r = adjustedDues(s, [mk({ type: 'Transfer', from_account: 'HDFC', to_account: 'HDFC CC', amount: 100 })])
    expect(r.rows[0].amount).toBe(0)
    expect(r.credits).toEqual([{ card: 'HDFC CC', amount: 100 }])
  })
  it('a payment also settles a new spend made on the phone', () => {
    const r = adjustedDues(snap({ card_dues: [] }), [mk({ from_account: 'HDFC CC', amount: 400, date: '2026-10-05' }), mk({ type: 'Transfer', from_account: 'HDFC', to_account: 'HDFC CC', amount: 400 })])
    expect(r.rows[0].amount).toBe(0)
    expect(r.credits).toEqual([])
  })
  it('only cards (accounts kind card) take payments', () => {
    const r = adjustedDues(snap(), [mk({ type: 'Transfer', from_account: 'HDFC', to_account: 'CUB', amount: 100 })])
    expect(r.rows[0].amount).toBe(3000)
    expect(r.credits).toEqual([])
  })
})
