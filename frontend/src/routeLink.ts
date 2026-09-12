import type { Location, Route } from './types'

const point = (l: Location) => `${l.lat.toFixed(6)},${l.lng.toFixed(6)}`

// Google Maps URLs need no API key. Stops are the optimizer's visit order: first is the origin
// (driver's pickup or the buyer), last is the destination (always the buyer), the rest are waypoints.
export function googleMapsUrl(route: Route): string | null {
  const stops = route.stops
  if (!stops.length) return null
  if (stops.length === 1) return `https://www.google.com/maps/search/?api=1&query=${point(stops[0].location)}`
  const params = new URLSearchParams({ api: '1', origin: point(stops[0].location), destination: point(stops[stops.length - 1].location), travelmode: 'driving' })
  const waypoints = stops.slice(1, -1).map(s => point(s.location))
  if (waypoints.length) params.set('waypoints', waypoints.join('|'))
  return `https://www.google.com/maps/dir/?${params}`
}
