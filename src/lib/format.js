// Indian digit grouping (12,34,567) and INR formatting. Pure, no Intl dependency.
export function groupIndian(intStr) {
  const s = String(intStr)
  if (s.length <= 3) return s
  const last3 = s.slice(-3)
  const rest = s.slice(0, -3)
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3
}

// formatINR(38730) -> "₹38,730"; formatINR(467.75) -> "₹467.75"; decimals only when the value has paise.
// opts.sign: prefix "+" for positive (negative always gets a real minus). opts.decimals: force 0 or 2.
export function formatINR(value, opts = {}) {
  const n = Math.round(Number(value) * 100) / 100
  const neg = n < 0
  const abs = Math.abs(n)
  const whole = Math.floor(abs + 1e-9)
  const paise = Math.round((abs - whole) * 100)
  const showDec = opts.decimals === 2 || (opts.decimals !== 0 && paise !== 0)
  let body = groupIndian(String(whole))
  if (showDec) body += '.' + String(paise).padStart(2, '0')
  let sign = ''
  if (neg) sign = '−'
  else if (opts.sign && n > 0) sign = '+'
  return `${sign}₹${body}`
}

// Compact label for chart overflow ("12.4k").
export function compactK(n) {
  if (n < 1000) return String(Math.round(n))
  return Math.round((n / 1000) * 10) / 10 + 'k'
}

// Cleans what the user types in the amount box: digits and one dot, max 2 decimals.
export function sanitizeAmountInput(raw) {
  let s = String(raw).replace(/[^\d.]/g, '')
  const i = s.indexOf('.')
  if (i >= 0) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '').slice(0, 2)
  s = s.replace(/^0+(?=\d)/, '')
  return s.slice(0, 12)
}

// Display of the in-progress amount with Indian grouping ("1,23,456.7").
export function groupAmountInput(s) {
  if (!s) return ''
  const [i, d] = s.split('.')
  return groupIndian(i || '0') + (d !== undefined ? '.' + d : '')
}

// Fits a rupee figure into a half-width hero column: paise are dropped when the text would be too wide,
// then the font steps down with the length. Returns { text, size } (size in px).
export function fitAmount(value) {
  const full = formatINR(value)
  const text = full.length <= 10 ? full : formatINR(Math.round(value), { decimals: 0 })
  const n = text.length
  const size = n <= 8 ? 28 : n <= 10 ? 24 : n <= 12 ? 20 : 17
  return { text, size }
}
