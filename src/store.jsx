import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import * as db from './lib/db.js'
import { SEED_ACCOUNTS, SEED_CATEGORIES, SEED_NAMES, DEFAULT_META } from './lib/seed.js'
import { uuid4 } from './lib/validation.js'
import { localIso, todayStr } from './lib/dates.js'
import { validateSnapshot, pickNewest } from './lib/snapshot.js'
import { buildExport, markExported, clearExported, exportStatus, clearableEntries } from './lib/exporter.js'

const Ctx = createContext(null)
export const useStore = () => useContext(Ctx)

export function StoreProvider({ children }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)
  const [entries, setEntries] = useState([])
  const [lists, setLists] = useState({ categories: SEED_CATEGORIES, accounts: SEED_ACCOUNTS, names: SEED_NAMES })
  const [meta, setMeta] = useState(DEFAULT_META)
  const [snapshot, setSnapshot] = useState(null)
  const [now, setNow] = useState(() => new Date())
  const metaRef = useRef(meta)
  metaRef.current = meta
  const snapRef = useRef(null)
  snapRef.current = snapshot
  const entriesRef = useRef(entries)
  entriesRef.current = entries

  // Re-evaluate "today" when the app comes back to the foreground (so the Summary resets on the 1st).
  useEffect(() => {
    const tick = () => setNow(new Date())
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('focus', tick)
    const t = setInterval(tick, 60000)
    return () => { document.removeEventListener('visibilitychange', tick); window.removeEventListener('focus', tick); clearInterval(t) }
  }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const d = await db.loadAll()
        if (!alive) return
        const m = { ...DEFAULT_META, ...(d.meta || {}) }
        const l = { categories: SEED_CATEGORIES, accounts: SEED_ACCOUNTS, names: SEED_NAMES, ...(d.lists || {}) }
        if (!d.lists || !d.lists.names) await db.setKv('lists', l)
        if (!d.meta) await db.setKv('meta', m)
        setEntries(d.entries)
        setSnapshot(d.snapshot || null)
        setLists(l)
        setMeta(m)
        // First run: ask the browser not to evict our storage. Safari may ignore it; the Export warning stays.
        if (!m.persistAsked) {
          let ok = null
          try { ok = (await navigator.storage?.persist?.()) ?? null } catch { ok = null }
          const m2 = { ...m, persistAsked: true, persisted: ok }
          setMeta(m2)
          await db.setKv('meta', m2)
        }
      } catch (e) {
        if (alive) setError(String(e?.message || e))
      } finally {
        if (alive) setReady(true)
      }
    })()
    return () => { alive = false }
  }, [])

  const saveMeta = useCallback(async (patch) => {
    const next = typeof patch === 'function' ? patch(metaRef.current) : { ...metaRef.current, ...patch }
    metaRef.current = next
    setMeta(next)
    await db.setKv('meta', next)
    return next
  }, [])

  const addEntry = useCallback(async (fields) => {
    const e = { id: uuid4(), ...fields, created_at: localIso(new Date()) }
    setEntries((l) => [...l, e])
    await db.putEntry(e)
    await saveMeta((m) => ({ ...m, last: { type: e.type, category: e.category, mode: e.mode, from_account: e.from_account || m.last.from_account, to_account: e.to_account || m.last.to_account } }))
    return e
  }, [saveMeta])

  const updateEntry = useCallback(async (id, fields) => {
    const cur = entriesRef.current.find((e) => e.id === id)
    if (!cur) return null
    const merged = { ...cur, ...fields, id }
    setEntries((l) => l.map((e) => (e.id === id ? merged : e)))
    await db.putEntry(merged)
    return merged
  }, [])

  const removeEntry = useCallback(async (id) => {
    setEntries((l) => l.filter((e) => e.id !== id))
    await db.deleteEntries([id])
  }, [])

  // Load a website summary file (text). Returns { ok, message }.
  const loadSnapshotText = useCallback(async (text) => {
    let obj
    try { obj = JSON.parse(text) } catch { return { ok: false, message: 'That file is not valid JSON.' } }
    const v = validateSnapshot(obj)
    if (!v.ok) return { ok: false, message: v.error }
    const keep = pickNewest(snapRef.current, v.snapshot)
    if (keep !== v.snapshot) return { ok: false, message: 'That file is older than the summary already loaded.' }
    snapRef.current = keep
    setSnapshot(keep)
    await db.setKv('snapshot', keep)
    return { ok: true, message: 'Website summary loaded.' }
  }, [])

  const saveLists = useCallback(async (next) => {
    setLists(next)
    await db.setKv('lists', next)
  }, [])

  const status = useMemo(() => exportStatus(entries, meta, now), [entries, meta, now])

  // Builds the file now; the caller shares/downloads it, then calls finishExport(ids) only on success.
  const prepareExport = useCallback(() => buildExport(entries, meta.exportedIds, new Date()), [entries, meta.exportedIds])
  const finishExport = useCallback((ids) => saveMeta((m) => markExported(m, ids, new Date())), [saveMeta])

  const clearExportedEntries = useCallback(async () => {
    const r = clearExported(entries, meta.exportedIds, new Date())
    if (!r.removed) return 0
    const gone = entries.filter((e) => !r.entries.includes(e)).map((e) => e.id)
    const nextMeta = { ...metaRef.current, exportedIds: r.exportedIds }
    metaRef.current = nextMeta
    setEntries(r.entries)
    setMeta(nextMeta)
    await db.deleteEntriesAndMeta(gone, nextMeta)
    return r.removed
  }, [entries, meta.exportedIds])

  const value = {
    ready, error, snapshot, loadSnapshotText, entries, lists, meta, now, today: todayStr(now), status,
    clearableCount: clearableEntries(entries, meta.exportedIds, now).length,
    addEntry, updateEntry, removeEntry, saveLists, saveMeta, prepareExport, finishExport, clearExportedEntries,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
