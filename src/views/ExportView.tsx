import { useMemo, useState } from 'react'
import { FILE_LIST_NAME, buildCrate, buildFileListTsv, datasetIdTable } from '../export/buildCrate'
import { buildCrateZip } from '../export/zip'
import { useDraft } from '../store/DraftContext'
import { downloadBlob } from '../store/persistence'

export function ExportView() {
  const { draft, issues } = useDraft()
  const json = useMemo(() => JSON.stringify(buildCrate(draft), null, 2), [draft])
  const tsv = useMemo(() => buildFileListTsv(draft), [draft])
  const datasetIds = useMemo(() => datasetIdTable(draft), [draft])
  const [copied, setCopied] = useState(false)
  const errors = issues.filter((i) => i.severity === 'error').length

  const download = () => {
    const { filename, bytes } = buildCrateZip(draft)
    downloadBlob(filename, bytes as BlobPart, 'application/zip')
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard can be blocked; the JSON is still selectable below.
    }
  }

  return (
    <div className="page wide">
      <div className="eyebrow">Export</div>
      <h1>Export RO-Crate</h1>

      <section className="card">
        {errors > 0 && (
          <p className="banner-inline sev-error">
            {errors} error{errors > 1 ? 's' : ''} remaining. You can still export, but the crate won’t pass profile checks. <a href="#/overview">Review checks</a>
          </p>
        )}
        <p>
          The zip contains a crate folder with <code>ro-crate-metadata.json</code> and a header-only{' '}
          <code>{FILE_LIST_NAME}</code>. Add one row per file to the file list. Use the dataset IDs below for its{' '}
          <code>dataset</code> column. Then unzip and load the folder into the BIA RO-Crate Explorer.
        </p>
        <div className="row">
          <button type="button" className="vf-button vf-button--primary vf-button--sm" onClick={download}>Download crate (.zip)</button>
          <button type="button" className="vf-button vf-button--secondary vf-button--sm" onClick={copy}>{copied ? 'Copied' : 'Copy JSON'}</button>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">File list</h2>
        <pre className="code small-code">{tsv}</pre>
        {datasetIds.length > 0 && (
          <table className="vf-table vf-table--striped id-table">
            <thead className="vf-table__header">
              <tr className="vf-table__row">
                <th className="vf-table__heading" scope="col">Dataset</th>
                <th className="vf-table__heading" scope="col"><code>dataset</code> column value</th>
              </tr>
            </thead>
            <tbody className="vf-table__body">
              {datasetIds.map((d) => (
                <tr key={d.id} className="vf-table__row">
                  <td className="vf-table__cell">{d.name}</td>
                  <td className="vf-table__cell"><code>{d.id}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">ro-crate-metadata.json</h2>
        <pre className="code">{json}</pre>
      </section>
    </div>
  )
}
