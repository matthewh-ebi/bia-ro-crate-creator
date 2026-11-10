import type { Severity } from '../model/checks'
import type { Requirement } from '../schema/types'

const SEVERITY_LABEL: Record<Severity, string> = { error: 'Has errors', warning: 'Has warnings', info: 'Has suggestions' }

/** Error/warning marker; info is too noisy for list views and is omitted. */
export function SeverityDot({ severity }: { severity: Severity | undefined }) {
  if (!severity || severity === 'info') return null
  return <span className={`dot dot-${severity}`} title={SEVERITY_LABEL[severity]} aria-label={SEVERITY_LABEL[severity]} />
}

export function RequirementTag({ requirement }: { requirement: Requirement }) {
  if (requirement === 'optional') return null
  return <span className={`req req-${requirement}`}>{requirement}</span>
}
