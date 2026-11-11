import type { EntityType, IriSpec, TypeSpec } from './types'

/**
 * The BIA entity types the editor supports. Terms (field and relation keys)
 * match the BIA @context used by the reference crates (idr0027,
 * Crowdsourcing_histopathology); requirement levels follow the explorer's
 * `biaProfile` where it has an opinion.
 */

// ── IRI shorthands ──────────────────────────────────────────────────────────

const isUrl = (s: string) => /^https?:\/\//i.test(s)

export const doiIri: IriSpec = {
  label: 'DOI',
  placeholder: '10.1186/s12860-016-0111-y',
  help: 'Becomes the publication @id (and its doi).',
  alsoAs: 'doi',
  normalise: (raw) => {
    const s = raw.trim().replace(/^doi:\s*/i, '')
    return !s || isUrl(s) ? s : `https://doi.org/${s}`
  },
}

const orcidIri: IriSpec = {
  label: 'ORCID',
  placeholder: '0000-0002-1825-0097',
  help: 'Optional. Becomes the person’s @id.',
  normalise: (raw) => {
    const s = raw.trim()
    return !s || isUrl(s) ? s : `https://orcid.org/${s}`
  },
}

const rorIri: IriSpec = {
  label: 'ROR',
  placeholder: '03h2bxq36',
  help: 'Optional. Becomes the organisation’s @id.',
  normalise: (raw) => {
    const s = raw.trim()
    return !s || isUrl(s) ? s : `https://ror.org/${s}`
  },
}

const ncbiTaxonIri: IriSpec = {
  label: 'NCBI Taxon ID',
  placeholder: '4932',
  help: 'Becomes the taxon @id (http://purl.obolibrary.org/obo/NCBITaxon_<id>).',
  normalise: (raw) => {
    const s = raw.trim()
    if (!s || isUrl(s)) return s
    const m = s.match(/(\d+)$/)
    return m ? `http://purl.obolibrary.org/obo/NCBITaxon_${m[1]}` : s
  },
}

// ── Vocabulary suggestions (open lists; not validated) ─────────────────────

const LICENCES = [
  'https://creativecommons.org/publicdomain/zero/1.0/',
  'https://creativecommons.org/licenses/by/4.0/',
] as const

const CONTRIBUTOR_ROLES = ['author', 'submitter', 'corresponding author', 'first author'] as const

const IMAGING_METHODS = [
  'fluorescence microscopy',
  'confocal microscopy',
  'brightfield microscopy',
  'light sheet microscopy',
  'super-resolution microscopy',
  'electron microscopy',
  'X-ray tomography',
] as const

const ANNOTATION_METHOD_TYPES = [
  'class_labels',
  'bounding_boxes',
  'counts',
  'derived_annotations',
  'geometrical_annotations',
  'graphs',
  'point_annotations',
  'segmentation_mask',
  'tracks',
  'weak_annotations',
  'other',
] as const

// ── Types ───────────────────────────────────────────────────────────────────

