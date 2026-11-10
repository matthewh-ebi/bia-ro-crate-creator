import { describe, expect, it } from 'vitest'
import { emptyDraft, isDraft, reducer, STUDY_UID, targetsOf } from './draft'
import { run } from '../test/fixtures'

describe('draft reducer', () => {
  it('starts with a singleton study that cannot be deleted or duplicated', () => {
    const d = run([
      { kind: 'delete', uid: STUDY_UID },
      { kind: 'add', uid: 'x', entityType: 'study' },
    ])
    expect(d.entities.filter((e) => e.type === 'study')).toHaveLength(1)
  })

  it('adds and links in one step', () => {
    const d = run([{ kind: 'add', uid: 'a', entityType: 'contributor', linkFrom: { from: STUDY_UID, rel: 'author' } }])
    expect(targetsOf(d, STUDY_UID, 'author')).toEqual(['a'])
  })

  it('rejects links to the wrong target type and unknown relations', () => {
    const d = run([
      { kind: 'add', uid: 'a', entityType: 'contributor' },
      { kind: 'add', uid: 't', entityType: 'taxon' },
      { kind: 'link', from: STUDY_UID, rel: 'author', to: 't' },
      { kind: 'link', from: STUDY_UID, rel: 'nonsense', to: 'a' },
    ])
    expect(d.relationships).toEqual([])
  })

  it('does not duplicate edges', () => {
    const d = run([
      { kind: 'add', uid: 'a', entityType: 'contributor' },
      { kind: 'link', from: STUDY_UID, rel: 'author', to: 'a' },
      { kind: 'link', from: STUDY_UID, rel: 'author', to: 'a' },
    ])
    expect(d.relationships).toHaveLength(1)
  })

  it('single-valued relations replace their target', () => {
    const d = run([
      { kind: 'add', uid: 'bs', entityType: 'bioSample' },
      { kind: 'add', uid: 'p1', entityType: 'protocol' },
      { kind: 'add', uid: 'p2', entityType: 'protocol' },
      { kind: 'link', from: 'bs', rel: 'growthProtocol', to: 'p1' },
      { kind: 'link', from: 'bs', rel: 'growthProtocol', to: 'p2' },
    ])
    expect(targetsOf(d, 'bs', 'growthProtocol')).toEqual(['p2'])
  })

  it('cascades edge removal on delete', () => {
    const d = run([
      { kind: 'add', uid: 'a', entityType: 'contributor', linkFrom: { from: STUDY_UID, rel: 'author' } },
      { kind: 'add', uid: 'f', entityType: 'affiliation', linkFrom: { from: 'a', rel: 'memberOf' } },
      { kind: 'delete', uid: 'a' },
    ])
    expect(d.relationships).toEqual([])
    expect(d.entities.map((e) => e.uid)).toEqual([STUDY_UID, 'f'])
  })

  it('reorders within a relation', () => {
    const d = run([
      { kind: 'add', uid: 'a', entityType: 'contributor', linkFrom: { from: STUDY_UID, rel: 'author' } },
      { kind: 'add', uid: 'b', entityType: 'contributor', linkFrom: { from: STUDY_UID, rel: 'author' } },
      { kind: 'add', uid: 'c', entityType: 'contributor', linkFrom: { from: STUDY_UID, rel: 'author' } },
      { kind: 'move', from: STUDY_UID, rel: 'author', to: 'c', delta: -1 },
      { kind: 'move', from: STUDY_UID, rel: 'author', to: 'a', delta: -1 }, // no-op at top
    ])
    expect(targetsOf(d, STUDY_UID, 'author')).toEqual(['a', 'c', 'b'])
  })

  it('returns the same object for no-op actions', () => {
    const d = emptyDraft()
    expect(reducer(d, { kind: 'unlink', from: 'x', rel: 'y', to: 'z' }).relationships).toEqual([])
    expect(reducer(d, { kind: 'delete', uid: 'missing' })).toBe(d)
  })

  it('recognises valid drafts only', () => {
    expect(isDraft(emptyDraft())).toBe(true)
    expect(isDraft({ schemaVersion: 1, entities: [], relationships: [] })).toBe(false)
    expect(isDraft({ '@context': [], '@graph': [] })).toBe(false)
  })
})
