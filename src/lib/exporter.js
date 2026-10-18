import { localIso, stamp, currentMonthKey, monthKey, daysBetween, todayStr } from './dates.js'

export const EXPORT_FIELDS = ['id', 'date', 'category', 'spend_name', 'amount', 'type', 'from_account', 'to_account', 'mode', 'comment', 'created_at']
export const WARN_AFTER_DAYS = 7

export const unexportedEntries = (entries, exportedIds) => {
  const set = new Set(exportedIds)
  return entries.filter((e) => !set.has(e.id))
}

// Builds the export file (contract: "Export file format"). Only entries not exported yet are included.
export function buildExport(entries, exportedIds, now = new Date()) {
  const list = unexportedEntries(entries, exportedIds)
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.created_at < b.created_at ? -1 : 1))
    .map((e) => Object.fromEntries(EXPORT_FIELDS.map((k) => [k, e[k] ?? (k === 'comment' ? '' : null)])))
  const payload = { format: 'nt-finance-capture', version: 1, device: 'iphone', exported_at: localIso(now), entries: list }
  return {
    filename: `finance-capture-${stamp(now)}.json`,
    payload,
    json: JSON.stringify(payload, null, 2),
    ids: list.map((e) => e.id),
  }
}

// After a successful export: remember the date and which entries were in the file.
export function markExported(meta, ids, now = new Date()) {
  return { ...meta, lastExport: localIso(now), exportedIds: [...new Set([...(meta.exportedIds || []), ...ids])] }
}

// "Clear exported" (user decision 2026-10-18): only exported entries dated BEFORE the current month go.
// Current-month entries always stay, so the Summary never changes.
export function clearableEntries(entries, exportedIds, now = new Date()) {
  const mk = currentMonthKey(now)
  const set = new Set(exportedIds)
  return entries.filter((e) => set.has(e.id) && monthKey(e.date) < mk)
}
export function clearExported(entries, exportedIds, now = new Date()) {
  const gone = new Set(clearableEntries(entries, exportedIds, now).map((e) => e.id))
  return {
    entries: entries.filter((e) => !gone.has(e.id)),
    exportedIds: exportedIds.filter((id) => !gone.has(id)),
    removed: gone.size,
  }
}

// Everything the Export tab and the banner need.
export function exportStatus(entries, meta, now = new Date()) {
  const exportedIds = meta.exportedIds || []
  const existing = new Set(entries.map((e) => e.id))
  const exportedCount = exportedIds.filter((id) => existing.has(id)).length
  const unexported = entries.length - exportedCount
  const daysSince = meta.lastExport ? daysBetween(meta.lastExport, todayStr(now)) : null
  const stale = daysSince !== null && daysSince > WARN_AFTER_DAYS
  // Nothing on the phone means nothing at risk, so an old export date alone does not nag.
  const warn = unexported > 0 || (stale && entries.length > 0)
  return {
    unexported,
    exportedCount,
    total: entries.length,
    lastExport: meta.lastExport || null,
    daysSince,
    stale,
    warn,
    clearable: clearableEntries(entries, exportedIds, now).length,
  }
}
