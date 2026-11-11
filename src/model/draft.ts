import { SPEC_BY_TYPE } from '../schema/biaSchema'
import type { EntityType, RelationSpec } from '../schema/types'

/**
 * Editor state: entities hold only literal values; relationships are a
 * separate ordered edge list. Internal uids are stable and never exported —
 * RO-Crate `@id`s are derived at export time.
 */

export type FieldValue = string | string[]

export interface Entity {
  uid: string
  type: EntityType
  fields: Record<string, FieldValue>
  /** Raw external identifier as typed (ORCID/ROR/DOI/taxon); '' if none. */
  iri: string
}

export interface Relationship {
  from: string
  /** Relation key from the source type's spec, e.g. `associatedBiologicalEntity`. */
  rel: string
  to: string
}

export interface Draft {
  schemaVersion: 1
  entities: Entity[]
  relationships: Relationship[]
  updatedAt: string
}

export type Action =
  | { kind: 'add'; uid: string; entityType: EntityType; linkFrom?: { from: string; rel: string } }
  | { kind: 'setField'; uid: string; key: string; value: FieldValue }
  | { kind: 'setIri'; uid: string; value: string }
  | { kind: 'delete'; uid: string }
  | { kind: 'link'; from: string; rel: string; to: string }
  | { kind: 'unlink'; from: string; rel: string; to: string }
  | { kind: 'move'; from: string; rel: string; to: string; delta: -1 | 1 }
  | { kind: 'replace'; draft: Draft }

export const STUDY_UID = 'study'

export function emptyDraft(now = new Date()): Draft {
  return {
    schemaVersion: 1,
    entities: [{ uid: STUDY_UID, type: 'study', fields: {}, iri: '' }],
    relationships: [],
    updatedAt: now.toISOString(),
  }
}

export function relationSpec(type: EntityType, rel: string): RelationSpec | undefined {
  return SPEC_BY_TYPE[type].relations.find((r) => r.key === rel)
}

/** Targets of `from.rel`, in order. */
export function targetsOf(draft: Draft, from: string, rel: string): string[] {
  return draft.relationships.filter((r) => r.from === from && r.rel === rel).map((r) => r.to)
}

/** Edges pointing at `uid`. */
export function referrersOf(draft: Draft, uid: string): Relationship[] {
  return draft.relationships.filter((r) => r.to === uid)
}

function canLink(draft: Draft, from: string, rel: string, to: string): RelationSpec | undefined {
  const src = draft.entities.find((e) => e.uid === from)
  const dst = draft.entities.find((e) => e.uid === to)
  if (!src || !dst) return undefined
  const spec = relationSpec(src.type, rel)
  return spec && spec.target === dst.type ? spec : undefined
}

function link(draft: Draft, from: string, rel: string, to: string): Relationship[] {
  const spec = canLink(draft, from, rel, to)
  if (!spec) return draft.relationships
  const exists = draft.relationships.some((r) => r.from === from && r.rel === rel && r.to === to)
  if (exists) return draft.relationships
  // Single-valued relations replace their current target.
  const kept = spec.many
    ? draft.relationships
    : draft.relationships.filter((r) => !(r.from === from && r.rel === rel))
  return [...kept, { from, rel, to }]
}

function updateEntity(draft: Draft, uid: string, fn: (e: Entity) => Entity): Entity[] {
  return draft.entities.map((e) => (e.uid === uid ? fn(e) : e))
}

function apply(draft: Draft, action: Action): Draft {
  switch (action.kind) {
    case 'add': {
      if (SPEC_BY_TYPE[action.entityType].singleton) return draft
      const entity: Entity = { uid: action.uid, type: action.entityType, fields: {}, iri: '' }
      const next = { ...draft, entities: [...draft.entities, entity] }
      if (!action.linkFrom) return next
      return { ...next, relationships: link(next, action.linkFrom.from, action.linkFrom.rel, action.uid) }
    }
    case 'setField':
      return {
        ...draft,
        entities: updateEntity(draft, action.uid, (e) => ({
          ...e,
          fields: { ...e.fields, [action.key]: action.value },
        })),
      }
    case 'setIri':
      return { ...draft, entities: updateEntity(draft, action.uid, (e) => ({ ...e, iri: action.value })) }
    case 'delete': {
      const target = draft.entities.find((e) => e.uid === action.uid)
      if (!target || SPEC_BY_TYPE[target.type].singleton) return draft
      return {
        ...draft,
        entities: draft.entities.filter((e) => e.uid !== action.uid),
        // Cascade: no dangling references can exist in the draft.
        relationships: draft.relationships.filter((r) => r.from !== action.uid && r.to !== action.uid),
      }
    }
    case 'link':
      return { ...draft, relationships: link(draft, action.from, action.rel, action.to) }
    case 'unlink':
      return {
        ...draft,
        relationships: draft.relationships.filter(
          (r) => !(r.from === action.from && r.rel === action.rel && r.to === action.to),
        ),
      }
    case 'move': {
      // Reorder within the (from, rel) sequence by swapping with a neighbour.
      const rels = [...draft.relationships]
      const idxs = rels.flatMap((r, i) => (r.from === action.from && r.rel === action.rel ? [i] : []))
      const pos = idxs.findIndex((i) => rels[i].to === action.to)
      const swap = pos + action.delta
      if (pos < 0 || swap < 0 || swap >= idxs.length) return draft
      const a = idxs[pos]
      const b = idxs[swap]
      ;[rels[a], rels[b]] = [rels[b], rels[a]]
      return { ...draft, relationships: rels }
    }
    case 'replace':
      return action.draft
  }
}

