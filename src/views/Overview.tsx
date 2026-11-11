import { useState } from 'react'
import { SEVERITY_RANK } from '../model/checks'
import { STUDY_UID, ownersOf, targetsOf, titleOf, type Entity } from '../model/draft'
import { SPEC_BY_TYPE } from '../schema/biaSchema'
import { newUid, useDraft } from '../store/DraftContext'
import { SeverityDot, TitleWithParts } from './bits'
import { entityHref, go } from './route'

const MATRIX_COLUMNS = SPEC_BY_TYPE.dataset.relations

export function Overview() {
  const { draft, dispatch, issues, worst } = useDraft()
  const [showInfo, setShowInfo] = useState(false)
  const study = draft.entities.find((e) => e.uid === STUDY_UID)!
  const datasets = draft.entities.filter((e) => e.type === 'dataset')
  const byUid = new Map(draft.entities.map((e) => [e.uid, e]))

  const sorted = [...issues].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
  const shown = sorted.filter((i) => showInfo || i.severity !== 'info')
  const counts = { error: 0, warning: 0, info: 0 }
  for (const i of issues) counts[i.severity]++

  const addDataset = () => {
    const uid = newUid()
    dispatch({ kind: 'add', uid, entityType: 'dataset' })
    go(entityHref(uid))
  }

  const empty = draft.entities.length === 1 && !Object.values(study.fields).some(Boolean)

  return (
    <div className="page wide">
      <div className="eyebrow">Overview</div>
      <h1>{titleOf(study)}</h1>

      {empty && (
        <section className="card intro">
          <h2 className="card-title">Getting started</h2>
          <ol>
            <li><a href={entityHref(STUDY_UID)}>Fill in the study</a>: title, description, accession, licence, authors.</li>
            <li>Create the REMBI components from the sidebar: BioSamples, specimen preparation, image acquisition (or annotation methods).</li>
            <li>Create datasets and link each one to the components that describe it.</li>
            <li><a href="#/export">Export</a> a zip containing <code>ro-crate-metadata.json</code> and a stub <code>file_list.tsv</code>.</li>
          </ol>
          <p className="muted small">Everything is saved in this browser only. Use “Backup draft” to keep a copy.</p>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Datasets</h2>
          <button type="button" className="btn small" onClick={addDataset}>+ New dataset</button>
        </div>
        {datasets.length === 0 ? (
          <p className="muted">No datasets yet. A dataset links a BioSample, specimen preparation and image acquisition (or an annotation method).</p>
        ) : (
          <div className="table-wrap">
            <table className="matrix">
              <thead>
                <tr>
                  <th>Dataset</th>
                  {MATRIX_COLUMNS.map((c) => <th key={c.key}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {datasets.map((d) => (
                  <tr key={d.uid}>
                    <th scope="row">
                      <a href={entityHref(d.uid)}>{titleOf(d)}</a> <SeverityDot severity={worst.get(d.uid)} />
                    </th>
                    {MATRIX_COLUMNS.map((c) => (
                      <td key={c.key}>
                        <Targets list={targetsOf(draft, d.uid, c.key).map((u) => byUid.get(u)!)} from={d.uid} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">
            Checks{' '}
            <span className="muted small">
              {counts.error} error{counts.error === 1 ? '' : 's'} · {counts.warning} warning{counts.warning === 1 ? '' : 's'} · {counts.info} suggestion{counts.info === 1 ? '' : 's'}
            </span>
          </h2>
          <label className="toggle">
            <input type="checkbox" checked={showInfo} onChange={(e) => setShowInfo(e.target.checked)} /> Show suggestions
          </label>
        </div>
        {shown.length === 0 ? (
          <p className="muted">{issues.length === 0 ? 'No issues. Ready to export.' : 'No errors or warnings.'}</p>
        ) : (
          <ul className="issues">
            {shown.map((i, n) => {
              const e = byUid.get(i.uid)!
              const owner = SPEC_BY_TYPE[e.type].embedded ? ownersOf(draft, e.uid)[0] : undefined
              const at = owner ?? e
              return (
                <li key={n} className={`sev-${i.severity}`}>
                  <span className={`sev-tag sev-tag-${i.severity}`}>{i.severity === 'info' ? 'suggestion' : i.severity}</span>
                  <a href={entityHref(at.uid)}>
                    {SPEC_BY_TYPE[at.type].label}: {titleOf(at)}
                    {owner && ` › ${SPEC_BY_TYPE[e.type].label}`}
                  </a>
                  <span>{i.message}</span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

function Targets({ list, from }: { list: Entity[]; from: string }) {
  if (list.length === 0) return <span className="muted">—</span>
  return (
    <>
      {list.map((e, i) => (
        <span key={e.uid}>
          {i > 0 && ', '}
          <a href={entityHref(e.uid, from)}><TitleWithParts entity={e} /></a>
        </span>
      ))}
    </>
  )
}
