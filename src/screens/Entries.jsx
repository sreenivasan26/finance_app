import { useMemo, useRef, useState } from 'react'
import { Search, ArrowLeft, X, Trash2 } from 'lucide-react'
import { useStore } from '../store.jsx'
import { formatINR } from '../lib/format.js'
import { dayHeader } from '../lib/dates.js'
import { Avatar, Empty } from '../ui.jsx'

const OPEN = -92

function Row({ e, categories, openId, setOpenId, onEdit, onDelete }) {
  const ref = useRef({ x0: 0, y0: 0, dx: 0, moved: false, down: false })
  const [dx, setDx] = useState(null) // live drag offset
  const isOpen = openId === e.id
  const base = isOpen ? OPEN : 0
  const sub = e.type === 'Transfer' ? `${e.from_account || 'Outside'} to ${e.to_account || 'Outside'} · Transfer`
    : e.type === 'Income' ? `Income · ${e.to_account ? 'to ' + e.to_account : e.category}`
    : [e.category, e.mode, e.from_account].filter(Boolean).join(' · ')
  const down = (ev) => { try { ev.currentTarget.setPointerCapture(ev.pointerId) } catch { /* ignore */ } ref.current = { x0: ev.clientX, y0: ev.clientY, dx: 0, moved: false, down: true }; }
  const move = (ev) => {
    const r = ref.current
    if (!r.down) return
    const ddx = ev.clientX - r.x0
    if (Math.abs(ddx) > 8) r.moved = true
    if (r.moved) { r.dx = ddx; setDx(Math.max(OPEN, Math.min(0, base + ddx))) }
  }
  const up = () => {
    const r = ref.current
    if (!r.down) return
    r.down = false
    if (r.moved) {
      const final = base + r.dx
      setOpenId(final < OPEN / 2 ? e.id : null)
      setDx(null)
    } else if (isOpen) setOpenId(null)
    else onEdit(e)
  }
  const amtClass = e.type === 'Transfer' ? 'amt tr' : e.type === 'Income' ? 'amt inc' : 'amt'
  return (
    <div className="erow" data-testid="entry-row" data-open={isOpen}>
      <button className="del" onClick={() => onDelete(e)} aria-label={`Delete ${e.spend_name}`} tabIndex={isOpen ? 0 : -1}><Trash2 size={20} className="ic" aria-hidden />Delete</button>
      <div className={`eb ${dx !== null ? 'drag' : ''}`} style={{ transform: `translateX(${dx ?? base}px)` }} role="button" tabIndex={0}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { ref.current.down = false; setDx(null) }}
        onKeyDown={(k) => k.key === 'Enter' && onEdit(e)}>
        <Avatar entry={e} categories={categories} />
        <div className="tm"><b>{e.spend_name}</b><span>{sub}</span></div>
        <span className={amtClass}>{e.type === 'Income' ? formatINR(e.amount, { sign: true }) : formatINR(e.amount)}</span>
      </div>
    </div>
  )
}

export default function Entries({ onAdd, onEdit, onToast }) {
  const { entries, lists, now, meta, saveMeta, removeEntry } = useStore()
  const [q, setQ] = useState('')
  const [searching, setSearching] = useState(false)
  const [openId, setOpenId] = useState(null)

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = entries
      .filter((e) => !needle || [e.spend_name, e.category, e.comment, e.from_account, e.to_account].some((v) => (v || '').toLowerCase().includes(needle)))
      .sort((a, b) => (a.date === b.date ? (a.created_at < b.created_at ? 1 : -1) : a.date < b.date ? 1 : -1))
    const map = new Map()
    for (const e of list) { if (!map.has(e.date)) map.set(e.date, []); map.get(e.date).push(e) }
    return [...map.entries()].map(([date, items]) => {
      const exp = items.filter((i) => i.type === 'Expense').reduce((t, i) => t + i.amount, 0)
      const inc = items.filter((i) => i.type === 'Income').reduce((t, i) => t + i.amount, 0)
      return { date, items, net: inc - exp, hasIncome: inc > 0, hasMoney: exp > 0 || inc > 0 }
    })
  }, [entries, q])

  const del = async (e) => { setOpenId(null); await removeEntry(e.id); onToast('Entry deleted') }

  return (
    <div className="scr" onPointerDown={(ev) => openId && !ev.target.closest("[data-open=true]") && setOpenId(null)}>
      <div className="trow0">
        <div>
          <h1>Entries</h1>
          <p className="sub">{entries.length === 0 ? 'Nothing yet' : `${entries.length} on this phone`}</p>
        </div>
        {entries.length > 0 && (
          <button className="pillbtn" onClick={(ev) => { ev.stopPropagation(); setSearching((s) => !s); setQ('') }} aria-label="Search"><Search size={16} className="ic" aria-hidden />Search</button>
        )}
      </div>
      <div className="pad">
        {searching && (
          <label className="field search"><Search size={18} className="ic" aria-hidden /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, category, account" aria-label="Search entries" /></label>
        )}
        {entries.length === 0 ? (
          <Empty title="No entries this month" text="Entries you add appear here, grouped by day. Swipe left on one to delete it." onAdd={onAdd} />
        ) : (
          <>
            {!meta.entriesHintDismissed && !searching && (
              <div className="hint"><ArrowLeft size={18} className="ic" aria-hidden /><span>Tap a row to edit. Swipe left to delete.</span>
                <button className="xb" onClick={(ev) => { ev.stopPropagation(); saveMeta({ entriesHintDismissed: true }) }} aria-label="Dismiss hint"><X size={18} className="ic" /></button></div>
            )}
            {groups.length === 0 && <p className="mut" style={{ padding: 12 }}>No entries match.</p>}
            {groups.map((g) => (
              <section key={g.date}>
                <div className="dh">
                  <span>{dayHeader(g.date, now)}</span>
                  {g.hasMoney && <span>{formatINR(g.net, { sign: true })}{g.hasIncome ? ' NET' : ''}</span>}
                </div>
                <div className="group">
                  {g.items.map((e) => <Row key={e.id} e={e} categories={lists.categories} openId={openId} setOpenId={setOpenId} onEdit={onEdit} onDelete={del} />)}
                </div>
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
