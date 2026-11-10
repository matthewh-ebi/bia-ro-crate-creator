import { useEffect, useState } from 'react'

export type Route =
  | { view: 'overview' }
  | { view: 'export' }
  | { view: 'entity'; uid: string; from?: string }

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#\/?/, '')
  if (h === 'export') return { view: 'export' }
  const m = h.match(/^e\/([^?]+)(?:\?from=(.+))?$/)
  if (m) return { view: 'entity', uid: decodeURIComponent(m[1]), from: m[2] ? decodeURIComponent(m[2]) : undefined }
  return { view: 'overview' }
}

export function entityHref(uid: string, from?: string): string {
  return `#/e/${encodeURIComponent(uid)}${from ? `?from=${encodeURIComponent(from)}` : ''}`
}

export function go(href: string): void {
  window.location.hash = href
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash))
  useEffect(() => {
    const on = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}
