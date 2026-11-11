import { useId, useMemo, useState } from 'react'
import { assignIds } from '../export/buildCrate'
import { IRI_KEY, type Issue } from '../model/checks'
import { embeddedSummary, ownersOf, referrersOf, relationSpec, targetsOf, titleOf, type Entity, type FieldValue } from '../model/draft'
import { SPEC_BY_TYPE } from '../schema/biaSchema'
import type { FieldSpec, RelationSpec } from '../schema/types'
import { newUid, useDraft } from '../store/DraftContext'
import { RequirementTag, SeverityDot, TitleWithParts } from './bits'
import { entityHref, go } from './route'

export function EntityEditor({ uid, from }: { uid: string; from?: string }) {
  const { draft, dispatch, issues } = useDraft()
  const ids = useMemo(() => assignIds(draft), [draft])
  const entity = draft.entities.find((e) => e.uid === uid)

  if (!entity) {
    return (
      <div className="page">
        <p>This entity no longer exists.</p>
        <a href="#/overview">Back to overview</a>
      </div>
    )
  }

  const spec = SPEC_BY_TYPE[entity.type]

  // Embedded entities (organisms) are edited inside their owner's form.
  if (spec.embedded) {
    const owners = ownersOf(draft, uid)
    return (
      <div className="page">
        <div className="eyebrow">{spec.label}</div>
        <h1>{titleOf(entity)}</h1>
        <p>
          {spec.label}s are edited within the {owners.length > 1 ? 'entities' : 'entity'} that use{owners.length > 1 ? '' : 's'} them:{' '}
          {owners.map((o, i) => (
            <span key={o.uid}>
              {i > 0 && ', '}
              <a href={entityHref(o.uid)}>{titleOf(o)}</a>
            </span>
          ))}
        </p>
      </div>
    )
  }

  const embeddedRels = spec.relations.filter((r) => SPEC_BY_TYPE[r.target].embedded)
  const linkRels = spec.relations.filter((r) => !SPEC_BY_TYPE[r.target].embedded)
  const mine = issues.filter((i) => i.uid === uid)
  const issueFor = (key: string) => mine.find((i) => i.key === key)
  const banner = mine.filter((i) => i.severity !== 'info' && !i.key)
  const parent = from ? draft.entities.find((e) => e.uid === from) : undefined
  const referrers = referrersOf(draft, uid)

  const remove = () => {
    const links = draft.relationships.filter((r) => r.from === uid || r.to === uid).length
    const msg = `Delete “${titleOf(entity)}”?` + (links ? ` Its ${links} link${links > 1 ? 's' : ''} will also be removed.` : '')
    if (!confirm(msg)) return
    dispatch({ kind: 'delete', uid })
    go(parent ? entityHref(parent.uid) : '#/overview')
  }

  return (
    <div className="page">
      {parent && (
        <a className="back" href={entityHref(parent.uid)}>
          ← Back to {SPEC_BY_TYPE[parent.type].label.toLowerCase()} “{titleOf(parent)}”
        </a>
      )}
      <div className="page-head">
        <div>
          <div className="eyebrow">{spec.label}</div>
          <h1>{titleOf(entity)}</h1>
          <code className="crate-id" title="@id in the exported crate">{ids.get(uid)}</code>
        </div>
        {!spec.singleton && (
          <button type="button" className="btn danger" onClick={remove}>Delete</button>
        )}
      </div>
      {spec.description && <p className="type-desc">{spec.description}</p>}

      {banner.length > 0 && (
        <ul className="banner">
          {banner.map((i, n) => (
            <li key={n} className={`sev-${i.severity}`}>{i.message}</li>
          ))}
        </ul>
      )}

      <section className="card">
        {spec.iri && <IriField entity={entity} issue={issueFor(IRI_KEY)} />}
        {spec.fields.map((f) => (
          <Field key={f.key} entity={entity} spec={f} issue={issueFor(f.key)} />
        ))}
      </section>

      {embeddedRels.map((r) => (
        <EmbeddedRelation key={r.key} entity={entity} spec={r} issue={issueFor(r.key)} />
      ))}

      {linkRels.length > 0 && (
        <section className="card">
          <h2 className="card-title">Links</h2>
          {linkRels.map((r) => (
            <RelationField key={r.key} entity={entity} spec={r} issue={issueFor(r.key)} />
          ))}
        </section>
      )}

      <section className="card subtle">
        <h2 className="card-title">Referenced by</h2>
        {entity.type === 'dataset' && <p className="muted small">Part of the study (all datasets are).</p>}
        {referrers.length === 0 && entity.type !== 'dataset' && entity.type !== 'study' && (
          <p className="muted small">Nothing links to this yet.</p>
        )}
        {entity.type === 'study' && <p className="muted small">The study is the crate root.</p>}
        <ul className="ref-list">
          {referrers.map((r) => {
            const src = draft.entities.find((e) => e.uid === r.from)!
            return (
              <li key={`${r.from}-${r.rel}`}>
                <a href={entityHref(src.uid)}>{titleOf(src)}</a>{' '}
                <span className="muted">
                  ({SPEC_BY_TYPE[src.type].label} · {relationSpec(src.type, r.rel)?.label})
                </span>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

function FieldLabel({ htmlFor, label, requirement, help }: { htmlFor?: string; label: string; requirement: FieldSpec['requirement']; help?: string }) {
  return (
    <div className="field-label">
      <label htmlFor={htmlFor}>{label}</label>
      <RequirementTag requirement={requirement} />
      {help && <span className="help">{help}</span>}
    </div>
  )
}

function IriField({ entity, issue }: { entity: Entity; issue?: Issue }) {
  const { dispatch } = useDraft()
  const iri = SPEC_BY_TYPE[entity.type].iri!
  const id = useId()
  const resolved = iri.normalise(entity.iri)
  return (
    <div className={`field ${issue?.severity === 'error' ? 'invalid' : ''}`}>
      <FieldLabel htmlFor={id} label={iri.label} requirement="optional" help={iri.help} />
      <input
        id={id}
        value={entity.iri}
        placeholder={iri.placeholder}
        onChange={(e) => dispatch({ kind: 'setIri', uid: entity.uid, value: e.target.value })}
      />
      {resolved && resolved !== entity.iri.trim() && <div className="hint">→ {resolved}</div>}
      {issue && <div className="field-error">{issue.message}</div>}
    </div>
  )
}

/**
 * An embedded relation (e.g. a BioSample's organisms): the targets' own fields
 * are edited inline here rather than on separate pages. Removing one unlinks
 * it; the reducer deletes it once no other entity uses it.
 */
function EmbeddedRelation({ entity, spec, issue }: { entity: Entity; spec: RelationSpec; issue?: Issue }) {
  const { draft, dispatch } = useDraft()
  const id = useId()
  const targetSpec = SPEC_BY_TYPE[spec.target]
  const noun = targetSpec.label.toLowerCase()
  const targets = targetsOf(draft, entity.uid, spec.key)
  const byUid = new Map(draft.entities.map((e) => [e.uid, e]))
  const candidates = draft.entities.filter((e) => e.type === spec.target && !targets.includes(e.uid))
  const canAddMore = spec.many || targets.length === 0

  return (
    <section className={`card ${issue?.severity === 'error' ? 'card-invalid' : ''}`}>
      <div className="card-head">
        <h2 className="card-title">
          {spec.label} <RequirementTag requirement={spec.requirement} />
        </h2>
      </div>
      {targets.length === 0 && (
        <p className={issue?.severity === 'error' ? 'field-error' : 'muted small'}>
          No {noun} yet. Add the {noun} this {SPEC_BY_TYPE[entity.type].label} comes from.
        </p>
      )}
      {targets.map((t) => (
        <EmbeddedCard key={t} owner={entity} rel={spec.key} target={byUid.get(t)!} />
      ))}
      {canAddMore && (
        <div className="link-add">
          <button
            type="button"
            className="btn small"
            onClick={() => dispatch({ kind: 'add', uid: newUid(), entityType: spec.target, linkFrom: { from: entity.uid, rel: spec.key } })}
          >
            + Add {noun}
          </button>
          {candidates.length > 0 && (
            <select
              id={id}
              aria-label={`Use an existing ${noun}`}
              value=""
              onChange={(e) => e.target.value && dispatch({ kind: 'link', from: entity.uid, rel: spec.key, to: e.target.value })}
            >
              <option value="">Use an existing {noun}…</option>
              {candidates.map((c) => (
                <option key={c.uid} value={c.uid}>{titleOf(c)}</option>
              ))}
            </select>
          )}
        </div>
      )}
    </section>
  )
}

function EmbeddedCard({ owner, rel, target }: { owner: Entity; rel: string; target: Entity }) {
  const { draft, dispatch, issues } = useDraft()
  const spec = SPEC_BY_TYPE[target.type]
  const mine = issues.filter((i) => i.uid === target.uid)
  const issueFor = (key: string) => mine.find((i) => i.key === key)
  const others = ownersOf(draft, target.uid).filter((o) => o.uid !== owner.uid)

  return (
    <div className="embedded">
      <div className="embedded-head">
        <strong>{titleOf(target)}</strong>
        <button
          type="button"
          className="btn small ghost"
          title={others.length ? `Remove from this ${SPEC_BY_TYPE[owner.type].label} (kept for the others)` : undefined}
          onClick={() => dispatch({ kind: 'unlink', from: owner.uid, rel, to: target.uid })}
        >
          Remove
        </button>
      </div>
      {others.length > 0 && (
        <p className="muted small shared-note">
          Shared with {others.map((o) => titleOf(o)).join(', ')}. Edits here apply to all of them.
        </p>
      )}
      {spec.iri && <IriField entity={target} issue={issueFor(IRI_KEY)} />}
      {spec.fields.map((f) => (
        <Field key={f.key} entity={target} spec={f} issue={issueFor(f.key)} />
      ))}
    </div>
  )
}

function Field({ entity, spec, issue }: { entity: Entity; spec: FieldSpec; issue?: Issue }) {
  const { dispatch } = useDraft()
  const id = useId()
  const value = entity.fields[spec.key]
  const set = (v: FieldValue) => dispatch({ kind: 'setField', uid: entity.uid, key: spec.key, value: v })
  const invalid = issue?.severity === 'error'
  const listId = spec.suggestions ? `${id}-sugg` : undefined
  const str = Array.isArray(value) ? value.join(', ') : (value ?? '')

  return (
    <div className={`field ${invalid ? 'invalid' : ''}`}>
      <FieldLabel htmlFor={id} label={spec.label} requirement={spec.requirement} help={spec.help} />
      {spec.kind === 'list' ? (
        <ListInput id={id} values={Array.isArray(value) ? value : value ? [value] : []} onChange={set} placeholder={spec.placeholder} listId={listId} />
      ) : spec.kind === 'textarea' ? (
        <textarea id={id} rows={4} value={str} placeholder={spec.placeholder} onChange={(e) => set(e.target.value)} />
      ) : (
        <input
          id={id}
          type={spec.kind === 'date' ? 'date' : spec.kind === 'email' ? 'email' : spec.kind === 'url' ? 'url' : 'text'}
          value={str}
          placeholder={spec.placeholder}
          list={listId}
          onChange={(e) => set(e.target.value)}
        />
      )}
      {spec.suggestions && (
        <datalist id={listId}>
          {spec.suggestions.map((s) => <option key={s} value={s} />)}
        </datalist>
      )}
    </div>
  )
}

function ListInput({ id, values, onChange, placeholder, listId }: { id: string; values: string[]; onChange: (v: string[]) => void; placeholder?: string; listId?: string }) {
  const [text, setText] = useState('')
  const commit = () => {
    const t = text.trim()
    if (t && !values.includes(t)) onChange([...values, t])
    setText('')
  }
  return (
    <div className="list-input">
      {values.map((v) => (
        <span key={v} className="chip">
          {v}
          <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}>×</button>
        </span>
      ))}
      <input
        id={id}
        value={text}
        list={listId}
        placeholder={values.length ? 'Add another…' : (placeholder ?? 'Type and press Enter')}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          } else if (e.key === 'Backspace' && text === '' && values.length) {
            onChange(values.slice(0, -1))
          }
        }}
        onBlur={commit}
      />
    </div>
  )
}

function RelationField({ entity, spec, issue }: { entity: Entity; spec: RelationSpec; issue?: Issue }) {
  const { draft, dispatch, worst } = useDraft()
  const id = useId()
  const targetSpec = SPEC_BY_TYPE[spec.target]
  const targets = targetsOf(draft, entity.uid, spec.key)
  const byUid = new Map(draft.entities.map((e) => [e.uid, e]))
  const candidates = draft.entities.filter((e) => e.type === spec.target && !targets.includes(e.uid))
  const canAddMore = spec.many || targets.length === 0

  const optionLabel = (c: Entity) => {
    const parts = embeddedSummary(draft, c)
    return parts ? `${titleOf(c)} (${parts})` : titleOf(c)
  }

  const createNew = () => {
    const uid = newUid()
    dispatch({ kind: 'add', uid, entityType: spec.target, linkFrom: { from: entity.uid, rel: spec.key } })
    go(entityHref(uid, entity.uid))
  }

  return (
    <div className={`field ${issue?.severity === 'error' ? 'invalid' : ''}`}>
      <FieldLabel htmlFor={id} label={spec.label} requirement={spec.requirement} help={spec.help} />
      {targets.length > 0 && (
        <ol className="links">
          {targets.map((t, i) => {
            const e = byUid.get(t)!
            return (
              <li key={t}>
                <a href={entityHref(t, entity.uid)}><TitleWithParts entity={e} /></a>
                <SeverityDot severity={worst.get(t)} />
                <span className="link-actions">
                  {spec.many && targets.length > 1 && (
                    <>
                      <button type="button" className="icon-btn" disabled={i === 0} aria-label="Move up"
                        onClick={() => dispatch({ kind: 'move', from: entity.uid, rel: spec.key, to: t, delta: -1 })}>↑</button>
                      <button type="button" className="icon-btn" disabled={i === targets.length - 1} aria-label="Move down"
                        onClick={() => dispatch({ kind: 'move', from: entity.uid, rel: spec.key, to: t, delta: 1 })}>↓</button>
                    </>
                  )}
                  <button type="button" className="icon-btn" aria-label={`Unlink ${titleOf(e)}`} title="Unlink (keeps the entity)"
                    onClick={() => dispatch({ kind: 'unlink', from: entity.uid, rel: spec.key, to: t })}>×</button>
                </span>
              </li>
            )
          })}
        </ol>
      )}
      <div className="link-add">
        {candidates.length > 0 && (
          <select
            id={id}
            value=""
            onChange={(e) => e.target.value && dispatch({ kind: 'link', from: entity.uid, rel: spec.key, to: e.target.value })}
          >
            <option value="">{canAddMore ? `Link existing ${targetSpec.label.toLowerCase()}…` : `Replace with…`}</option>
            {candidates.map((c) => (
              <option key={c.uid} value={c.uid}>{optionLabel(c)}</option>
            ))}
          </select>
        )}
        {canAddMore && (
          <button type="button" className="btn small" onClick={createNew}>+ New {targetSpec.label.toLowerCase()}</button>
        )}
      </div>
    </div>
  )
}
