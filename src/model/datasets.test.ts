import { describe, expect, it } from 'vitest'
import { idrLikeDraft, run } from '../test/fixtures'
import { datasetRelFor, datasetSlots } from './datasets'

describe('datasetSlots', () => {
  it('lists the filled experimental slots with no missing ones', () => {
    const slots = datasetSlots(idrLikeDraft(), 'ds')
    expect(slots.map((s) => [s.rel, s.targets, s.missing])).toEqual([
      ['associatedBiologicalEntity', ['bs'], false],
      ['associatedSpecimenImagingPreparationProtocol', ['sp'], false],
      ['associatedImageAcquisitionProtocol', ['iap'], false],
    ])
  })

  it('flags empty experimental slots as missing', () => {
    const d = run([{ kind: 'add', uid: 'ds2', entityType: 'dataset' }, { kind: 'link', from: 'ds2', rel: 'associatedBiologicalEntity', to: 'bs' }], idrLikeDraft())
    expect(datasetSlots(d, 'ds2').map((s) => [s.rel, s.missing])).toEqual([
      ['associatedBiologicalEntity', false],
      ['associatedSpecimenImagingPreparationProtocol', true],
      ['associatedImageAcquisitionProtocol', true],
    ])
  })

  it('treats a dataset with an annotation method as complete', () => {
    const d = run(
      [
        { kind: 'add', uid: 'am', entityType: 'annotationMethod' },
        { kind: 'add', uid: 'ds2', entityType: 'dataset' },
        { kind: 'link', from: 'ds2', rel: 'associatedAnnotationMethod', to: 'am' },
      ],
      idrLikeDraft(),
    )
    expect(datasetSlots(d, 'ds2')).toEqual([
      { rel: 'associatedAnnotationMethod', label: 'Annotation methods', targets: ['am'], missing: false },
    ])
  })
})

describe('datasetRelFor', () => {
  it('maps component types to the dataset relation that links them', () => {
    expect(datasetRelFor('bioSample')).toBe('associatedBiologicalEntity')
    expect(datasetRelFor('annotationMethod')).toBe('associatedAnnotationMethod')
    expect(datasetRelFor('contributor')).toBeUndefined()
    expect(datasetRelFor('taxon')).toBeUndefined()
  })
})