/**
 * Remove embedded entities (e.g. organisms) that nothing links to any more,
 * along with their outgoing edges. Repeats until stable, since removing one
 * can orphan another.
 */
export function pruneOrphans(draft: Draft): Draft {
  let current = draft
  for (;;) {
    const linked = new Set(current.relationships.map((r) => r.to))
    const orphans = new Set(
      current.entities.filter((e) => SPEC_BY_TYPE[e.type].embedded && !linked.has(e.uid)).map((e) => e.uid),
    )
    if (orphans.size === 0) return current
    current = {
      ...current,
      entities: current.entities.filter((e) => !orphans.has(e.uid)),
      relationships: current.relationships.filter((r) => !orphans.has(r.from)),
    }
  }
}

export function reducer(draft: Draft, action: Action): Draft {
  const next = apply(draft, action)
  if (next === draft || action.kind === 'replace') return next
  return { ...pruneOrphans(next), updatedAt: new Date().toISOString() }
}

/** Titles of an entity's embedded parts, e.g. a BioSample's organisms. */
export function embeddedSummary(draft: Draft, entity: Entity): string {
  const byUid = new Map(draft.entities.map((e) => [e.uid, e]))
  return SPEC_BY_TYPE[entity.type].relations
    .filter((r) => SPEC_BY_TYPE[r.target].embedded)
    .flatMap((r) => targetsOf(draft, entity.uid, r.key).map((uid) => titleOf(byUid.get(uid)!)))
    .join(', ')
}

/** The entities linking to an embedded entity — where it is edited. */
export function ownersOf(draft: Draft, uid: string): Entity[] {
  const from = new Set(draft.relationships.filter((r) => r.to === uid).map((r) => r.from))
  return draft.entities.filter((e) => from.has(e.uid))
}

/** Display name for an entity (falls back to "Untitled <type>"). */
export function titleOf(entity: Entity): string {
  const spec = SPEC_BY_TYPE[entity.type]
  const v = entity.fields[spec.titleField]
  const s = Array.isArray(v) ? v.join(', ') : (v ?? '')
  return s.trim() || `Untitled ${spec.label.toLowerCase()}`
}

/**
 * Read a draft from localStorage or a backup file. Tolerates drafts saved by
 * an older schema: entities of types the editor no longer supports (e.g.
 * protocols, signal channels) and links that are no longer valid are dropped,
 * rather than rejecting the whole draft. Returns null if it isn't a draft.
 */
export function readDraft(value: unknown): Draft | null {
  if (typeof value !== 'object' || value === null) return null
  const d = value as Partial<Draft>
  if (d.schemaVersion !== 1 || !Array.isArray(d.entities) || !Array.isArray(d.relationships)) return null

  const entities = d.entities.filter(
    (e): e is Entity =>
      typeof e?.uid === 'string' && typeof e.type === 'string' && e.type in SPEC_BY_TYPE && typeof e.fields === 'object',
  )
  if (!entities.some((e) => e.uid === STUDY_UID && e.type === 'study')) return null
  const typeOf = new Map(entities.map((e) => [e.uid, e.type]))

  const relationships = d.relationships.filter((r): r is Relationship => {
    const from = typeOf.get(r?.from)
    const to = typeOf.get(r?.to)
    return from !== undefined && to !== undefined && relationSpec(from, r.rel)?.target === to
  })

  return pruneOrphans({
    schemaVersion: 1,
    entities: entities.map((e) => ({ ...e, iri: typeof e.iri === 'string' ? e.iri : '' })),
    relationships,
    updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : new Date().toISOString(),
  })
}
