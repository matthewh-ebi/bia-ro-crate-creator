import { useEffect, useRef } from 'react'
import './App.css'
import { emptyDraft, readDraft } from './model/draft'
import { DraftProvider, useDraft } from './store/DraftContext'
import { downloadBlob } from './store/persistence'
import { EntityEditor } from './views/EntityEditor'
import { DatasetRail } from './views/DatasetRail'
import { ExportView } from './views/ExportView'
import { Overview } from './views/Overview'
import { Sidebar } from './views/Sidebar'
import { go, useRoute } from './views/route'

export function App() {
  return (
    <DraftProvider>
      <Shell />
    </DraftProvider>
  )
}

function Shell() {
  const route = useRoute()
  const { draft, dispatch, savedAt, saveFailed } = useDraft()
  const fileInput = useRef<HTMLInputElement>(null)
  const routeKey = route.view === 'entity' ? route.uid : route.view

  // Each navigation starts at the top of the new page.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [routeKey])

  const backup = () => {
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
    downloadBlob(`bia-crate-draft-${stamp}.json`, JSON.stringify(draft, null, 2), 'application/json')
  }

  const restore = async (file: File) => {
    try {
      const parsed = readDraft(JSON.parse(await file.text()))
      if (!parsed) {
        alert('That file is not an editor draft backup. (Importing RO-Crates is not supported yet.)')
        return
      }
      if (confirm('Replace the current draft with this backup?')) {
        dispatch({ kind: 'replace', draft: parsed })
        go('#/overview')
      }
    } catch {
      alert('Could not read that file as JSON.')
    }
  }

  const reset = () => {
    if (confirm('Start a new crate? The current draft will be discarded (download a backup first if you need it).')) {
      dispatch({ kind: 'replace', draft: emptyDraft() })
      go('#/overview')
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/overview">
          <img src="./favicon.svg" alt="" width={24} height={24} />
          <span>BIA RO-Crate Editor</span>
        </a>
        <span className={`saved ${saveFailed ? 'saved-failed' : ''}`}>
          {saveFailed
            ? 'Not saved — browser storage unavailable'
            : savedAt
              ? `Saved in this browser · ${new Date(savedAt).toLocaleTimeString()}`
              : 'Saved in this browser'}
        </span>
        <div className="topbar-actions">
          <button type="button" className="btn ghost" onClick={reset}>New</button>
          <button type="button" className="btn ghost" onClick={backup}>Backup draft</button>
          <button type="button" className="btn ghost" onClick={() => fileInput.current?.click()}>Restore</button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void restore(f)
              e.target.value = ''
            }}
          />
          <a className={`btn primary ${route.view === 'export' ? 'active' : ''}`} href="#/export">Export crate</a>
        </div>
      </header>
      <div className="body">
        <Sidebar route={route} />
        <main className="main">
          {route.view === 'overview' && <Overview />}
          {route.view === 'export' && <ExportView />}
          {route.view === 'entity' && <EntityEditor key={route.uid} uid={route.uid} from={route.from} />}
        </main>
        <DatasetRail route={route} />
      </div>
    </div>
  )
}
