import { datasetRelFor, datasetSlots } from '../model/datasets'
import { embeddedSummary, targetsOf, titleOf, type Entity } from '../model/draft'
import { SPEC_BY_TYPE } from '../schema/biaSchema'
import type { EntityType } from '../schema/types'
import { newUid, useDraft } from '../store/DraftContext'
import { SeverityDot } from './bits'
import { entityHref, go, type Route } from './route'

/** Compact slot names for the narrow rail. */
const SLOT_LABEL: Partial<Record<EntityType, string>> = {
  bioSample: 'Sample',
  specimenPrep: 'Specimen',
  imageAcquisition: 'Acquisition',
  annotationMethod: 'Annotation',
}

/**
 * Persistent right-hand list of datasets. When the page being edited is a
 * component a dataset can link to (BioSample, specimen preparation, image
 * acquisition, annotation method), each card gets a toggle to link or unlink
 * it, so components can be assigned to datasets from either side.
 */
export function DatasetRail({ route }: { route: Route }) {
  const { draft, dispatch } = useDraft()
  const datasets = draft.entities.filter((e) => e.type === 'dataset')
  const current = route.view === 'entity' ? draft.entities.find((e) => e.uid === route.uid) : undefined
  const focusRel = current ? datasetRelFor(current.type) : undefined
  const focus = current && focusRel ? { entity: current, rel: focusRel } : undefined

  const create = () => {
    const uid = newUid()
    dispatch({ kind: 'add', uid, entityType: 'dataset' })
    if (focus) dispatch({ kind: 'link', from: uid, rel: focus.rel, to: focus.entity.uid })
    go(entityHref(uid))
  }

  return (
    <aside className="rail" aria-label="Datasets">
      <div className="rail-head">
        <h2>Datasets</h2>
        <span className="muted small">{datasets.length || ''}</span>
      </div>
      {focus && datasets.length > 0 && (
        <p className="rail-hint">
          Tick the datasets that use this {SPEC_BY_TYPE[focus.entity.type].label.toLowerCase()}.
        </p>
      )}
      {datasets.length === 0 && (
        <p className="rail-hint">
          No datasets yet. A dataset groups the images that share a BioSample, specimen preparation and image
          acquisition (or an annotation method).
        </p>
      )}
      {datasets.map((ds) => (
        <DatasetCard
          key={ds.uid}
          dataset={ds}
          current={current?.uid === ds.uid}
          focus={focus}
        />
      ))}
      <button type="button" className="btn small rail-new" onClick={create}>
        {focus ? `+ New dataset with “${titleOf(focus.entity)}”` : '+ New dataset'}
      </button>
    </aside>
  )
}

function DatasetCard({
  dataset,
  current,
  focus,
}: {
  dataset: Entity
  current: boolean
  focus?: { entity: Entity; rel: string }
}) {
  const { draft, dispatch, worst } = useDraft()
  const byUid = new Map(draft.entities.map((e) => [e.uid, e]))
  const slots = datasetSlots(draft, dataset.uid)
  const linked = focus ? targetsOf(draft, dataset.uid, focus.rel).includes(focus.entity.uid) : false
  const noneLinked = slots.every((s) => s.targets.length === 0)

  const toggle = () => {
    if (!focus) return
    dispatch({ kind: linked ? 'unlink' : 'link', from: dataset.uid, rel: focus.rel, to: focus.entity.uid })
  }

  return (
    <div className={`rail-card ${current ? 'current' : ''} ${linked ? 'linked' : ''}`}>
      <div className="rail-card-head">
        {focus && (
          <input
            type="checkbox"
            checked={linked}
            onChange={toggle}
            aria-label={`${titleOf(dataset)} uses ${titleOf(focus.entity)}`}
            title={linked ? 'Unlink from this dataset' : 'Link to this dataset'}
          />
        )}
        <a className="rail-title ellipsis" href={entityHref(dataset.uid)}>
          {titleOf(dataset)}
        </a>
        <SeverityDot severity={worst.get(dataset.uid)} />
      </div>
      <dl className="rail-slots">
        {slots.map((s) => {
          const target = SPEC_BY_TYPE.dataset.relations.find((r) => r.key === s.rel)!.target
          return (
            <div key={s.rel} className="rail-slot">
              <dt>{SLOT_LABEL[target] ?? s.label}</dt>
              <dd>
                {s.missing && <span className="rail-missing">missing</span>}
                {s.targets.map((uid) => {
                  const e = byUid.get(uid)!
                  const parts = embeddedSummary(draft, e)
                  return (
                    <a
                      key={uid}
                      className={`rail-chip ${focus?.entity.uid === uid ? 'focus' : ''}`}
                      href={entityHref(uid)}
                      title={parts ? `${titleOf(e)} · ${parts}` : titleOf(e)}
                    >
                      {titleOf(e)}
                    </a>
                  )
                })}
              </dd>
            </div>
          )
        })}
      </dl>
      {noneLinked && <p className="rail-or muted">…or link an annotation method instead.</p>}
    </div>
  )
}
