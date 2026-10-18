import { useMemo, useState } from 'react'
import { Search, Check, ChevronDown, Calendar, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Settings, Plus, Trash2, X, Smartphone, Share, SquarePlus, TriangleAlert, Pencil } from 'lucide-react'
import { useStore } from '../store.jsx'
import { validateEntry, MODES } from '../lib/validation.js'
import { sanitizeAmountInput, groupAmountInput } from '../lib/format.js'
import { dateFieldLabel } from '../lib/dates.js'
import { nameOptions, canAddNew, addName } from '../lib/names.js'
import { catStyle, Sheet } from '../ui.jsx'

const TYPE_ICON = { Expense: ArrowUpRight, Income: ArrowDownLeft, Transfer: ArrowLeftRight }
const OUTSIDE = ''

function AccountSelect({ label, value, onChange, accounts, error, outside = true, testid }) {
  return (
    <div>
      <div className="lbl">{label}</div>
      <label className={`field ${error ? 'err' : ''}`}>
        <select value={value || OUTSIDE} onChange={(e) => onChange(e.target.value || null)} aria-label={label} data-testid={testid}>
          {outside ? <option value={OUTSIDE}>Outside</option> : <option value={OUTSIDE}>Choose account</option>}
          {accounts.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <ChevronDown size={18} className="ic" aria-hidden />
      </label>
      {error && <p className="err-t">{error}</p>}
    </div>
  )
}

export function ListsSheet({ onClose, initialTab = 'categories', initialCat }) {
  const { lists, saveLists } = useStore()
  const [tab, setTab] = useState(initialTab)
  const [nameCat, setNameCat] = useState(initialCat && lists.categories.includes(initialCat) ? initialCat : lists.categories[0])
  const [text, setText] = useState('')
  const [editing, setEditing] = useState(null) // {index, value}
  const names = lists.names || {}
  const items = tab === 'names' ? names[nameCat] || [] : lists[tab]
  const label = tab === 'categories' ? 'category' : tab === 'accounts' ? 'account' : 'name'
  const set = (arr) => saveLists(tab === 'names' ? { ...lists, names: { ...names, [nameCat]: arr } } : { ...lists, [tab]: arr })
  const add = () => {
    const v = text.trim()
    if (!v || items.some((x) => x.toLowerCase() === v.toLowerCase())) return
    set([...items, v]); setText('')
  }
  const rename = () => {
    const v = editing.value.trim()
    const old = items[editing.index]
    if (v && !items.some((x, i) => i !== editing.index && x.toLowerCase() === v.toLowerCase())) {
      const arr = items.map((x, i) => (i === editing.index ? v : x))
      if (tab === 'categories' && v !== old && names[old]) { // keep the category's names with it
        const { [old]: moved, ...rest } = names
        saveLists({ ...lists, categories: arr, names: { ...rest, [v]: moved } })
      } else set(arr)
    }
    setEditing(null)
  }
  return (
    <Sheet title="Edit lists" onClose={onClose}>
      <div className="seg s2" role="tablist">
        {[['categories', 'Categories'], ['accounts', 'Accounts'], ['names', 'Names']].map(([t, l]) => (
          <button key={t} className={tab === t ? 'on' : ''} role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setEditing(null) }}>{l}</button>
        ))}
      </div>
      {tab === 'names' && (
        <label className="field" style={{ marginTop: 10 }}>
          <select value={nameCat} onChange={(e) => { setNameCat(e.target.value); setEditing(null) }} aria-label="Names for category">
            {lists.categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <ChevronDown size={18} className="ic" aria-hidden />
        </label>
      )}
      <div style={{ marginTop: 8 }}>
        {items.map((x, i) => (
          <div className="lrow" key={x + i}>
            {editing?.index === i ? (
              <input autoFocus value={editing.value} onChange={(e) => setEditing({ index: i, value: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && rename()} aria-label={`Rename ${x}`} />
            ) : <span>{x}</span>}
            {editing?.index === i ? (
              <button className="xb" onClick={rename} aria-label="Save name"><Check size={20} className="ic" /></button>
            ) : (
              <button className="xb" onClick={() => setEditing({ index: i, value: x })} aria-label={`Rename ${x}`}><Pencil size={18} className="ic" /></button>
            )}
            <button className="xb" onClick={() => set(items.filter((_, j) => j !== i))} aria-label={`Remove ${x}`}><Trash2 size={18} className="ic" /></button>
          </div>
        ))}
      </div>
      <div className="addrow">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder={`New ${label}`} aria-label={`New ${label}`} />
        <button className="btn" onClick={add}><Plus size={20} className="ic" aria-hidden />Add</button>
      </div>
      <p className="mut s" style={{ marginTop: 12 }}>Mode is fixed to UPI, CC or Other, as the website expects. Renaming or removing a list item does not change entries already saved.</p>
    </Sheet>
  )
}

export function NamePicker({ category, entries, names, value, onPick, onClose }) {
  const [q, setQ] = useState('')
  const options = useMemo(() => nameOptions(category, entries, names), [category, entries, names])
  const shown = useMemo(() => nameOptions(category, entries, names, q), [category, entries, names, q])
  const addable = canAddNew(q, options)
  return (
    <Sheet title="Spend name" onClose={onClose}>
      <label className="field"><Search size={18} className="ic" aria-hidden />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search names" aria-label="Search names" autoComplete="off" />
      </label>
      <div role="listbox" aria-label="Spend names" style={{ marginTop: 8, maxHeight: '46dvh', overflowY: 'auto' }}>
        {shown.map((n) => (
          <button key={n} role="option" aria-selected={n === value} className="lrow" style={{ width: '100%', minHeight: 44 }} onClick={() => onPick(n, false)}>
            <span>{n}</span>{n === value && <Check size={18} className="ic" style={{ color: 'var(--color-primary-text)' }} aria-hidden />}
          </button>
        ))}
        {shown.length === 0 && !addable && <p className="mut" style={{ padding: 12 }}>No names yet.</p>}
      </div>
      {addable && (
        <button className="lrow" style={{ width: '100%', minHeight: 48, color: 'var(--color-primary-text)', borderTop: '1px solid var(--color-border-strong)' }} onClick={() => onPick(q.trim(), true)}>
          <Plus size={18} className="ic" aria-hidden /><span>Add new: {q.trim()}</span>
        </button>
      )}
    </Sheet>
  )
}

export function InstallHint({ onClose }) {
  return (
    <Sheet title="Install Notes and Tasks Capture" onClose={onClose}>
      <p className="mut" style={{ margin: '0 0 8px' }}>Opens full screen and works offline.</p>
      <ol className="steps">
        <li><span className="num2">1</span><div><b>Tap Share <Share size={16} className="ic" aria-hidden /> in Safari</b></div></li>
        <li><span className="num2">2</span><div><b>Scroll, tap Add to Home Screen <SquarePlus size={16} className="ic" aria-hidden /></b></div></li>
        <li><span className="num2">3</span><div><b>Tap Add, then open it from the Home Screen</b></div></li>
      </ol>
      <div className="warnbox"><TriangleAlert size={20} className="ic" aria-hidden /><span>Use the Home Screen icon, not a browser tab: iOS can clear tab storage.</span></div>
    </Sheet>
  )
}

// Add (new) and edit (entry given) share this form.
export default function AddEntry({ entry, onDone, onToast }) {
  const { lists, meta, today, entries, addEntry, updateEntry, removeEntry, saveLists } = useStore()
  const editing = !!entry
  const init = entry
    ? { ...entry, amount: String(entry.amount) }
    : { type: meta.last.type, amount: '', category: lists.categories.includes(meta.last.category) ? meta.last.category : lists.categories[0] || '', spend_name: '', date: today, mode: meta.last.mode,
        from_account: lists.accounts.includes(meta.last.from_account) ? meta.last.from_account : null, to_account: lists.accounts.includes(meta.last.to_account) ? meta.last.to_account : null, comment: '' }
  const [d, setD] = useState(init)
  const [errors, setErrors] = useState({})
  const [showLists, setShowLists] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [showNames, setShowNames] = useState(false)
  const set = (patch) => setD((x) => ({ ...x, ...patch }))

  const save = async () => {
    const r = validateEntry(d, lists)
    setErrors(r.errors)
    if (!r.ok) return
    if (editing) { await updateEntry(entry.id, r.entry); onToast('Changes saved'); onDone() }
    else {
      await addEntry(r.entry)
      onToast('Entry saved on this phone')
      setD({ ...init, type: r.entry.type, category: r.entry.category, mode: r.entry.mode, from_account: d.from_account, to_account: d.to_account, amount: '', spend_name: '', comment: '', date: today })
      setErrors({})
      onDone?.()
    }
  }
  const del = async () => { await removeEntry(entry.id); onToast('Entry deleted'); onDone() }

  return (
    <div className="scr" style={{ display: 'flex', flexDirection: 'column', paddingBottom: 0 }}>
      <div className="trow0">
        <h1>{editing ? 'Edit entry' : 'Add entry'}</h1>
        {editing
          ? <button className="pillbtn" onClick={onDone}><X size={16} className="ic" aria-hidden />Cancel</button>
          : <button className="pillbtn" onClick={() => setShowLists(true)} aria-label="Edit lists"><Settings size={16} className="ic" aria-hidden />Lists</button>}
      </div>
      <div className="pad" style={{ flex: 1 }}>
        <div className="seg" role="tablist" aria-label="Entry type">
          {['Expense', 'Income', 'Transfer'].map((t) => {
            const I = TYPE_ICON[t]
            return <button key={t} className={d.type === t ? 'on' : ''} role="tab" aria-selected={d.type === t} onClick={() => set({ type: t })}><I size={18} className="ic" aria-hidden />{t}</button>
          })}
        </div>
        <div className={`amtbox ${errors.amount ? 'err' : ''}`}>
          <span className="cap">Amount (INR)</span>
          <div className="amtrow">
            <em>{'₹'}</em>
            <input inputMode="decimal" autoComplete="off" placeholder="0" aria-label="Amount in rupees" value={groupAmountInput(d.amount)}
              onChange={(e) => set({ amount: sanitizeAmountInput(e.target.value) })} />
          </div>
        </div>
        {errors.amount && <p className="err-t">{errors.amount}</p>}

        <div className="lbl">Category</div>
        <div className="chips" role="radiogroup" aria-label="Category">
          {lists.categories.map((c) => {
            const s = catStyle(c, lists.categories)
            const on = d.category === c
            return (
              <button key={c} role="radio" aria-checked={on} className="chip" onClick={() => set({ category: c })}
                style={on ? { borderColor: s.color, background: s.bg } : undefined}>
                <s.Icon size={18} className="ic" style={{ color: s.color }} aria-hidden />{c}{on && <Check size={16} className="ic" aria-hidden />}
              </button>
            )
          })}
          <button className="chip" onClick={() => setShowLists(true)} aria-label="Add category" style={{ borderStyle: 'dashed' }}><Plus size={18} className="ic" aria-hidden /></button>
        </div>
        {errors.category && <p className="err-t">{errors.category}</p>}

        <div className="lbl">Spend name</div>
        <button type="button" className={`field ${errors.spend_name ? 'err' : ''}`} onClick={() => setShowNames(true)} aria-label="Spend name" aria-haspopup="listbox">
          <span style={{ flex: 1, fontWeight: d.spend_name ? 600 : 400, color: d.spend_name ? undefined : 'var(--color-text-muted)' }}>{d.spend_name || 'Choose or search a name'}</span>
          <ChevronDown size={18} className="ic" aria-hidden />
        </button>
        {errors.spend_name && <p className="err-t">{errors.spend_name}</p>}
        {showNames && (
          <NamePicker category={d.category} entries={entries} names={lists.names || {}} value={d.spend_name} onClose={() => setShowNames(false)}
            onPick={(n, isNew) => {
              if (isNew) { const r = addName(lists.names || {}, d.category, n); saveLists({ ...lists, names: r.names }); n = r.name }
              set({ spend_name: n }); setShowNames(false)
            }} />
        )}

        <div className="two" style={{ marginTop: 8, marginBottom: 0 }}>
          <div>
            <div className="lbl">Date</div>
            <label className={`field ${errors.date ? 'err' : ''}`}>
              <Calendar size={18} className="ic" aria-hidden />
              <span style={{ flex: 1, textAlign: 'right', fontWeight: 600 }}>{dateFieldLabel(d.date)}</span>
              <input type="date" value={d.date} onChange={(e) => e.target.value && set({ date: e.target.value })} aria-label="Date"
                style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%' }} />
            </label>
            {errors.date && <p className="err-t">{errors.date}</p>}
          </div>
          <div>
            <div className="lbl">Mode</div>
            <div className="seg s2" role="radiogroup" aria-label="Mode">
              {MODES.map((m) => <button key={m} role="radio" aria-checked={d.mode === m} className={d.mode === m ? 'on' : ''} onClick={() => set({ mode: m })} style={{ fontSize: 'var(--text-sm)' }}>{m}</button>)}
            </div>
          </div>
        </div>

        <div className={d.type === 'Transfer' ? 'two' : ''} style={{ marginTop: 0, marginBottom: 0 }}>
          {d.type !== 'Income' && <AccountSelect label="From account" value={d.from_account} onChange={(v) => set({ from_account: v })} accounts={lists.accounts} error={errors.from_account} outside={d.type !== 'Transfer'} testid="from" />}
          {d.type !== 'Expense' && <AccountSelect label="To account" value={d.to_account} onChange={(v) => set({ to_account: v })} accounts={lists.accounts} error={errors.to_account} outside={d.type !== 'Transfer'} testid="to" />}
        </div>

        <div className="lbl">Comment <span className="opt">optional</span></div>
        <label className="field"><input value={d.comment} onChange={(e) => set({ comment: e.target.value })} placeholder="Note" aria-label="Comment" autoComplete="off" /></label>

        {editing && (confirmDel
          ? <button className="btn dng" onClick={del}><Trash2 size={20} className="ic" aria-hidden />Tap again to delete</button>
          : <button className="btn dng" onClick={() => setConfirmDel(true)}><Trash2 size={20} className="ic" aria-hidden />Delete entry</button>)}
      </div>
      <div className="savebar">
        <button className="btn" onClick={save}><Check size={22} className="ic" aria-hidden />{editing ? 'Save changes' : 'Save entry'}</button>
      </div>
      {showLists && <ListsSheet onClose={() => setShowLists(false)} />}
    </div>
  )
}
