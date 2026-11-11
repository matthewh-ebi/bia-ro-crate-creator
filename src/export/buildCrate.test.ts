import { describe, expect, it } from 'vitest'
import { unzipSync, strFromU8 } from 'fflate'
import biaContext from '../bia-context.json'
import { TYPE_SPECS } from '../schema/biaSchema'
import { buildCrate, buildFileListTsv, datasetIdTable } from './buildCrate'
import { buildCrateZip } from './zip'
import { idrLikeDraft, run } from '../test/fixtures'

type N = Record<string, unknown>
const byId = (graph: N[], id: string) => graph.find((n) => n['@id'] === id)

describe('schema ↔ BIA @context', () => {
  it('every field, relation and alsoAs key is a declared context term', () => {
    const terms = new Set([...Object.keys(biaContext), 'identifier'])
    const keys = TYPE_SPECS.flatMap((s) => [
      ...s.fields.map((f) => f.key),
      ...s.relations.map((r) => r.key),
      ...(s.iri?.alsoAs ? [s.iri.alsoAs] : []),
    ])
    expect(keys.filter((k) => !terms.has(k))).toEqual([])
  })
})

describe('buildCrate', () => {
  const crate = buildCrate(idrLikeDraft())
  const graph = crate['@graph'] as N[]

  it('has the metadata descriptor and a study root', () => {
    expect(byId(graph, 'ro-crate-metadata.json')).toMatchObject({ about: { '@id': './' } })
    expect(byId(graph, './')).toMatchObject({
      '@type': ['Dataset', 'bia:Study'],
      name: 'idr0027 chromatin',
      keywords: ['time-lapse imaging'],
    })
  })

  it('puts every dataset plus the file list in hasPart', () => {
    expect(byId(graph, './')!.hasPart).toEqual([{ '@id': '#dataset-colocalising' }, { '@id': 'file_list.tsv' }])
  })

  it('uses external identifiers as @id and normalises shorthand', () => {
    expect(byId(graph, 'http://purl.obolibrary.org/obo/NCBITaxon_4932')).toMatchObject({ '@type': ['bia:Taxon'] })
    expect(byId(graph, 'https://ror.org/03h2bxq36')).toBeDefined()
    expect(byId(graph, 'https://doi.org/10.1186/s12860-016-0111-y')).toMatchObject({
      doi: 'https://doi.org/10.1186/s12860-016-0111-y',
    })
  })

  it('writes dataset associations as @id arrays and single relations as objects', () => {
    expect(byId(graph, '#dataset-colocalising')).toMatchObject({
      '@type': ['Dataset', 'bia:Dataset'],
      associatedBiologicalEntity: [{ '@id': '#biosample-dd1407' }],
      associatedSpecimenImagingPreparationProtocol: [{ '@id': '#specimen-prep-fluorescent-labelling' }],
      associatedImageAcquisitionProtocol: [{ '@id': '#image-acquisition-omx-imaging' }],
    })
    expect(byId(graph, '#biosample-dd1407')).toMatchObject({
      organismClassification: [{ '@id': 'http://purl.obolibrary.org/obo/NCBITaxon_4932' }],
    })
  })

  it('never exports an accession ID, even one saved in an older draft', () => {
    const d = run([{ kind: 'setField', uid: 'study', key: 'accessionId', value: 'S-BIAD123' }], idrLikeDraft())
    expect('accessionId' in byId(buildCrate(d)['@graph'] as N[], './')!).toBe(false)
  })

  it('omits empty values', () => {
    const study = byId(graph, './')!
    expect('acknowledgement' in study).toBe(false)
    expect('funding' in study).toBe(false)
  })

  it('declares a file list with propertyUrl-identified columns', () => {
    expect(byId(graph, 'file_list.tsv')).toMatchObject({ '@type': ['File', 'bia:FileList', 'csvw:Table'] })
    const cols = graph.filter((n) => (n['@type'] as string[]).includes('csvw:Column'))
    expect(cols.map((c) => c.propertyUrl)).toEqual([
      'http://bia/filePath',
      'http://bia/sizeInBytes',
      'http://schema.org/isPartOf',
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
    ])
    expect(buildFileListTsv(idrLikeDraft())).toBe('file_path\tsize_in_bytes\tdataset\ttype\n')
  })

  it('adds a source-image column when any dataset is an annotation dataset', () => {
    const d = run([
      { kind: 'add', uid: 'am', entityType: 'annotationMethod' },
      { kind: 'add', uid: 'ds2', entityType: 'dataset' },
      { kind: 'link', from: 'ds2', rel: 'associatedAnnotationMethod', to: 'am' },
    ], idrLikeDraft())
    expect(buildFileListTsv(d)).toContain('source_image')
    const g = buildCrate(d)['@graph'] as N[]
    expect(g.some((n) => n.propertyUrl === 'http://bia/associatedSourceImage')).toBe(true)
  })

  it('deduplicates minted ids and falls back to uid for untitled entities', () => {
    const d = run([
      { kind: 'add', uid: 'p-aaaa1111', entityType: 'imageAcquisition' },
      { kind: 'add', uid: 'p-bbbb2222', entityType: 'imageAcquisition' },
      { kind: 'setField', uid: 'p-bbbb2222', key: 'name', value: 'OMX imaging' },
    ], idrLikeDraft())
    const ids = (buildCrate(d)['@graph'] as N[]).map((n) => n['@id'])
    expect(ids).toContain('#image-acquisition-p-aaaa11')
    expect(ids).toContain('#image-acquisition-omx-imaging-2')
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('lists dataset ids for filling the file list', () => {
    expect(datasetIdTable(idrLikeDraft())).toEqual([{ name: 'Colocalising', id: '#dataset-colocalising' }])
  })
})

describe('buildCrateZip', () => {
  it('produces a folder containing metadata and file list', () => {
    const { filename, bytes } = buildCrateZip(idrLikeDraft())
    expect(filename).toBe('idr0027-chromatin.zip')
    const files = unzipSync(bytes)
    expect(Object.keys(files).filter((k) => !k.endsWith('/')).sort()).toEqual(['idr0027-chromatin/file_list.tsv', 'idr0027-chromatin/ro-crate-metadata.json'])
    const meta = JSON.parse(strFromU8(files['idr0027-chromatin/ro-crate-metadata.json']))
    expect(meta['@graph'].length).toBeGreaterThan(10)
  })
})
