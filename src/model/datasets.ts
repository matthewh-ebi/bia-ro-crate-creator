import { ANNOTATION_KEY, EXPERIMENTAL_TRIPLE, SPEC_BY_TYPE } from '../schema/biaSchema'
import type { EntityType } from '../schema/types'
import { targetsOf, type Draft } from './draft'

/**
 * Helpers for the dataset rail: what each dataset links to, and which dataset
 * relation (if any) a component type can be linked through.
 */

export interface DatasetSlot {
  /** Dataset relation key, e.g. `associatedBiologicalEntity`. */
  rel: string
  label: string
  /** Linked component uids, in order. */
  targets: string[]
  /** True when the dataset needs this slot filled to be valid. */
  missing: boolean
}

/**
 * The slots worth showing for a dataset. Filled slots are always shown. An
 * annotation dataset (one with an annotation method) needs nothing else; any
 * other dataset is treated as experimental, so empty slots of the BioSample /
 * specimen / acquisition triple are reported as missing.
 */
export function datasetSlots(draft: Draft, datasetUid: string): DatasetSlot[] {
  const isAnnotation = targetsOf(draft, datasetUid, ANNOTATION_KEY).length > 0
  const triple: readonly string[] = EXPERIMENTAL_TRIPLE
  return SPEC_BY_TYPE.dataset.relations.flatMap((r) => {
    const targets = targetsOf(draft, datasetUid, r.key)
    const missing = targets.length === 0 && !isAnnotation && triple.includes(r.key)
    return targets.length > 0 || missing ? [{ rel: r.key, label: r.label, targets, missing }] : []
  })
}

/** The dataset relation that links to entities of `type`, if there is one. */
export function datasetRelFor(type: EntityType): string | undefined {
  return SPEC_BY_TYPE.dataset.relations.find((r) => r.target === type)?.key
}
