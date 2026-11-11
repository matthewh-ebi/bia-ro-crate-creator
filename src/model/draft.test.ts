import { describe, expect, it } from 'vitest'
import { emptyDraft, readDraft, reducer, STUDY_UID, targetsOf } from './draft'
import { idrLikeDraft } from '../test/fixtures'
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

  describe('embedded organisms', () => {
    const shared = () =>
      run(
        [
          { kind: 'add', uid: 'bs2', entityType: 'bioSample' },
          { kind: 'link', from: 'bs2', rel: 'organismClassification', to: 'tax' },
        ],
        idrLikeDraft(),
      )
    const has = (d: ReturnType<typeof emptyDraft>, uid: string) => d.entities.some((e) => e.uid === uid)

    it('removes an organism once its last BioSample drops it', () => {
      const d = run([{ kind: 'unlink', from: 'bs', rel: 'organismClassification', to: 'tax' }], idrLikeDraft())
      expect(has(d, 'tax')).toBe(false)
    })

    it('keeps a shared organism until no BioSample uses it', () => {
      const once = run([{ kind: 'unlink', from: 'bs', rel: 'organismClassification', to: 'tax' }], shared())
      expect(has(once, 'tax')).toBe(true)
      const twice = run([{ kind: 'delete', uid: 'bs2' }], once)
      expect(has(twice, 'tax')).toBe(false)
    })

    it('removes an organism when its BioSample is deleted', () => {
      expect(has(run([{ kind: 'delete', uid: 'bs' }], idrLikeDraft()), 'tax')).toBe(false)
    })

    it('discards an organism added without an owner', () => {
      expect(has(run([{ kind: 'add', uid: 't', entityType: 'taxon' }]), 't')).toBe(false)
    })
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
    const fresh = emptyDraft()
    expect(readDraft(fresh)).toEqual(fresh)
    expect(readDraft({ schemaVersion: 1, entities: [], relationships: [] })).toBeNull()
    expect(readDraft({ '@context': [], '@graph': [] })).toBeNull()
  })

  it('migrates drafts saved before protocols and signal channels were removed', () => {
    const old = idrLikeDraft()
    const legacy = {
      ...old,
      entities: [
        ...old.entities,
        { uid: 'gp', type: 'protocol', fields: { name: 'growth' }, iri: '' },
        { uid: 'ch', type: 'signalChannel', fields: {}, iri: '' },
        { uid: 'stray', type: 'taxon', fields: {}, iri: '' },
      ],
      relationships: [
        ...old.relationships,
        { from: 'bs', rel: 'growthProtocol', to: 'gp' },
        { from: 'sp', rel: 'signalChannelInformation', to: 'ch' },
      ],
    }
    const d = readDraft(JSON.parse(JSON.stringify(legacy)))!
    expect(d.entities.map((e) => e.uid)).toEqual(old.entities.map((e) => e.uid))
    expect(d.relationships).toEqual(old.relationships)
  })
})
