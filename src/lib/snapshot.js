import { currentMonthKey, monthKey, daysBetween, todayStr, daysInMonth } from './dates.js'
import { monthSummary, groupSpends } from './summary.js'

// Website summary snapshot (contract v3.0 addendum 3): format "nt-finance-summary" v1, loaded by hand from a file.
export const STALE_SNAPSHOT_DAYS = 3
const r2 = (n) => Math.round(n * 100) / 100
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

export function validateSnapshot(obj) {
  const bad = (error) => ({ ok: false, error, snapshot: null })
  if (!obj || typeof obj !== 'object') return bad('This file is not a website summary.')
  if (obj.format !== 'nt-finance-summary') return bad('This is not a website summary file (wrong format).')
  if (obj.version !== 1) return bad('Unsupported summary version. Update the app.')
  if (typeof obj.month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(obj.month)) return bad('The summary has no valid month.')
  if (typeof obj.generated_at !== 'string' || isNaN(new Date(obj.generated_at))) return bad('The summary has no valid generated_at time.')
  const t = obj.totals
  if (!t || !isNum(t.income) || !isNum(t.expense)) return bad('The summary totals are missing.')
  const arr = (k) => (Array.isArray(obj[k]) ? obj[k] : obj[k] === undefined ? [] : null)
  const by_category = arr('by_category'), daily = arr('daily'), top_spends = arr('top_spends')
  const accounts = arr('accounts'), card_dues = arr('card_dues'), ids = arr('included_phone_entry_ids')
  if ([by_category, daily, top_spends, accounts, card_dues, ids].some((a) => a === null)) return bad('The summary has a malformed list.')
  if (by_category.some((c) => typeof c.name !== 'string' || !isNum(c.spent))) return bad('A category row is malformed.')
  if (daily.some((d) => typeof d.date !== 'string' || !isNum(d.expense))) return bad('A daily row is malformed.')
  if (top_spends.some((e) => typeof e.spend_name !== 'string' || !isNum(e.amount) || typeof e.date !== 'string')) return bad('A top-spend row is malformed.')
  return {
    ok: true,
    error: null,
    snapshot: {
      format: obj.format, version: 1, month: obj.month, generated_at: obj.generated_at, currency: obj.currency || 'INR',
      totals: { income: t.income, expense: t.expense, net: isNum(t.net) ? t.net : r2(t.income - t.expense), savings_rate: t.savings_rate ?? null, prev_same_range: t.prev_same_range ?? null },
      by_category, daily, top_spends, accounts, card_dues, next_tally: obj.next_tally ?? null,
      included_phone_entry_ids: ids.filter((x) => typeof x === 'string'),
    },
  }
}

// Which snapshot to keep when a file is loaded: the newest by generated_at (a tie replaces).
export function pickNewest(current, incoming) {
  if (!current) return incoming
  return new Date(incoming.generated_at) >= new Date(current.generated_at) ? incoming : current
}

// 'phone' = no snapshot, 'ignored' = snapshot of another month (phone only, with a note), 'website' = combined.
export function snapshotMode(snapshot, now = new Date()) {
  if (!snapshot) return 'phone'
  return snapshot.month === currentMonthKey(now) ? 'website' : 'ignored'
}
export function snapshotAgeDays(snapshot, now = new Date()) {
  return snapshot ? daysBetween(snapshot.generated_at, todayStr(now)) : null
}

