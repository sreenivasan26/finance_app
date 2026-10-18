import { useRef, useState } from 'react'
import { Calendar, TriangleAlert, ArrowDownLeft, ChevronRight, Globe, Smartphone, FileUp, Landmark, CreditCard } from 'lucide-react'
import { useStore } from '../store.jsx'
import { dailyCap } from '../lib/summary.js'
import { adjustedBalances, adjustedDues } from '../lib/balances.js'
import { combinedSummary, budgetPace, snapshotAgeDays, STALE_SNAPSHOT_DAYS } from '../lib/snapshot.js'
import { formatINR, compactK } from '../lib/format.js'
import { shortDate, monthTitle, dateTimeLabel } from '../lib/dates.js'
import { catStyle, Empty, Avatar } from '../ui.jsx'


export function StorageBanner({ status, compact, onClick }) {
  if (!status.warn) return null
  const parts = []
  if (status.unexported > 0) parts.push(`${status.unexported} ${status.unexported === 1 ? 'entry is' : 'entries are'} not exported.`)
  if (status.daysSince !== null) parts.push(`Last export ${status.daysSince === 0 ? 'today' : status.daysSince === 1 ? 'yesterday' : status.daysSince + ' days ago'}.`)
  else parts.push('Never exported.')
  return (
    <button className="banner" onClick={onClick}>
      <TriangleAlert size={22} className="ic" aria-hidden />
      <div style={{ flex: 1 }}>
        <b>Storage may be cleared. Export often.</b>
        <span>{parts.join(' ')}</span>
      </div>
      <ChevronRight size={20} className="ic" style={{ color: 'var(--color-warning)', marginTop: 2 }} aria-hidden />
    </button>
  )
}

function Donut({ cats, categories, total }) {
  const R = 62, C = 2 * Math.PI * R, GAP = 3
  let off = 0
  const top = cats[0]
  return (
    <div className="dwrap">
      <svg width="170" height="170" viewBox="0 0 170 170" role="img" aria-label="Spend by category">
        <g transform="rotate(-90 85 85)">
          <circle cx="85" cy="85" r={R} fill="none" stroke="var(--color-surface-alt)" strokeWidth="26" />
          {cats.map((c) => {
            const len = (c.amount / total) * C
            const seg = Math.max(0, len - (cats.length > 1 ? GAP : 0))
            const el = <circle key={c.name} cx="85" cy="85" r={R} fill="none" stroke={catStyle(c.name, categories).color} strokeWidth="26" strokeDasharray={`${seg} ${C - seg}`} strokeDashoffset={-off} />
            off += len
            return el
          })}
        </g>
        <text x="85" y="88" textAnchor="middle" className="dc1">{top.pct}%</text>
        <text x="85" y="110" textAnchor="middle" className="dc2">{top.name}</text>
      </svg>
    </div>
  )
}

function DailyBars({ daily, today }) {
  const cap = dailyCap(daily)
  const W = 326, H = 120, base = 100, top = 16
  const n = daily.length
  const slot = W / Math.max(n, 1)
  const bw = Math.max(3, Math.min(14, slot - 4))
  const hOf = (v) => (Math.min(v, cap) / cap) * (base - top)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Daily spend">
      {daily.map((d, i) => {
        const h = Math.max(d.amount > 0 ? 3 : 0, hOf(d.amount))
        const x = i * slot + (slot - bw) / 2
        const isToday = d.date === today
        const clipped = d.amount > cap
        return (
          <g key={d.date}>
            <rect x={x} y={base - h} width={bw} height={h} rx="2" fill={isToday ? 'var(--color-accent)' : 'var(--color-primary)'} />
            {clipped && <text x={x + bw / 2} y={base - h - 3} textAnchor="middle" className="bl">{compactK(d.amount)}</text>}
          </g>
        )
      })}
      <text x="0" y={H - 4} className="bl">1</text>
      {n > 10 && <text x={9 * slot + slot / 2} y={H - 4} textAnchor="middle" className="bl">10</text>}
      <text x={W} y={H - 4} textAnchor="end" className="bl">Today</text>
    </svg>
  )
}

