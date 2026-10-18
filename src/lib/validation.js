import { isValidDate } from './dates.js'

export const TYPES = ['Expense', 'Income', 'Transfer']
export const MODES = ['UPI', 'CC', 'Other'] // fixed by the export contract (mode enum)

// Amount from a typed string or number, rounded to paise; NaN when not a number.
export function parseAmount(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) / 100 : NaN
  const s = String(v ?? '').replace(/,/g, '').trim()
  if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return NaN
  return Math.round(parseFloat(s) * 100) / 100
}

// Validates a form draft like the contract: amount > 0, real date, known lists. A Transfer needs a tracked To account;
// From may be Outside (null) for refunds and the like, but not equal to To.
// Returns { ok, errors, entry } where entry is the normalised record (without id / created_at).
export function validateEntry(draft, { accounts = [], categories = [] } = {}) {
  const errors = {}
  const type = draft.type
  if (!TYPES.includes(type)) errors.type = 'Choose Expense, Income or Transfer.'
  const amount = parseAmount(draft.amount)
  if (!(amount > 0)) errors.amount = 'Enter an amount above 0.'
  if (!isValidDate(draft.date)) errors.date = 'Pick a valid date.'
  const category = String(draft.category ?? '').trim()
  if (!category) errors.category = 'Choose a category.'
  else if (!categories.includes(category)) errors.category = 'Unknown category.'
  const spend_name = String(draft.spend_name ?? '').trim()
  if (!spend_name) errors.spend_name = 'Enter what it was for.'
  if (!MODES.includes(draft.mode)) errors.mode = 'Choose UPI, CC or Other.'

  let from = draft.from_account || null
  let to = draft.to_account || null
  if (type === 'Expense') to = null
  if (type === 'Income') from = null
  if (type === 'Transfer') {
    if (!to) errors.to_account = 'Choose the tracked account the money goes to.'
    if (from && to && from === to) errors.to_account = 'From and to must be different accounts.'
  }
  if (from && !accounts.includes(from)) errors.from_account = 'Unknown account.'
  if (to && !accounts.includes(to)) errors.to_account = 'Unknown account.'

  const ok = Object.keys(errors).length === 0
  return {
    ok,
    errors,
    entry: ok
      ? { date: draft.date, category, spend_name, amount, type, from_account: from, to_account: to, mode: draft.mode, comment: String(draft.comment ?? '').trim() }
      : null,
  }
}

export function uuid4() {
  const c = globalThis.crypto
  if (c?.randomUUID) return c.randomUUID()
  const b = new Uint8Array(16)
  if (c?.getRandomValues) c.getRandomValues(b)
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
