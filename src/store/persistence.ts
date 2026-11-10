import { emptyDraft, isDraft, type Draft } from '../model/draft'

export const STORAGE_KEY = 'bia-ro-crate-editor:draft:v1'

export function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (isDraft(parsed)) return parsed
    }
  } catch {
    // Unreadable or blocked storage: start fresh rather than fail.
  }
  return emptyDraft()
}

export function saveDraft(draft: Draft): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
    return true
  } catch {
    return false
  }
}

export function downloadBlob(filename: string, data: BlobPart, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
