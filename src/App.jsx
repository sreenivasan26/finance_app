import { useCallback, useEffect, useRef, useState } from 'react'
import { ChartPie, CirclePlus, ListChecks, Share, Check } from 'lucide-react'
import { StoreProvider, useStore } from './store.jsx'
import Summary from './screens/Summary.jsx'
import AddEntry, { InstallHint } from './screens/AddEntry.jsx'
import Entries from './screens/Entries.jsx'
import Export from './screens/Export.jsx'

const TABS = [
  { id: 'summary', label: 'Summary', Icon: ChartPie },
  { id: 'add', label: 'Add', Icon: CirclePlus },
  { id: 'entries', label: 'Entries', Icon: ListChecks },
  { id: 'export', label: 'Export', Icon: Share },
]

const isStandalone = () => window.navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches

function Shell() {
  const { ready, error, status, meta, saveMeta } = useStore()
  const [tab, setTab] = useState('summary')
  const [editing, setEditing] = useState(null)
  const [toast, setToast] = useState(null)
  const timer = useRef(null)
  const showToast = useCallback((msg) => {
    setToast(msg); clearTimeout(timer.current); timer.current = setTimeout(() => setToast(null), 2600)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])

  if (!ready) return <div className="app" />
  const go = (t) => { setEditing(null); setTab(t) }
  const showInstall = !meta.installHintDismissed && !isStandalone() && tab === 'add' && !editing

  return (
    <div className="app">
      <main className="main">
        {error && <div className="pad" style={{ paddingTop: 12 }}><div className="banner"><div><b>Storage unavailable</b><span>{error}. Entries cannot be saved on this device.</span></div></div></div>}
        {tab === 'summary' && <Summary onAdd={() => go('add')} onGoExport={() => go('export')} onToast={showToast} />}
        {tab === 'add' && !editing && <AddEntry key="new" onDone={() => {}} onToast={showToast} />}
        {tab === 'add' && editing && <AddEntry key={editing.id} entry={editing} onDone={() => { setEditing(null); setTab('entries') }} onToast={showToast} />}
        {tab === 'entries' && <Entries onAdd={() => go('add')} onEdit={(e) => { setEditing(e); setTab('add') }} onToast={showToast} />}
        {tab === 'export' && <Export onToast={showToast} />}
        {toast && <div className="toast" role="status"><Check size={20} className="ic" aria-hidden />{toast}</div>}
      </main>
      <nav className="tabbar" aria-label="Main">
        {TABS.map(({ id, label, Icon }) => {
          const on = tab === id && !(editing && id === 'add')
          const current = tab === id || (editing && id === 'entries' && tab === 'add')
          return (
            <button key={id} className={`tab ${current ? 'on' : ''}`} onClick={() => go(id)} aria-current={current ? 'page' : undefined}>
              <span className="pill">
                <Icon size={22} className="ic" aria-hidden />
                {id === 'export' && status.unexported > 0 && <i className="badge" aria-label={`${status.unexported} not exported`}>{status.unexported > 99 ? '99+' : status.unexported}</i>}
              </span>
              {label}
            </button>
          )
        })}
      </nav>
      {showInstall && <InstallHint onClose={() => saveMeta({ installHintDismissed: true })} />}
    </div>
  )
}

export default function App() {
  return <StoreProvider><Shell /></StoreProvider>
}
