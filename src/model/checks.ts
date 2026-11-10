import { ANNOTATION_KEY, EXPERIMENTAL_TRIPLE, SPEC_BY_TYPE } from '../schema/biaSchema'
import { STUDY_UID, relationSpec, targetsOf, type Draft, type Entity, type FieldValue } from './draft'

/**
 * Completeness checks run live in the editor. They mirror the explorer's
 * profile rules where they apply to metadata alone (file-list rules are out of
 * scope until the editor handles files).
 */

export type Severity = 'error' | 'warning' | 'info'

export interface Issue {
  uid: string
  severity: Severity
  message: string
  /** Field or relation key the issue is about, if any. */
  key?: string
}

export function isFilled(v: FieldValue | undefined): boolean {
  if (v === undefined) return false
  return Array.isArray(v) ? v.some((s) => s.trim() !== '') : v.trim() !== ''
}

function checkEntity(draft: Draft, e: Entity, out: Issue[]): void {
  const spec = SPEC_BY_TYPE[e.type]
  for (const f of spec.fields) {
    if (f.requirement === 'optional' || isFilled(e.fields[f.key])) continue
    out.push({
      uid: e.uid,
      key: f.key,
      severity: f.requirement === 'required' ? 'error' : 'info',
      message: `${f.label} is ${f.requirement}.`,
    })
  }
  for (const r of spec.relations) {
    if (r.requirement === 'optional' || targetsOf(draft, e.uid, r.key).length > 0) continue
    out.push({
      uid: e.uid,
      key: r.key,
      severity: r.requirement === 'required' ? 'error' : 'info',
      message: `${r.label} ${r.requirement === 'required' ? 'is required' : 'is recommended'}.`,
    })
  }
}

/** A dataset is valid via the experimental triple OR an annotation method. */
function checkDataset(draft: Draft, e: Entity, out: Issue[]): void {
  if (targetsOf(draft, e.uid, ANNOTATION_KEY).length > 0) return
  const missing = EXPERIMENTAL_TRIPLE.filter((k) => targetsOf(draft, e.uid, k).length === 0)
  if (missing.length === 0) return
  const labels = missing.map((k) => relationSpec('dataset', k)!.label)
  out.push({
    uid: e.uid,
    severity: 'error',
    message:
      missing.length === EXPERIMENTAL_TRIPLE.length
        ? 'Needs either BioSample + specimen preparation + image acquisition (experimental), or an annotation method.'
        : `Experimental dataset is missing: ${labels.join(', ')}. (Or link an annotation method instead.)`,
  })
}

/** Entities reachable from the study root (datasets are always parts of it). */
export function reachable(draft: Draft): Set<string> {
  const seen = new Set<string>([STUDY_UID])
  const queue = [STUDY_UID, ...draft.entities.filter((e) => e.type === 'dataset').map((e) => e.uid)]
  for (const uid of queue) seen.add(uid)
  while (queue.length > 0) {
    const uid = queue.shift()!
    for (const r of draft.relationships) {
      if (r.from === uid && !seen.has(r.to)) {
        seen.add(r.to)
        queue.push(r.to)
      }
    }
  }
  return seen
}

export function checkDraft(draft: Draft): Issue[] {
  const out: Issue[] = []
  for (const e of draft.entities) {
    checkEntity(draft, e, out)
    if (e.type === 'dataset') checkDataset(draft, e, out)
  }

  if (!draft.entities.some((e) => e.type === 'dataset')) {
    out.push({ uid: STUDY_UID, severity: 'error', message: 'The study has no datasets yet.' })
  }

  const linked = reachable(draft)
  for (const e of draft.entities) {
    if (!linked.has(e.uid)) {
      out.push({
        uid: e.uid,
        severity: 'warning',
        message: 'Not linked from the study or any dataset. It will be exported, but nothing refers to it.',
      })
    }
  }

  // Two entities sharing an external identifier would collide on @id.
  const byIri = new Map<string, Entity[]>()
  for (const e of draft.entities) {
    const iri = SPEC_BY_TYPE[e.type].iri?.normalise(e.iri) ?? ''
    if (iri) byIri.set(iri, [...(byIri.get(iri) ?? []), e])
  }
  for (const [iri, es] of byIri) {
    if (es.length < 2) continue
    for (const e of es) {
      out.push({ uid: e.uid, severity: 'error', message: `Identifier ${iri} is used by ${es.length} entities.` })
    }
  }
  return out
}

export const SEVERITY_RANK: Record<Severity, number> = { error: 0, warning: 1, info: 2 }

/** Worst severity per entity uid. */
export function worstByEntity(issues: Issue[]): Map<string, Severity> {
  const m = new Map<string, Severity>()
  for (const i of issues) {
    const cur = m.get(i.uid)
    if (cur === undefined || SEVERITY_RANK[i.severity] < SEVERITY_RANK[cur]) m.set(i.uid, i.severity)
  }
  return m
}
