import { describe, expect, it } from 'vitest'
import { checkDraft, worstByEntity } from './checks'
import { emptyDraft, STUDY_UID } from './draft'
import { idrLikeDraft, run } from '../test/fixtures'

const errors = (d: ReturnType<typeof emptyDraft>) => checkDraft(d).filter((i) => i.severity === 'error')

describe('checkDraft', () => {
  it('a complete experimental crate has no errors or warnings', () => {
    const issues = checkDraft(idrLikeDraft()).filter((i) => i.severity !== 'info')
    expect(issues).toEqual([])
  })

  it('flags required study fields and missing datasets on an empty draft', () => {
    const msgs = errors(emptyDraft()).map((i) => i.key ?? i.message)
    expect(msgs).toEqual(expect.arrayContaining(['name', 'description', 'accessionId', 'license']))
    expect(msgs).toContain('The study has no datasets yet.')
  })

  it('accepts an annotation-only dataset without biosample/protocols', () => {
    const d = run(
      [
        { kind: 'add', uid: 'am', entityType: 'annotationMethod' },
        { kind: 'setField', uid: 'am', key: 'name', value: 'Masks' },
        { kind: 'add', uid: 'ds2', entityType: 'dataset' },
        { kind: 'setField', uid: 'ds2', key: 'name', value: 'Masks' },
        { kind: 'link', from: 'ds2', rel: 'associatedAnnotationMethod', to: 'am' },
      ],
      idrLikeDraft(),
    )
    expect(errors(d).filter((i) => i.uid === 'ds2')).toEqual([])
  })

  it('names the missing parts of a partial experimental dataset', () => {
    const d = run([{ kind: 'unlink', from: 'ds', rel: 'associatedImageAcquisitionProtocol', to: 'iap' }], idrLikeDraft())
    const ds = errors(d).filter((i) => i.uid === 'ds')
    expect(ds).toHaveLength(1)
    expect(ds[0].message).toContain('Image acquisition')
    // …and the now-orphaned protocol is flagged as unlinked.
    expect(checkDraft(d).some((i) => i.uid === 'iap' && i.severity === 'warning')).toBe(true)
  })

  it('flags a BioSample without an organism', () => {
    const d = run([{ kind: 'unlink', from: 'bs', rel: 'organismClassification', to: 'tax' }], idrLikeDraft())
    expect(errors(d).some((i) => i.uid === 'bs' && i.key === 'organismClassification')).toBe(true)
  })

  it('flags a duplicated organism and suggests reusing it', () => {
    const d = run(
      [
        { kind: 'add', uid: 'bs2', entityType: 'bioSample' },
        { kind: 'add', uid: 'tax2', entityType: 'taxon', linkFrom: { from: 'bs2', rel: 'organismClassification' } },
        { kind: 'setField', uid: 'tax2', key: 'scientificName', value: 'Yeast' },
        { kind: 'setIri', uid: 'tax2', value: 'NCBITaxon_4932' },
      ],
      idrLikeDraft(),
    )
    const dup = errors(d).filter((i) => i.message.includes('NCBITaxon_4932'))
    expect(dup.map((i) => i.uid).sort()).toEqual(['tax', 'tax2'])
    expect(dup[0].message).toContain('Reuse it')
  })

  it('counts organism problems against the owning BioSample', () => {
    const d = run([{ kind: 'setField', uid: 'tax', key: 'scientificName', value: '' }], idrLikeDraft())
    expect(worstByEntity(checkDraft(d), d).get('bs')).toBe('error')
  })

  it('does not warn that an organism is unlinked when its BioSample is', () => {
    const d = run([{ kind: 'unlink', from: 'ds', rel: 'associatedBiologicalEntity', to: 'bs' }], idrLikeDraft())
    const warned = checkDraft(d).filter((i) => i.severity === 'warning').map((i) => i.uid)
    expect(warned).toContain('bs')
    expect(warned).not.toContain('tax')
  })

  it('treats whitespace-only values as empty', () => {
    const d = run([{ kind: 'setField', uid: STUDY_UID, key: 'name', value: '   ' }], idrLikeDraft())
    expect(errors(d).some((i) => i.key === 'name')).toBe(true)
  })
})
