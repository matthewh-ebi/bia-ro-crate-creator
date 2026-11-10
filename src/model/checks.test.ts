import { describe, expect, it } from 'vitest'
import { checkDraft } from './checks'
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

  it('flags duplicate external identifiers', () => {
    const d = run(
      [
        { kind: 'add', uid: 'tax2', entityType: 'taxon' },
        { kind: 'setField', uid: 'tax2', key: 'scientificName', value: 'Yeast' },
        { kind: 'setIri', uid: 'tax2', value: 'NCBITaxon_4932' },
      ],
      idrLikeDraft(),
    )
    expect(errors(d).filter((i) => i.message.includes('NCBITaxon_4932')).map((i) => i.uid).sort()).toEqual(['tax', 'tax2'])
  })

  it('treats whitespace-only values as empty', () => {
    const d = run([{ kind: 'setField', uid: STUDY_UID, key: 'name', value: '   ' }], idrLikeDraft())
    expect(errors(d).some((i) => i.key === 'name')).toBe(true)
  })
})
