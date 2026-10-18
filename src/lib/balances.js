// Account balances and card dues = website snapshot + phone entries the snapshot does not include yet.
// Pure arithmetic on the phone, no network.

const r2 = (n) => Math.round(n * 100) / 100

// Phone entries that are not in the snapshot and are dated on/after the snapshot month start (any later month counts).
export function unsyncedEntries(snapshot, entries) {
  if (!snapshot) return []
  const included = new Set(snapshot.included_phone_entry_ids || [])
  const start = `${snapshot.month}-01`
  return entries.filter((e) => !included.has(e.id) && e.date >= start)
}

// The website rule: spend on day 1..13 is due on the 4th of next month; day 14+ on the 4th of the month after.
export function cardDueDate(dateStr) {
  const y = Number(dateStr.slice(0, 4)), m = Number(dateStr.slice(5, 7)), d = Number(dateStr.slice(8, 10))
  const idx = m - 1 + (d < 14 ? 1 : 2)
  const yy = y + Math.floor(idx / 12)
  const mm = (idx % 12) + 1
  return `${yy}-${String(mm).padStart(2, '0')}-04`
}

// Expense: from_account loses. Income: to_account gains. Transfer: both. Unknown or null accounts are ignored.
// Cards use the same arithmetic (a card spend lowers the balance, i.e. raises what is owed).
export function adjustedBalances(snapshot, entries) {
  if (!snapshot) return { rows: [], syncedCount: 0 }
  const pending = unsyncedEntries(snapshot, entries)
  const known = new Set(snapshot.accounts.map((a) => a.name))
  const delta = new Map()
  let touching = 0
  for (const e of pending) {
    let hit = false
    if (e.from_account && known.has(e.from_account) && e.type !== 'Income') { delta.set(e.from_account, (delta.get(e.from_account) || 0) - e.amount); hit = true }
    if (e.to_account && known.has(e.to_account) && e.type !== 'Expense') { delta.set(e.to_account, (delta.get(e.to_account) || 0) + e.amount); hit = true }
    if (hit) touching++
  }
  const rows = snapshot.accounts.map((a) => {
    const d = r2(delta.get(a.name) || 0)
    return { name: a.name, kind: a.kind, base: a.balance, balance: r2(a.balance + d), delta: d, changed: d !== 0 }
  })
  return { rows, syncedCount: touching }
}

// Card dues: snapshot dues plus card spends from unsynced phone entries (placed on the due date by the rule),
// then transfers into a card pay its earliest open due first, never below 0; any remainder is credit.
// Dues that are zero in the snapshot stay zero (payments only go to dues above 0).
export function adjustedDues(snapshot, entries) {
  if (!snapshot) return { rows: [], credits: [], changed: 0 }
  const cards = new Set(snapshot.accounts.filter((a) => a.kind === 'card').map((a) => a.name))
  const pending = unsyncedEntries(snapshot, entries)
  const rows = snapshot.card_dues.map((c) => ({ card: c.card, due_date: c.due_date, base: c.amount, amount: c.amount, changed: false }))
  let changed = 0

  for (const e of pending) {
    if (e.type !== 'Expense' || !e.from_account || !cards.has(e.from_account)) continue
    const due = cardDueDate(e.date)
    let row = rows.find((r) => r.card === e.from_account && r.due_date === due)
    if (!row) { row = { card: e.from_account, due_date: due, base: 0, amount: 0, changed: true }; rows.push(row) }
    row.amount = r2(row.amount + e.amount); row.changed = true; changed++
  }

  const credit = new Map()
  const payments = pending.filter((e) => e.type === 'Transfer' && e.to_account && cards.has(e.to_account)).sort((a, b) => (a.date < b.date ? -1 : 1))
  for (const e of payments) {
    let left = e.amount
    const open = rows.filter((r) => r.card === e.to_account && r.amount > 0).sort((a, b) => (a.due_date < b.due_date ? -1 : 1))
    for (const r of open) {
      if (left <= 0) break
      const pay = Math.min(left, r.amount)
      r.amount = r2(r.amount - pay); r.changed = true; left = r2(left - pay)
    }
    if (left > 0) credit.set(e.to_account, r2((credit.get(e.to_account) || 0) + left))
    changed++
  }

  rows.sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : a.card.localeCompare(b.card)))
  return { rows, credits: [...credit.entries()].map(([card, amount]) => ({ card, amount })), changed }
}