// Combined month figures. Phone entries already inside the snapshot (by id) are not added again; Transfers are ignored.
export function combinedSummary(entries, snapshot, now = new Date()) {
  const mode = snapshotMode(snapshot, now)
  const phone = monthSummary(entries, now)
  if (mode !== 'website') {
    return { ...phone, mode, hasData: phone.count > 0, phoneAdded: phone.count, snapshot: null, ignoredMonth: mode === 'ignored' ? snapshot.month : null }
  }
  const mk = currentMonthKey(now)
  const included = new Set(snapshot.included_phone_entry_ids)
  const extra = entries.filter((e) => monthKey(e.date) === mk && !included.has(e.id))
  const ex = monthSummary(extra, now)

  const expense = r2(snapshot.totals.expense + ex.expense)
  const income = r2(snapshot.totals.income + ex.income)
  const net = r2(income - expense)

  const cardNames = new Set([
    ...snapshot.accounts.filter((a) => a.kind === 'card').map((a) => a.name),
    ...snapshot.card_dues.map((d) => d.card),
  ])
  const cats = new Map()
  for (const c of snapshot.by_category) {
    cats.set(c.name, { name: c.name, amount: c.spent, budget: c.budget ?? null, basis: c.basis || 'all', split: c.split && typeof c.split === 'object' ? { ...c.split } : null })
  }
  // Phone additions count toward a category on its own basis: on exclude_card, CC swipes are left out and card payments
  // (Transfers into a card account) are counted instead, as the website does.
  for (const e of extra) {
    if (e.type !== 'Expense' && e.type !== 'Transfer') continue
    const cur = cats.get(e.category) || { name: e.category, amount: 0, budget: null, basis: 'all', split: null }
    const exCard = cur.basis === 'exclude_card'
    let bucket = null
    if (e.type === 'Expense') {
      if (exCard && e.mode === 'CC') continue
      bucket = e.from_account === 'Pluxee' ? 'pluxee' : e.mode === 'CC' ? 'cc' : e.mode === 'UPI' ? 'upi' : 'other'
    } else {
      if (!exCard || !e.category || !cardNames.has(e.to_account)) continue
      bucket = 'other'
    }
    const split = cur.split ? { ...cur.split, [bucket]: r2((cur.split[bucket] || 0) + e.amount) } : null
    cats.set(e.category, { ...cur, amount: r2(cur.amount + e.amount), split })
  }
  const catTotal = [...cats.values()].reduce((t, c) => t + c.amount, 0)
  const byCategory = [...cats.values()].filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
    .map((c) => ({ ...c, pct: catTotal > 0 ? Math.round((c.amount / catTotal) * 100) : 0 }))

  const dayOfMonth = now.getDate()
  const dayMap = new Map()
  for (const d of snapshot.daily) dayMap.set(d.date, (dayMap.get(d.date) || 0) + d.expense)
  for (const d of ex.daily) dayMap.set(d.date, r2((dayMap.get(d.date) || 0) + d.amount))
  const lastDay = Math.max(dayOfMonth, ...[...dayMap.keys()].filter((k) => k.startsWith(mk)).map((k) => Number(k.slice(8, 10))))
  const daily = []
  for (let d = 1; d <= Math.min(lastDay, daysInMonth(now.getFullYear(), now.getMonth() + 1)); d++) {
    const date = `${mk}-${String(d).padStart(2, '0')}`
    daily.push({ day: d, date, amount: r2(dayMap.get(date) || 0) })
  }

  const top = groupSpends([
    ...snapshot.top_spends.map((t) => ({ spend_name: t.spend_name, category: t.category, amount: t.amount, date: t.date, count: t.count })),
    ...extra.filter((e) => e.type === 'Expense'),
  ])

  return {
    ...phone,
    mode, snapshot, ignoredMonth: null,
    hasData: true,
    phoneAdded: ex.count,
    expense, income, net,
    keptPct: income > 0 ? Math.round((net / income) * 100) : null,
    avgPerDay: r2(expense / dayOfMonth),
    byCategory, daily, topSpends: top,
  }
}

// Self budget pace (read from the combined category figure and the snapshot budget).
export function budgetPace(summary, now = new Date(), name = 'Self') {
  const c = summary.byCategory.find((x) => x.name === name) || summary.snapshot?.by_category?.find((x) => x.name === name)
  const budget = c?.budget ?? summary.snapshot?.by_category?.find((x) => x.name === name)?.budget ?? null
  if (!summary.snapshot || budget === null || budget === undefined || budget <= 0) return null
  const spent = c?.amount ?? c?.spent ?? 0
  const dim = daysInMonth(now.getFullYear(), now.getMonth() + 1)
  const day = now.getDate()
  const monthPct = Math.round((day / dim) * 100)
  const usedPct = Math.round((spent / budget) * 100)
  const split = c?.split || null
  return { name, spent, budget, split, basis: c?.basis || 'all', nextTally: summary.snapshot.next_tally?.category === name ? summary.snapshot.next_tally : null, left: r2(budget - spent), over: spent > budget, daysToGo: dim - day, monthPct, usedPct, abovePace: spent / budget > day / dim }
}
