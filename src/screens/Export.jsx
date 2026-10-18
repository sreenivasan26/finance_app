import { useState } from 'react'
import { TriangleAlert, CircleCheck, Share, Download } from 'lucide-react'
import { useStore } from '../store.jsx'
import { dateTimeLabel, timeLabel, MON, DOW } from '../lib/dates.js'

function lastExportText(status) {
  if (!status.lastExport) return { head: 'Never exported', body: 'Storage may be cleared by iOS. Export often.' }
  const d = new Date(status.lastExport)
  const when = status.daysSince === 0 ? timeLabel(d) : dateTimeLabel(status.lastExport)
  const ago = status.daysSince === 0 ? 'today' : status.daysSince === 1 ? 'yesterday' : `${status.daysSince} days ago`
  return { head: `Last export ${ago}`, when }
}

async function shareOrDownload(filename, json) {
  const file = new File([json], filename, { type: 'application/json' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return 'shared'
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled' // user closed the share sheet: nothing was exported
      // any other failure: fall through to a plain download
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
  return 'downloaded'
}

export default function Export({ onToast }) {
  const { status, prepareExport, finishExport, clearExportedEntries, clearableCount } = useStore()
  const [busy, setBusy] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const good = !status.warn
  const nothing = status.unexported === 0

  const le = lastExportText(status)

  const doExport = async () => {
    if (nothing || busy) return
    setBusy(true)
    try {
      const x = prepareExport()
      const how = await shareOrDownload(x.filename, x.json)
      if (how === 'cancelled') { onToast('Export cancelled. Nothing was marked as exported.'); return }
      await finishExport(x.ids)
      onToast(how === 'shared' ? `${x.ids.length} entries exported` : `Downloaded ${x.filename}`)
    } finally { setBusy(false) }
  }
  const doClear = async () => {
    if (!confirmClear) { setConfirmClear(true); return }
    const n = await clearExportedEntries()
    setConfirmClear(false)
    onToast(`${n} exported ${n === 1 ? 'entry' : 'entries'} cleared`)
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="scr" style={{ flex: 1 }}>
        <div className="trow0"><div><h1>Export</h1><p className="sub">Move entries to the website</p></div></div>
        <div className="pad">
          <div className={`card ${good ? 'okc' : 'warn'}`} data-testid="export-card">
            <div className="row" style={{ alignItems: 'center', gap: 16 }}>
              <span className={`big2 ${good ? 'okn' : ''}`}>{status.unexported}</span>
              <div>
                <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>entries not exported</div>
                <span className="mut s">{status.exportedCount} already exported {'·'} {status.total} on this phone</span>
              </div>
            </div>
            <div className={`lastx ${good ? 'ok' : ''}`}>
              {good ? <CircleCheck size={22} className="ic" aria-hidden /> : <TriangleAlert size={22} className="ic" aria-hidden />}
              <div>
                <b>{le.head}</b>
                <span>{le.when ? `${le.when}. ` : ''}{good ? 'Everything on this phone is in an export file.' : 'Storage may be cleared by iOS. Export often.'}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <span className="cap">Save to OneDrive in 3 steps</span>
            <ol className="steps">
              <li><span className="num2">1</span><div><b>Tap Export</b><span>The share sheet opens with finance-capture-YYYYMMDD-HHMMSS.json.</span></div></li>
              <li><span className="num2">2</span><div><b>Choose OneDrive</b><span>Pick OneDrive in the share sheet, or Save to Files, then OneDrive.</span></div></li>
              <li><span className="num2">3</span><div><b>Save in the inbox folder</b><span>Open the data folder, choose inbox, tap Save. The website imports it on its next refresh.</span></div></li>
            </ol>
          </div>

          <div className="card">
            <span className="cap">Clear exported</span>
            <p className="p mut" style={{ marginTop: 8 }}>
              Removes exported entries dated before this month from this phone. This month's entries always stay, so the Summary never changes. Do this only after the file reached OneDrive.
            </p>
            <button className={`btn alt`} disabled={clearableCount === 0} onClick={doClear} style={{ marginTop: 12 }}>
              {clearableCount === 0 ? 'Nothing to clear' : confirmClear ? `Tap again to clear ${clearableCount}` : `Clear exported (${clearableCount})`}
            </button>
          </div>
        </div>
      </div>
      <div className="exportbar">
        <button className="btn" disabled={nothing || busy} onClick={doExport}>
          {nothing ? 'Nothing new to export' : <><Share size={22} className="ic" aria-hidden />Export {status.unexported} {status.unexported === 1 ? 'entry' : 'entries'}</>}
        </button>
        {!nothing && typeof navigator !== 'undefined' && !navigator.canShare && (
          <p className="mut s" style={{ textAlign: 'center', margin: '6px 0 0' }}><Download size={13} className="ic" aria-hidden /> This browser has no share sheet, so the file will download.</p>
        )}
      </div>
    </div>
  )
}
