// Spend-name lists: per category, editable, with defaults from seed.js. Pure logic (tested in names.test.js).

const key = (s) => String(s).trim().toLowerCase()

// Every distinct name across all categories, in first-seen order.
export function globalNames(names) {
  const seen = new Set()
  const out = []
  for (const list of Object.values(names || {})) {
    for (const n of list) if (!seen.has(key(n))) { seen.add(key(n)); out.push(n) }
  }
  return out
}

// Options for the picker: (1) names used in this category, most used first (ties keep list order),
// (2) the category's own list, (3) the rest of the global list. Case-insensitive de-duplication.
// `query` filters by substring (case-insensitive) but keeps the order.
export function nameOptions(category, entries, names, query = '') {
  const own = (names && names[category]) || []
  const rank = new Map()
  ;[...own, ...globalNames(names)].forEach((n, i) => { if (!rank.has(key(n))) rank.set(key(n), i) })
  const counts = new Map() // key -> {name, n}
  for (const e of entries) {
    if (e.category !== category || !e.spend_name) continue
    const k = key(e.spend_name)
    const c = counts.get(k) || { name: e.spend_name.trim(), n: 0 }
    c.n++
    counts.set(k, c)
  }
  const used = [...counts.entries()]
    .sort((a, b) => b[1].n - a[1].n || (rank.get(a[0]) ?? 1e9) - (rank.get(b[0]) ?? 1e9) || a[1].name.localeCompare(b[1].name))
    .map(([, c]) => resolveName(c.name, [...own, ...globalNames(names)]))
  const seen = new Set()
  const out = []
  for (const n of [...used, ...own, ...globalNames(names)]) {
    if (!seen.has(key(n))) { seen.add(key(n)); out.push(n) }
  }
  const q = key(query)
  return q ? out.filter((n) => key(n).includes(q)) : out
}

// Resolves typed text to an existing name (case-insensitive, trimmed) or the trimmed text itself.
export function resolveName(text, existing) {
  const t = String(text).trim()
  return existing.find((n) => key(n) === key(t)) ?? t
}

// "+ Add new" is offered only for non-empty text that matches no existing name.
export function canAddNew(text, options) {
  const t = String(text).trim()
  return t.length > 0 && !options.some((n) => key(n) === key(t))
}

// Adds a name to the category's list (no duplicate); returns { names, name } where name is the canonical spelling.
export function addName(names, category, text) {
  const t = String(text).trim()
  if (!t) return { names, name: '' }
  const resolved = resolveName(t, globalNames(names))
  const own = names[category] || []
  if (own.some((n) => key(n) === key(resolved))) return { names, name: resolved }
  return { names: { ...names, [category]: [...own, resolved] }, name: resolved }
}