function ModeBanner({ s, now, onLoad, loading }) {
  const age = snapshotAgeDays(s.snapshot, now)
  const stale = s.mode === 'website' && age !== null && age > STALE_SNAPSHOT_DAYS
  const asOf = s.snapshot ? `Website data as of ${dateTimeLabel(s.snapshot.generated_at)}` : null
  let Icon = Smartphone, head = 'Phone only', body = 'Showing entries captured on this phone. Load the website summary to see the whole month.'
  if (s.mode === 'website') { Icon = Globe; head = 'Website + phone'; body = `${asOf}${s.phoneAdded ? ` · plus ${s.phoneAdded} phone ${s.phoneAdded === 1 ? 'entry' : 'entries'}` : ''}` }
  if (s.mode === 'ignored') { head = 'Phone only'; body = `The loaded website summary is for ${s.ignoredMonth}, not this month, so it is ignored. Load a current one.` }
  return (
    <div className={`card modebar ${stale || s.mode === 'ignored' ? 'warn' : ''}`} data-testid="mode-banner" data-mode={s.mode}>
      <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
        {stale ? <TriangleAlert size={20} className="ic" style={{ color: 'var(--color-warning)', marginTop: 2 }} aria-hidden /> : <Icon size={20} className="ic" style={{ color: 'var(--color-primary-text)', marginTop: 2 }} aria-hidden />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <b style={{ display: 'block' }}>{head}</b>
          <span className="mut s" style={{ display: 'block' }}>{body}</span>
          {stale && <span className="mut s" style={{ display: 'block', color: 'var(--color-warning)', fontWeight: 600 }}>Older than {STALE_SNAPSHOT_DAYS} days ({age} days). Load a fresh summary.</span>}
        </div>
      </div>
      <button className="btn alt" style={{ marginTop: 10, height: 44, fontSize: 'var(--text-md)' }} onClick={onLoad} disabled={loading}>
        <FileUp size={18} className="ic" aria-hidden />Load website summary
      </button>
    </div>
  )
}

function BudgetPace({ p }) {
  return (
    <div className="card" data-testid="budget-pace">
      <div className="row sb2">
        <span className="cap">{p.name} budget</span>
        {p.abovePace && !p.over && <span className="chipw"><TriangleAlert size={14} className="ic" aria-hidden />Above pace</span>}
        {p.over && <span className="chipw"><TriangleAlert size={14} className="ic" aria-hidden />Over budget</span>}
      </div>
      <div className="row sb2" style={{ alignItems: 'baseline', marginTop: 6 }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-2xl)', fontVariantNumeric: 'tabular-nums' }}>{formatINR(p.spent)}</span>
        <span className="mut">of {formatINR(p.budget)}</span>
      </div>
      <div className="meter" role="progressbar" aria-valuenow={Math.min(100, p.usedPct)} aria-valuemin={0} aria-valuemax={100}>
        <i style={{ width: `${Math.min(100, p.usedPct)}%`, background: p.abovePace ? 'var(--color-warning)' : 'var(--color-primary)' }} />
        <s style={{ left: `${p.monthPct}%` }} />
      </div>
      <div className="row sb2 mut s" style={{ marginTop: 8 }}>
        <span>{p.over ? `${formatINR(-p.left)} over` : `${formatINR(p.left)} left`} {'·'} {p.daysToGo} days to go</span>
        <span>Tick: month {p.monthPct}% done</span>
      </div>
    </div>
  )
}

export default function Summary({ onAdd, onGoExport, onToast }) {
  const { entries, lists, now, status, snapshot, loadSnapshotText } = useStore()
  const s = combinedSummary(entries, snapshot, now)
  const pace = s.mode === 'website' ? budgetPace(s, now) : null
  const bal = s.mode === 'website' ? adjustedBalances(s.snapshot, entries) : { rows: [], syncedCount: 0 }
  const dues = s.mode === 'website' ? adjustedDues(s.snapshot, entries) : { rows: [], credits: [], changed: 0 }
  const fileRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)

  const onFile = async (ev) => {
    const f = ev.target.files?.[0]
    ev.target.value = ''
    if (!f) return
    setLoading(true); setLoadError(null)
    try {
      const r = await loadSnapshotText(await f.text())
      if (r.ok) onToast?.(r.message); else setLoadError(r.message)
    } catch { setLoadError('Could not read that file.') } finally { setLoading(false) }
  }

  const empty = !s.hasData
  const subtitle = empty ? 'Nothing captured yet'
    : s.mode === 'website' ? `Website + ${s.phoneAdded} from this phone`
    : `From ${s.count} ${s.count === 1 ? 'entry' : 'entries'} this month`
  return (
    <div className="scr">
      <div className="trow0">
        <div>
          <h1>{monthTitle(now)}</h1>
          <p className="sub">{subtitle}</p>
        </div>
        <span className="rng"><Calendar size={16} className="ic" aria-hidden />{s.range}</span>
      </div>
      <div className="pad">
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={onFile} data-testid="snapshot-file" />
        <ModeBanner s={s} now={now} onLoad={() => fileRef.current?.click()} loading={loading} />
        {loadError && <div className="banner" role="alert" style={{ borderColor: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}><TriangleAlert size={20} className="ic" style={{ color: 'var(--color-danger)' }} aria-hidden /><div><b style={{ color: 'var(--color-danger)' }}>Could not load the summary</b><span>{loadError}</span></div></div>}
        <StorageBanner status={status} onClick={onGoExport} />
        <div className={`card hero ${s.expense === 0 ? 'z' : ''}`}>
          <span className="cap">Spent this month</span>
          <span className="num">{formatINR(s.expense)}</span>
          <span className="mut">{empty ? `Fresh month. Summary resets on ${s.resetsOn}.` : `Resets on ${s.resetsOn}`}</span>
        </div>
        {empty ? (
          <Empty title="Add your first entry" text="The Summary counts this calendar month: the website summary if you load one, plus entries made on this phone. Last month's entries stay in Entries until you clear them." onAdd={onAdd} />
        ) : (
          <>
            <div className="card tile">
              <span className="cap"><ArrowDownLeft size={14} className="ic" aria-hidden />Income</span>
              <span className="n inc">{formatINR(s.income)}</span>
              <span className="d">{s.income > 0 ? 'This month' : 'None yet'}</span>
            </div>
            {s.byCategory.length > 0 && (
              <div className="card">
                <span className="cap">By category</span>
                <Donut cats={s.byCategory} categories={lists.categories} total={s.byCategory.reduce((t, c) => t + c.amount, 0)} />
                <div className="clist">
                  {s.byCategory.map((c) => (
                    <div className="crow" key={c.name}>
                      <span className="dot" style={{ background: catStyle(c.name, lists.categories).color }} />
                      <span className="cn">{c.name}</span>
                      <span className="cp">{c.pct}%</span>
                      <span className="ca">{formatINR(c.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {pace && <BudgetPace p={pace} />}
            {s.expense > 0 && (
              <div className="card">
                <div className="row sb2"><span className="cap">Daily spend</span><span className="mut s">capped at {formatINR(dailyCap(s.daily))}</span></div>
                <div style={{ marginTop: 10 }}><DailyBars daily={s.daily} today={s.today} /></div>
                <div className="legend">
                  <span><i className="sw" style={{ background: 'var(--color-primary)' }} />Day</span>
                  <span><i className="sw" style={{ background: 'var(--color-accent)' }} />Today</span>
                </div>
              </div>
            )}
            {s.topSpends.length > 0 && (
              <div className="card">
                <span className="cap">Top spends</span>
                <div style={{ marginTop: 4 }}>
                  {s.topSpends.map((e) => (
                    <div className="trow" key={e.id}>
                      <Avatar entry={e} categories={lists.categories} size={44} />
                      <div className="tm"><b>{e.spend_name}</b><span>{e.category} {'·'} {shortDate(e.date)}</span></div>
                      <span className="amt">{formatINR(e.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {s.mode === 'website' && bal.rows.length > 0 && (
              <div className="card" data-testid="accounts-card">
                <div className="row sb2"><span className="cap"><Landmark size={14} className="ic" aria-hidden />Account balances</span><span className="mut s">as of {dateTimeLabel(s.snapshot.generated_at)}</span></div>
                {bal.syncedCount > 0 && <p className="mut s" style={{ margin: '6px 0 0' }} data-testid="unsynced-note">Includes {bal.syncedCount} phone {bal.syncedCount === 1 ? 'entry' : 'entries'} not yet synced</p>}
                <div style={{ marginTop: 4 }}>
                  {bal.rows.map((a) => (
                    <div className="trow" key={a.name} style={{ minHeight: 44 }} data-changed={a.changed}>
                      <div className="tm"><b>{a.name}{a.changed && <span className="chg" title="Includes phone entries not yet synced"> {'\u2022'}</span>}</b><span>{a.changed ? `was ${formatINR(a.base)}` : a.kind}</span></div>
                      <span className="amt" style={a.balance < 0 ? { color: 'var(--color-danger)' } : undefined}>{formatINR(a.balance)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {s.mode === 'website' && (dues.rows.length > 0 || dues.credits.length > 0) && (
              <div className="card" data-testid="dues-card">
                <div className="row sb2"><span className="cap"><CreditCard size={14} className="ic" aria-hidden />Card dues</span><span className="mut s">as of {dateTimeLabel(s.snapshot.generated_at)}</span></div>
                {dues.changed > 0 && <p className="mut s" style={{ margin: '6px 0 0' }}>Includes {dues.changed} phone {dues.changed === 1 ? 'entry' : 'entries'} not yet synced</p>}
                <div style={{ marginTop: 4 }}>
                  {dues.rows.map((c) => (
                    <div className="trow" key={c.card + c.due_date} style={{ minHeight: 44 }} data-changed={c.changed}>
                      <div className="tm"><b>{c.card}{c.changed && <span className="chg"> {'\u2022'}</span>}</b><span>Due {shortDate(c.due_date)}{c.changed && c.base > 0 && c.base !== c.amount ? ` \u00B7 was ${formatINR(c.base)}` : ''}</span></div>
                      <span className="amt">{c.amount === 0 ? 'Settled' : formatINR(c.amount)}</span>
                    </div>
                  ))}
                  {dues.credits.map((c) => (
                    <div className="trow" key={'cr' + c.card} style={{ minHeight: 44 }} data-changed="true">
                      <div className="tm"><b>{c.card}<span className="chg"> {'\u2022'}</span></b><span>Credit after payment</span></div>
                      <span className="amt inc">{formatINR(c.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
