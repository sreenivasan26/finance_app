import { currentMonthKey, monthKey, todayStr, MON, monthTitle, resetLabel, daysInMonth } from './dates.js'

const r2 = (n) => Math.round(n * 100) / 100

// Summary = the current calendar month only, from phone entries. Transfers never count. It resets on the 1st
// by itself because the month key moves on.
export function monthSummary(entries, now = new Date()) {
  const mk = currentMonthKey(now)
  const inMonth = entries.filter((e) => monthKey(e.date) === mk)
  const expenses = inMonth.filter((e) => e.type === 'Expense')
  const incomes = inMonth.filter((e) => e.type === 'Income')
  const sum = (arr) => r2(arr.reduce((t, e) => t + e.amount, 0))
  const expense = sum(expenses)
  const income = sum(incomes)
  const net = r2(income - expense)

  const catMap = new Map()
  for (const e of expenses) catMap.set(e.category, (catMap.get(e.category) || 0) + e.amount)
  const byCategory = [...catMap.entries()]
    .map(([name, amount]) => ({ name, amount: r2(amount) }))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
    .map((c) => ({ ...c, pct: expense > 0 ? Math.round((c.amount / expense) * 100) : 0 }))

  const dayOfMonth = now.getDate()
  const lastDay = Math.max(dayOfMonth, ...inMonth.map((e) => Number(e.date.slice(8, 10))))
  const daily = []
  for (let d = 1; d <= Math.min(lastDay, daysInMonth(now.getFullYear(), now.getMonth() + 1)); d++) {
    const date = `${mk}-${String(d).padStart(2, '0')}`
    daily.push({ day: d, date, amount: sum(expenses.filter((e) => e.date === date)) })
  }
  const topSpends = [...expenses].sort((a, b) => b.amount - a.amount || (a.date < b.date ? 1 : -1)).slice(0, 5)

  return {
    month: mk,
    title: monthTitle(now),
    count: inMonth.length,
    expense,
    income,
    net,
    keptPct: income > 0 ? Math.round((net / income) * 100) : null,
    avgPerDay: r2(expense / dayOfMonth),
    byCategory,
    daily,
    topSpends,
    today: todayStr(now),
    dayOfMonth,
    range: `1 to ${dayOfMonth} ${MON[now.getMonth()]}`,
    resetsOn: resetLabel(now),
  }
}

// Bars above the cap are clipped and labelled. cap = about twice the 75th percentile of spending days, min 500.
export function dailyCap(daily) {
  const vals = daily.map((d) => d.amount).filter((v) => v > 0).sort((a, b) => a - b)
  if (!vals.length) return 500
  const p75 = vals[Math.floor((vals.length - 1) * 0.75)]
  const cap = Math.max(500, Math.ceil((p75 * 2) / 500) * 500)
  const max = vals[vals.length - 1]
  return max > cap ? cap : Math.max(500, Math.ceil(max / 500) * 500)
}
