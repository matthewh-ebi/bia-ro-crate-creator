import biaContext from '../bia-context.json'
import { ANNOTATION_KEY, SPEC_BY_TYPE } from '../schema/biaSchema'
import { STUDY_UID, targetsOf, titleOf, type Draft, type Entity, type FieldValue } from '../model/draft'

/**
 * Draft → RO-Crate. Pure: no DOM, no storage. The output follows the shape of
 * the reference crates (idr0027, Crowdsourcing_histopathology) so it loads in
 * the BIA RO-Crate Explorer.
 */

export const FILE_LIST_NAME = 'file_list.tsv'

type Json = null | string | number | boolean | Json[] | { [k: string]: Json }
type Node = { '@id': string; '@type': string | string[]; [k: string]: Json }

interface Column {
  name: string
  propertyUrl: string
}

const BASE_COLUMNS: Column[] = [
  { name: 'file_path', propertyUrl: 'http://bia/filePath' },
  { name: 'size_in_bytes', propertyUrl: 'http://bia/sizeInBytes' },
  { name: 'dataset', propertyUrl: 'http://schema.org/isPartOf' },
  { name: 'type', propertyUrl: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' },
]
const SOURCE_IMAGE_COLUMN: Column = { name: 'source_image', propertyUrl: 'http://bia/associatedSourceImage' }

export function slugify(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

/** uid → exported `@id`. External IRIs win; otherwise `#<prefix>-<slug>`, deduplicated. */
export function assignIds(draft: Draft): Map<string, string> {
  const ids = new Map<string, string>()
  const used = new Set<string>(['./', 'ro-crate-metadata.json', FILE_LIST_NAME])
  for (const e of draft.entities) {
    if (e.uid === STUDY_UID) {
      ids.set(e.uid, './')
      continue
    }
    const spec = SPEC_BY_TYPE[e.type]
    const iri = spec.iri?.normalise(e.iri) ?? ''
    let id: string
    if (iri) {
      id = iri
    } else {
      const raw = e.fields[spec.titleField]
      const slug = slugify(Array.isArray(raw) ? raw.join(' ') : (raw ?? '')) || e.uid.slice(0, 8)
      const base = `#${spec.idPrefix}-${slug}`
      id = base
      for (let n = 2; used.has(id); n++) id = `${base}-${n}`
    }
    used.add(id)
    ids.set(e.uid, id)
  }
  return ids
}

function cleanValue(v: FieldValue | undefined, asList: boolean): Json | undefined {
  if (v === undefined) return undefined
  if (asList) {
    const items = (Array.isArray(v) ? v : [v]).map((s) => s.trim()).filter(Boolean)
    return items.length ? items : undefined
  }
  const s = (Array.isArray(v) ? v.join(', ') : v).trim()
  return s || undefined
}

function entityNode(draft: Draft, e: Entity, ids: Map<string, string>): Node {
  const spec = SPEC_BY_TYPE[e.type]
  const node: Node = { '@id': ids.get(e.uid)!, '@type': [...spec.jsonldType] }

  for (const f of spec.fields) {
    const v = cleanValue(e.fields[f.key], f.kind === 'list')
    if (v !== undefined) node[f.key] = v
  }
  if (spec.iri?.alsoAs && e.iri.trim()) node[spec.iri.alsoAs] = spec.iri.normalise(e.iri)

  for (const r of spec.relations) {
    const refs = targetsOf(draft, e.uid, r.key).map((uid) => ({ '@id': ids.get(uid)! }))
    if (refs.length === 0) continue
    node[r.key] = r.many ? refs : refs[0]
  }
  return node
}

export function fileListColumns(draft: Draft): Column[] {
  const anyAnnotation = draft.entities.some(
    (e) => e.type === 'dataset' && targetsOf(draft, e.uid, ANNOTATION_KEY).length > 0,
  )
  return anyAnnotation ? [...BASE_COLUMNS, SOURCE_IMAGE_COLUMN] : BASE_COLUMNS
}

export function buildCrate(draft: Draft): { '@context': Json; '@graph': Node[] } {
  const ids = assignIds(draft)
  const graph: Node[] = [
    {
      '@id': 'ro-crate-metadata.json',
      '@type': 'CreativeWork',
      conformsTo: { '@id': 'https://w3id.org/ro/crate/1.1' },
      about: { '@id': './' },
    },
  ]

  const datasets = draft.entities.filter((e) => e.type === 'dataset')
  for (const e of draft.entities) {
    const node = entityNode(draft, e, ids)
    if (e.uid === STUDY_UID) {
      node.hasPart = [...datasets.map((d) => ({ '@id': ids.get(d.uid)! })), { '@id': FILE_LIST_NAME }]
    }
    graph.push(node)
  }

  // File list declaration: a csvw table whose columns are identified by propertyUrl.
  const columns = fileListColumns(draft)
  graph.push({
    '@id': FILE_LIST_NAME,
    '@type': ['File', 'bia:FileList', 'csvw:Table'],
    tableSchema: { '@id': '_:ts0' },
  })
  graph.push({
    '@id': '_:ts0',
    '@type': ['csvw:Schema'],
    column: columns.map((_, i) => ({ '@id': `_:col${i}` })),
  })
  columns.forEach((c, i) =>
    graph.push({ '@id': `_:col${i}`, '@type': ['csvw:Column'], columnName: c.name, propertyUrl: c.propertyUrl }),
  )

  return { '@context': ['https://w3id.org/ro/crate/1.1/context', biaContext as Json], '@graph': graph }
}

/** Header-only TSV matching the declared schema; rows are added by the submitter. */
export function buildFileListTsv(draft: Draft): string {
  return fileListColumns(draft).map((c) => c.name).join('\t') + '\n'
}

/** Dataset name → exported @id, to help fill the file list's `dataset` column. */
export function datasetIdTable(draft: Draft): { name: string; id: string }[] {
  const ids = assignIds(draft)
  return draft.entities
    .filter((e) => e.type === 'dataset')
    .map((e) => ({ name: titleOf(e), id: ids.get(e.uid)! }))
}
