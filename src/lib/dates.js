const pad = (n, w = 2) => String(n).padStart(w, '0')
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const MON = MONTHS.map((m) => m.slice(0, 3))
export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const todayStr = (now = new Date()) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
export const monthKey = (dateStr) => String(dateStr).slice(0, 7)
export const currentMonthKey = (now = new Date()) => monthKey(todayStr(now))
export const daysInMonth = (year, month1) => new Date(year, month1, 0).getDate()

export function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s))
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const dt = new Date(y, mo - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null
  return dt
}
export const isValidDate = (s) => parseDate(s) !== null

// Local time without timezone, as in the export contract: 2026-10-18T09:12:00
export const localIso = (now = new Date()) =>
  `${todayStr(now)}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
// 20261018-091200
export const stamp = (now = new Date()) =>
  `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`

// Whole calendar days from a to b (YYYY-MM-DD or ISO strings); negative when b is earlier.
export function daysBetween(a, b) {
  const da = parseDate(String(a).slice(0, 10))
  const db = parseDate(String(b).slice(0, 10))
  if (!da || !db) return 0
  return Math.round((db - da) / 86400000)
}

export const monthTitle = (now = new Date()) => `${MONTHS[now.getMonth()]} ${now.getFullYear()}`
// "1 Nov": the day the Summary resets.
export function resetLabel(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return `1 ${MON[next.getMonth()]}`
}
export function shortDate(s) {
  const d = parseDate(s)
  return d ? `${d.getDate()} ${MON[d.getMonth()]}` : String(s)
}
// "Today, 18 Oct" for the date field
export function dateFieldLabel(s, now = new Date()) {
  return s === todayStr(now) ? `Today, ${shortDate(s)}` : shortDate(s)
}
// "TODAY · SUN 18 OCT" style day header
export function dayHeader(s, now = new Date()) {
  const d = parseDate(s)
  if (!d) return s
  const base = `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`.toUpperCase()
  return s === todayStr(now) ? `TODAY · ${base}` : base
}
export function timeLabel(d) {
  let h = d.getHours()
  const ap = h >= 12 ? 'pm' : 'am'
  h = h % 12 || 12
  return `${h}:${pad(d.getMinutes())} ${ap}`
}
// "Fri 9 Oct, 6:40 pm"
export function dateTimeLabel(iso) {
  const d = new Date(iso)
  if (isNaN(d)) return ''
  return `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}, ${timeLabel(d)}`
}
