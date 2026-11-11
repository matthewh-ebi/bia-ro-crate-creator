import { GROUPS, TYPE_SPECS } from '../schema/biaSchema'
import type { TypeSpec } from '../schema/types'
import { titleOf } from '../model/draft'
import { newUid, useDraft } from '../store/DraftContext'
import { SeverityDot, TitleWithParts } from './bits'
import { entityHref, go, type Route } from './route'

export function Sidebar({ route }: { route: Route }) {
  const { draft, issues } = useDraft()
  const errorCount = issues.filter((i) => i.severity === 'error').length

  return (
    <nav className="sidebar" aria-label="Crate contents">
      <a className={`side-link ${route.view === 'overview' ? 'current' : ''}`} href="#/overview">
        Overview
        {errorCount > 0 && <span className="count count-error">{errorCount}</span>}
      </a>
      {GROUPS.map((group) => (
        <section
          key={group}
          // Datasets live in the right-hand rail; this copy only shows when the rail is folded away on narrow screens.
          className={`side-group ${group === 'Datasets' ? 'side-group-datasets' : ''}`}
        >
          <h2>{group}</h2>
          {TYPE_SPECS.filter((s) => s.group === group && !s.embedded).map((spec) => (
            <TypeSection key={spec.type} spec={spec} route={route} />
          ))}
        </section>
      ))}
      <p className="side-foot">
        {draft.entities.length} entities · {draft.relationships.length} links
      </p>
    </nav>
  )
}

function TypeSection({ spec, route }: { spec: TypeSpec; route: Route }) {
  const { draft, dispatch, worst } = useDraft()
  const items = draft.entities.filter((e) => e.type === spec.type)
  const currentUid = route.view === 'entity' ? route.uid : null

  if (spec.singleton) {
    const e = items[0]
    return (
      <a className={`side-link ${currentUid === e.uid ? 'current' : ''}`} href={entityHref(e.uid)}>
        <span className="ellipsis">{titleOf(e)}</span>
        <SeverityDot severity={worst.get(e.uid)} />
      </a>
    )
  }

  const add = () => {
    const uid = newUid()
    dispatch({ kind: 'add', uid, entityType: spec.type })
    go(entityHref(uid))
  }

  return (
    <div className="side-type">
      <div className="side-type-head">
        <span>{spec.plural}</span>
        <span className="muted">{items.length || ''}</span>
        <button type="button" className="icon-btn" onClick={add} title={`Add ${spec.label.toLowerCase()}`} aria-label={`Add ${spec.label.toLowerCase()}`}>
          +
        </button>
      </div>
      {items.map((e) => (
        <a key={e.uid} className={`side-link sub ${currentUid === e.uid ? 'current' : ''}`} href={entityHref(e.uid)}>
          <span className="ellipsis"><TitleWithParts entity={e} /></span>
          <SeverityDot severity={worst.get(e.uid)} />
        </a>
      ))}
    </div>
  )
}
