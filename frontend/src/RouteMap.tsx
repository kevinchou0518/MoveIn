import { useEffect, useRef } from 'react'
import type { Route } from './types'

export default function RouteMap({ route }: { route: Route }) {
  const host = useRef<HTMLDivElement>(null)
  const token = import.meta.env?.VITE_MAPBOX_TOKEN
  useEffect(() => {
    if (!token || !host.current) return
    let canceled = false
    let map: import('leaflet').Map | undefined
    Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([L]) => {
      if (canceled || !host.current) return
      map = L.map(host.current, { scrollWheelZoom: false }).setView([route.stops[0].location.lat, route.stops[0].location.lng], 13)
      L.tileLayer(`https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/256/{z}/{x}/{y}?access_token=${encodeURIComponent(token)}`, {
        attribution: '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> <a href="https://apps.mapbox.com/feedback/">Improve this map</a>', maxZoom: 18,
      }).addTo(map)
      const line = L.polyline(route.geometry.map(([lng, lat]) => [lat, lng]), { color: '#285c3c', weight: 4, dashArray: route.geometry_source === 'schematic' ? '8,8' : undefined }).addTo(map)
      route.stops.forEach((stop, i) => {
        const tooltip = document.createElement('span')
        tooltip.textContent = `${i + 1}. ${stop.name}`
        L.marker([stop.location.lat, stop.location.lng], {
        icon: L.divIcon({ className: 'route-pin', html: `<span>${i + 1}</span>`, iconSize: [30, 30], iconAnchor: [15, 15] }),
      }).bindTooltip(tooltip, { direction: 'top' }).addTo(map!)
      })
      map.fitBounds(line.getBounds(), { padding: [38, 38], maxZoom: 15 })
    }).catch(() => { /* The route list remains available if map loading fails. */ })
    return () => { canceled = true; map?.remove() }
  }, [route, token])
  if (token) return <div className="route-map" ref={host} role="img" aria-label="Map of the selected pickup route" />
  const coordinates = [...route.geometry, ...route.stops.map(s => [s.location.lng, s.location.lat])]
  const minLng = Math.min(...coordinates.map(p => p[0])), maxLng = Math.max(...coordinates.map(p => p[0]))
  const minLat = Math.min(...coordinates.map(p => p[1])), maxLat = Math.max(...coordinates.map(p => p[1]))
  const centerLng = (minLng + maxLng) / 2, centerLat = (minLat + maxLat) / 2
  const longitudeScale = Math.cos(centerLat * Math.PI / 180)
  const scale = Math.min(390 / Math.max((maxLng - minLng) * longitudeScale, .006), 170 / Math.max(maxLat - minLat, .006))
  const project = (lng: number, lat: number) => [270 + (lng - centerLng) * longitudeScale * scale, 165 - (lat - centerLat) * scale]
  const points = route.geometry.map(([lng, lat]) => project(lng, lat).join(',')).join(' ')
  return <div className="route-map schematic">
    <svg viewBox="0 0 540 340" role="img" aria-label="Geographic route schematic. Lines connect pickup stops; they do not represent roads.">
      <defs><pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M 30 0 L 0 0 0 30" fill="none" stroke="#dfe4d8" strokeWidth=".7" /></pattern></defs>
      <rect width="540" height="340" fill="#edf0e6" /><rect width="540" height="340" fill="url(#grid)" />
      <text x="24" y="32" fontSize="11" fill="#687562" letterSpacing="2">PICKUP ROUTE · SCHEMATIC</text>
      <text x="503" y="33" fontSize="12" fill="#687562">N ↑</text>
      <polyline points={points} stroke="#326749" strokeWidth="3" strokeDasharray="7 5" fill="none" />
      {route.stops.map((s, i) => {
        if (i === 0 && s.kind === 'buyer') return null
        const [x, y] = project(s.location.lng, s.location.lat)
        return <g key={i}>
          <circle cx={x} cy={y} r="16" fill={s.kind === 'buyer' ? '#d46a3a' : '#214e35'} stroke="#fafbf6" strokeWidth="3" />
          <text x={x} y={y + 4} textAnchor="middle" fontSize="12" fill="#fffdf5" fontWeight="700">{s.kind === 'buyer' && route.stops[0].kind === 'buyer' ? `1/${i + 1}` : i + 1}</text>
          <text x={x} y={y + 34} textAnchor="middle" fill="#294535" fontSize="12" fontWeight="600" paintOrder="stroke" stroke="#edf0e6" strokeWidth="5">{s.kind === 'buyer' ? 'Your place' : s.name.split(' ')[0]}</text>
        </g>
      })}
      <text x="24" y="317" fontSize="11" fill="#687562">Positions are geographic. Dashed lines are not roads.</text>
    </svg>
  </div>
}
