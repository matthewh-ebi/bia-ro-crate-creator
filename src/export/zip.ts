import { strToU8, zipSync } from 'fflate'
import type { Draft } from '../model/draft'
import { FILE_LIST_NAME, buildCrate, buildFileListTsv, slugify } from './buildCrate'

/** Folder name inside the zip (so unzipping yields a crate folder to drop into the explorer). */
export function crateFolderName(draft: Draft): string {
  const study = draft.entities.find((e) => e.type === 'study')
  // Named from the title: the accession ID is assigned by the archive after submission.
  const name = study?.fields.name
  return slugify(typeof name === 'string' ? name : '') || 'bia-ro-crate'
}

export function buildCrateZip(draft: Draft): { filename: string; bytes: Uint8Array } {
  const folder = crateFolderName(draft)
  const json = JSON.stringify(buildCrate(draft), null, 2) + '\n'
  const bytes = zipSync({
    [folder]: {
      'ro-crate-metadata.json': strToU8(json),
      [FILE_LIST_NAME]: strToU8(buildFileListTsv(draft)),
    },
  })
  return { filename: `${folder}.zip`, bytes }
}
