/**
 * Declarative description of the entity types the editor can create. Forms,
 * relationship pickers, completeness checks and the RO-Crate exporter are all
 * driven from this data — adding a field or relationship should be a change
 * to `biaSchema.ts`, not to UI or export code.
 */

export type EntityType =
  | 'study'
  | 'contributor'
  | 'affiliation'
  | 'publication'
  | 'grant'
  | 'fundingBody'
  | 'taxon'
  | 'bioSample'
  | 'protocol'
  | 'specimenPrep'
  | 'signalChannel'
  | 'imageAcquisition'
  | 'annotationMethod'
  | 'dataset'

export type Requirement = 'required' | 'recommended' | 'optional'

/** text: single line · textarea: multi-line · list: string[] (one per line) */
export type FieldKind = 'text' | 'textarea' | 'list' | 'date' | 'email' | 'url'

export interface FieldSpec {
  /** JSON-LD term (a key in the BIA @context) — exported verbatim. */
  key: string
  label: string
  kind: FieldKind
  requirement: Requirement
  help?: string
  placeholder?: string
  /** Offer these as suggestions (not enforced — vocabularies are open in v1). */
  suggestions?: readonly string[]
}

export interface RelationSpec {
  /** JSON-LD term on the *source* entity, e.g. `associatedBiologicalEntity`. */
  key: string
  label: string
  target: EntityType
  /** Exported as an array (the context declares `@container: @set`). */
  many: boolean
  requirement: Requirement
  help?: string
}

/**
 * Optional externally-resolvable identifier (ORCID, ROR, DOI, NCBI taxon).
 * When set it becomes the entity's `@id`; otherwise a local `#…` id is minted.
 */
export interface IriSpec {
  label: string
  placeholder: string
  help?: string
  /** Turns shorthand (e.g. a bare DOI or taxon number) into a full IRI. */
  normalise: (raw: string) => string
  /** Also write the normalised IRI to this property (e.g. a publication's `doi`). */
  alsoAs?: string
}

export interface TypeSpec {
  type: EntityType
  label: string
  plural: string
  /** Sidebar grouping. */
  group: string
  /** `@type` values written on export. */
  jsonldType: readonly string[]
  /** Prefix for minted local ids: `#<prefix>-<slug>`. */
  idPrefix: string
  /** Field whose value names the entity in lists/pickers. */
  titleField: string
  fields: readonly FieldSpec[]
  relations: readonly RelationSpec[]
  iri?: IriSpec
  /** Exactly one instance exists; it cannot be created or deleted. */
  singleton?: boolean
  description?: string
}
