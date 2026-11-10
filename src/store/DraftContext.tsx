import { createContext, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react'
import { checkDraft, worstByEntity, type Issue, type Severity } from '../model/checks'
import { reducer, type Action, type Draft } from '../model/draft'
import { loadDraft, saveDraft } from './persistence'

interface DraftState {
  draft: Draft
  dispatch: (a: Action) => void
  issues: Issue[]
  worst: Map<string, Severity>
  savedAt: string | null
  saveFailed: boolean
}

const Ctx = createContext<DraftState | null>(null)

export function DraftProvider({ children }: { children: ReactNode }) {
  const [draft, dispatch] = useReducer(reducer, undefined, loadDraft)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)

  // Autosave, debounced so typing doesn't serialise on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      const ok = saveDraft(draft)
      setSaveFailed(!ok)
      if (ok) setSavedAt(new Date().toISOString())
    }, 300)
    return () => clearTimeout(t)
  }, [draft])

  const value = useMemo(() => {
    const issues = checkDraft(draft)
    return { draft, dispatch, issues, worst: worstByEntity(issues), savedAt, saveFailed }
  }, [draft, savedAt, saveFailed])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useDraft(): DraftState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useDraft outside DraftProvider')
  return v
}

export const newUid = () => crypto.randomUUID()
