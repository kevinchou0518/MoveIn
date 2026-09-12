import type { BuyerRequest } from './types'

const memory = new Map<string, BuyerRequest>()
export function clearSearches() {
  memory.clear()
  try { for (const key of Object.keys(window.sessionStorage)) if (key.startsWith('buyer-search-v1:') || key === 'buyer-preferences') window.sessionStorage.removeItem(key) } catch { /* Optional storage. */ }
}
export function validRequest(value: unknown): value is BuyerRequest {
  if (!value || typeof value !== 'object') return false
  const r = value as BuyerRequest
  return Array.isArray(r.categories) && r.categories.length > 0 && r.categories.length <= 6 &&
    r.categories.every(c => typeof c === 'string' && /^[a-z0-9_]+$/.test(c)) && new Set(r.categories).size === r.categories.length &&
    (typeof r.budget === 'number' || typeof r.budget === 'string') && Number(r.budget) > 0 && Number(r.budget) <= 100000 &&
    typeof r.buyer_has_car === 'boolean' && !!r.buyer_location &&
    Number.isFinite(r.buyer_location.lat) && Math.abs(r.buyer_location.lat) <= 90 &&
    Number.isFinite(r.buyer_location.lng) && Math.abs(r.buyer_location.lng) <= 180 &&
    Number.isFinite(r.radius_miles) && r.radius_miles > 0 && r.radius_miles <= 100 &&
    (r.ranking === undefined || ['balanced','lowest_cost','best_condition','fastest_trip'].includes(r.ranking))
}
export function readPreferences(): Partial<BuyerRequest> {
  try { const r = JSON.parse(window.sessionStorage.getItem('buyer-preferences') || 'null'); return validRequest(r) ? r : {} } catch { return {} }
}
export function saveSearch(request: BuyerRequest): string {
  const id = crypto.randomUUID()
  const snapshot = structuredClone(request)
  memory.set(id, snapshot)
  try { window.sessionStorage.setItem(`buyer-search-v1:${id}`, JSON.stringify(snapshot)) } catch { /* Keep this tab usable without storage. */ }
  return `/buyer/results?search=${id}`
}
export function readSearch(path: string): BuyerRequest | null {
  const id = new URL(path, window.location.origin).searchParams.get('search')
  if (!id) return null
  try {
    const r = memory.get(id) || JSON.parse(window.sessionStorage.getItem(`buyer-search-v1:${id}`) || 'null')
    return validRequest(r) ? structuredClone(r) : null
  } catch { return null }
}
