import { User, House, Briefcase, PiggyBank, Plane, Tag, ArrowLeftRight, ArrowDownLeft, X, Plus } from 'lucide-react'

const ICONS = { Self: User, Home: House, Office: Briefcase, Savings: PiggyBank, Travel: Plane }

// Colour slot (1..6, then 7) follows the category's place in the editable list, so it stays stable.
// Colours are the website chart tokens (--color-chart-cat-1..7); the tint is a mix with the surface.
export function catStyle(name, categories) {
  const i = categories.indexOf(name)
  const slot = i >= 0 && i < 6 ? i + 1 : 7
  return { slot, color: `var(--color-chart-cat-${slot})`, bg: `color-mix(in srgb, var(--color-chart-cat-${slot}) 22%, var(--color-surface))`, Icon: ICONS[name] || Tag }
}

export function Avatar({ entry, categories, size = 40 }) {
  if (entry.type === 'Transfer') {
    return <span className="av" style={{ width: size, height: size, background: 'color-mix(in srgb, var(--color-chart-expense) 22%, var(--color-surface))', color: 'var(--color-chart-expense)' }}><ArrowLeftRight size={20} className="ic" aria-hidden /></span>
  }
  if (entry.type === 'Income') {
    return <span className="av" style={{ width: size, height: size, background: 'var(--color-success-bg)', color: 'var(--color-success)' }}><ArrowDownLeft size={20} className="ic" aria-hidden /></span>
  }
  const s = catStyle(entry.category, categories)
  return <span className="av" style={{ width: size, height: size, background: s.bg, color: s.color }}><s.Icon size={20} className="ic" aria-hidden /></span>
}

export function Sheet({ title, onClose, children }) {
  return (
    <>
      <div className="dim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={title}>
        <div className="grab" />
        <div className="row sb2" style={{ marginBottom: 8 }}>
          <h2 style={{ fontSize: 'var(--text-xl)' }}>{title}</h2>
          <button className="xb" onClick={onClose} aria-label="Close"><X size={20} className="ic" /></button>
        </div>
        {children}
      </div>
    </>
  )
}

export function Empty({ title, text, onAdd }) {
  return (
    <div className="empty">
      <div className="ring"><i><Plus size={26} className="ic" aria-hidden /></i></div>
      <h2>{title}</h2>
      <p>{text}</p>
      <button className="btn" onClick={onAdd}><Plus size={22} className="ic" aria-hidden />Add entry</button>
    </div>
  )
}
