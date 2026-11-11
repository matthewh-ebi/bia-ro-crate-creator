import { emptyDraft, reducer, STUDY_UID, type Action, type Draft } from '../model/draft'

/** Apply actions in order. */
export function run(actions: Action[], start: Draft = emptyDraft()): Draft {
  return actions.reduce(reducer, start)
}

/** A small, complete experimental crate modelled on idr0027. */
export function idrLikeDraft(): Draft {
  return run([
    { kind: 'setField', uid: STUDY_UID, key: 'name', value: 'idr0027 chromatin' },
    { kind: 'setField', uid: STUDY_UID, key: 'description', value: 'Live imaging of chromatin.' },
    { kind: 'setField', uid: STUDY_UID, key: 'license', value: 'https://creativecommons.org/licenses/by/4.0/' },
    { kind: 'setField', uid: STUDY_UID, key: 'keywords', value: ['time-lapse imaging', ' '] },
    { kind: 'add', uid: 'a1', entityType: 'contributor', linkFrom: { from: STUDY_UID, rel: 'author' } },
    { kind: 'setField', uid: 'a1', key: 'name', value: 'Dickerson D' },
    { kind: 'add', uid: 'aff1', entityType: 'affiliation', linkFrom: { from: 'a1', rel: 'memberOf' } },
    { kind: 'setField', uid: 'aff1', key: 'name', value: 'University of Dundee' },
    { kind: 'setIri', uid: 'aff1', value: '03h2bxq36' },
    { kind: 'add', uid: 'pub1', entityType: 'publication', linkFrom: { from: STUDY_UID, rel: 'relatedPublication' } },
    { kind: 'setField', uid: 'pub1', key: 'name', value: 'High resolution imaging' },
    { kind: 'setIri', uid: 'pub1', value: '10.1186/s12860-016-0111-y' },
    { kind: 'add', uid: 'bs', entityType: 'bioSample' },
    { kind: 'setField', uid: 'bs', key: 'name', value: 'DD1407' },
    { kind: 'add', uid: 'tax', entityType: 'taxon', linkFrom: { from: 'bs', rel: 'organismClassification' } },
    { kind: 'setField', uid: 'tax', key: 'scientificName', value: 'Saccharomyces cerevisiae' },
    { kind: 'setIri', uid: 'tax', value: '4932' },
    { kind: 'add', uid: 'sp', entityType: 'specimenPrep' },
    { kind: 'setField', uid: 'sp', key: 'name', value: 'Fluorescent labelling' },
    { kind: 'setField', uid: 'sp', key: 'description', value: 'TetO/LacO arrays.' },
    { kind: 'add', uid: 'iap', entityType: 'imageAcquisition' },
    { kind: 'setField', uid: 'iap', key: 'name', value: 'OMX imaging' },
    { kind: 'setField', uid: 'iap', key: 'description', value: 'GE OMX Blaze.' },
    { kind: 'add', uid: 'ds', entityType: 'dataset' },
    { kind: 'setField', uid: 'ds', key: 'name', value: 'Colocalising' },
    { kind: 'link', from: 'ds', rel: 'associatedBiologicalEntity', to: 'bs' },
    { kind: 'link', from: 'ds', rel: 'associatedSpecimenImagingPreparationProtocol', to: 'sp' },
    { kind: 'link', from: 'ds', rel: 'associatedImageAcquisitionProtocol', to: 'iap' },
  ])
}