export const TYPE_SPECS: readonly TypeSpec[] = [
  {
    type: 'study',
    label: 'Study',
    plural: 'Study',
    group: 'Study',
    jsonldType: ['Dataset', 'bia:Study'],
    idPrefix: 'study',
    titleField: 'name',
    singleton: true,
    description:
      'The crate root (“./”). Every dataset is automatically part of the study. The accession ID is assigned by the BioImage Archive on submission, so it is not part of the crate.',
    fields: [
      { key: 'name', label: 'Title', kind: 'text', requirement: 'required' },
      { key: 'description', label: 'Description', kind: 'textarea', requirement: 'required' },
      { key: 'license', label: 'Licence', kind: 'url', requirement: 'required', suggestions: LICENCES },
      { key: 'datePublished', label: 'Release date', kind: 'date', requirement: 'recommended' },
      { key: 'keywords', label: 'Keywords', kind: 'list', requirement: 'recommended' },
      { key: 'acknowledgement', label: 'Acknowledgements', kind: 'textarea', requirement: 'optional' },
    ],
    relations: [
      { key: 'author', label: 'Authors', target: 'contributor', many: true, requirement: 'recommended', help: 'In author order.' },
      { key: 'relatedPublication', label: 'Related publications', target: 'publication', many: true, requirement: 'recommended' },
      { key: 'funding', label: 'Funding', target: 'grant', many: true, requirement: 'optional' },
    ],
  },
  {
    type: 'publication',
    label: 'Publication',
    plural: 'Publications',
    group: 'Study',
    jsonldType: ['bia:Publication'],
    idPrefix: 'publication',
    titleField: 'name',
    iri: doiIri,
    fields: [
      { key: 'name', label: 'Title', kind: 'text', requirement: 'required' },
      { key: 'authorNames', label: 'Author names', kind: 'text', requirement: 'recommended', placeholder: 'Smith J, Jones A, …' },
      { key: 'yearPublished', label: 'Year', kind: 'text', requirement: 'optional', placeholder: '2016' },
      { key: 'pubmedId', label: 'PubMed ID', kind: 'text', requirement: 'optional' },
    ],
    relations: [],
  },
  {
    type: 'contributor',
    label: 'Author',
    plural: 'Authors',
    group: 'People & funding',
    jsonldType: ['Person', 'bia:Contributor'],
    idPrefix: 'author',
    titleField: 'name',
    iri: orcidIri,
    fields: [
      { key: 'name', label: 'Name', kind: 'text', requirement: 'required' },
      { key: 'email', label: 'Email', kind: 'email', requirement: 'optional' },
      { key: 'role', label: 'Roles', kind: 'list', requirement: 'optional', suggestions: CONTRIBUTOR_ROLES },
    ],
    relations: [
      { key: 'memberOf', label: 'Affiliations', target: 'affiliation', many: true, requirement: 'recommended' },
    ],
  },
  {
    type: 'affiliation',
    label: 'Affiliation',
    plural: 'Affiliations',
    group: 'People & funding',
    jsonldType: ['Organisation', 'bia:Affiliation'],
    idPrefix: 'affiliation',
    titleField: 'name',
    iri: rorIri,
    fields: [
      { key: 'name', label: 'Name', kind: 'text', requirement: 'required' },
      { key: 'address', label: 'Address', kind: 'text', requirement: 'optional' },
      { key: 'website', label: 'Website', kind: 'url', requirement: 'optional' },
    ],
    relations: [],
  },
  {
    type: 'grant',
    label: 'Grant',
    plural: 'Grants',
    group: 'People & funding',
    jsonldType: ['Grant', 'bia:Grant'],
    idPrefix: 'grant',
    titleField: 'identifier',
    fields: [
      { key: 'identifier', label: 'Grant ID', kind: 'text', requirement: 'required' },
      { key: 'name', label: 'Grant title', kind: 'text', requirement: 'optional' },
    ],
    relations: [
      { key: 'funder', label: 'Funder', target: 'fundingBody', many: true, requirement: 'recommended' },
    ],
  },
  {
    type: 'fundingBody',
    label: 'Funder',
    plural: 'Funders',
    group: 'People & funding',
    jsonldType: ['Organization', 'bia:FundingBody'],
    idPrefix: 'funder',
    titleField: 'name',
    iri: rorIri,
    fields: [{ key: 'name', label: 'Name', kind: 'text', requirement: 'required' }],
    relations: [],
  },
  {
    type: 'bioSample',
    label: 'BioSample',
    plural: 'BioSamples',
    group: 'Biology',
    jsonldType: ['bia:BioSample'],
    idPrefix: 'biosample',
    titleField: 'name',
    description: 'REMBI Biosample: the biological entity that was imaged.',
    fields: [
      { key: 'name', label: 'Name', kind: 'text', requirement: 'required' },
      { key: 'description', label: 'Description', kind: 'textarea', requirement: 'recommended' },
      { key: 'intrinsicVariableDescription', label: 'Intrinsic variables', kind: 'list', requirement: 'optional', help: 'e.g. genotype' },
      { key: 'extrinsicVariableDescription', label: 'Extrinsic variables', kind: 'list', requirement: 'optional', help: 'e.g. treatments' },
      { key: 'experimentalVariableDescription', label: 'Experimental variables', kind: 'list', requirement: 'optional' },
    ],
    relations: [
      { key: 'organismClassification', label: 'Organism', target: 'taxon', many: true, requirement: 'required' },
    ],
  },
  {
    type: 'taxon',
    label: 'Organism',
    plural: 'Organisms',
    group: 'Biology',
    embedded: true,
    jsonldType: ['bia:Taxon'],
    idPrefix: 'taxon',
    titleField: 'scientificName',
    iri: ncbiTaxonIri,
    fields: [
      { key: 'scientificName', label: 'Scientific name', kind: 'text', requirement: 'required', placeholder: 'Saccharomyces cerevisiae' },
      { key: 'commonName', label: 'Common name', kind: 'text', requirement: 'optional' },
    ],
    relations: [],
  },
  {
    type: 'specimenPrep',
    label: 'Specimen preparation',
    plural: 'Specimen preparation',
    group: 'Imaging',
    jsonldType: ['bia:SpecimenImagingPreparationProtocol'],
    idPrefix: 'specimen-prep',
    titleField: 'name',
    description: 'REMBI Specimen: how the biosample was prepared for imaging.',
    fields: [
      { key: 'name', label: 'Name', kind: 'text', requirement: 'required' },
      { key: 'description', label: 'Description', kind: 'textarea', requirement: 'required' },
    ],
    relations: [],
  },
  {
    type: 'imageAcquisition',
    label: 'Image acquisition',
    plural: 'Image acquisition',
    group: 'Imaging',
    jsonldType: ['bia:ImageAcquisitionProtocol'],
    idPrefix: 'image-acquisition',
    titleField: 'name',
    description: 'REMBI Image Acquisition: instrument and imaging method.',
    fields: [
      { key: 'name', label: 'Name', kind: 'text', requirement: 'required' },
      { key: 'description', label: 'Description', kind: 'textarea', requirement: 'required' },
      { key: 'imagingInstrumentDescription', label: 'Instrument', kind: 'text', requirement: 'recommended' },
      { key: 'imagingMethodName', label: 'Imaging methods', kind: 'list', requirement: 'recommended', suggestions: IMAGING_METHODS },
      { key: 'fbbiId', label: 'FBbi IDs', kind: 'list', requirement: 'optional', placeholder: 'FBbi_00000246' },
    ],
    relations: [],
  },
  {
    type: 'annotationMethod',
    label: 'Annotation method',
    plural: 'Annotation methods',
    group: 'Annotation',
    jsonldType: ['bia:AnnotationMethod'],
    idPrefix: 'annotation-method',
    titleField: 'name',
    fields: [
      { key: 'name', label: 'Name', kind: 'text', requirement: 'required' },
      { key: 'description', label: 'Description', kind: 'textarea', requirement: 'optional' },
      { key: 'methodType', label: 'Method types', kind: 'list', requirement: 'recommended', suggestions: ANNOTATION_METHOD_TYPES },
      { key: 'annotationCriteria', label: 'Criteria', kind: 'textarea', requirement: 'recommended' },
      { key: 'annotationCoverage', label: 'Coverage', kind: 'text', requirement: 'recommended' },
      { key: 'annotationSourceIndicator', label: 'Source indicator', kind: 'text', requirement: 'optional' },
    ],
    relations: [],
  },
  {
    type: 'dataset',
    label: 'Dataset',
    plural: 'Datasets',
    group: 'Datasets',
    jsonldType: ['Dataset', 'bia:Dataset'],
    idPrefix: 'dataset',
    titleField: 'name',
    description:
      'Links REMBI components together. A dataset is either experimental (BioSample + specimen preparation + image acquisition) or an annotation dataset (annotation method).',
    fields: [
      { key: 'name', label: 'Name', kind: 'text', requirement: 'required' },
      { key: 'description', label: 'Description', kind: 'textarea', requirement: 'recommended' },
    ],
    relations: [
      { key: 'associatedBiologicalEntity', label: 'BioSamples', target: 'bioSample', many: true, requirement: 'optional' },
      { key: 'associatedSpecimenImagingPreparationProtocol', label: 'Specimen preparation', target: 'specimenPrep', many: true, requirement: 'optional' },
      { key: 'associatedImageAcquisitionProtocol', label: 'Image acquisition', target: 'imageAcquisition', many: true, requirement: 'optional' },
      { key: 'associatedAnnotationMethod', label: 'Annotation methods', target: 'annotationMethod', many: true, requirement: 'optional' },
    ],
  },
]

export const SPEC_BY_TYPE: Readonly<Record<EntityType, TypeSpec>> = Object.fromEntries(
  TYPE_SPECS.map((s) => [s.type, s]),
) as Record<EntityType, TypeSpec>

/** Sidebar group order. */
export const GROUPS = ['Study', 'People & funding', 'Biology', 'Imaging', 'Annotation', 'Datasets'] as const

/** Dataset association keys that make a dataset "experimental". */
export const EXPERIMENTAL_TRIPLE = [
  'associatedBiologicalEntity',
  'associatedSpecimenImagingPreparationProtocol',
  'associatedImageAcquisitionProtocol',
] as const
export const ANNOTATION_KEY = 'associatedAnnotationMethod'
