import { useId, useRef, useState, useEffect } from 'react'
import { MapPin, Search } from 'lucide-react'
import { api } from './api'
import type { Location } from './types'

export const demoPlaces: Location[] = [
  { label: 'Oakland, Pittsburgh', lat: 40.443, lng: -79.943 },
  { label: 'Shadyside, Pittsburgh', lat: 40.4512, lng: -79.9321 },
  { label: 'Squirrel Hill, Pittsburgh', lat: 40.4318, lng: -79.9222 },
]

export default function LocationPicker({ label, value, onChange, initialQuery = '' }: { initialQuery?: string; label: string; value: Location | null; onChange: (location: Location | null) => void }) {
  const id = useId()
  const [query, setQuery] = useState(value?.label || initialQuery)
  const [results, setResults] = useState<Location[]>([])
  const [loading, setLoading] = useState(false), [message, setMessage] = useState('')
  const version = useRef(0)
  useEffect(() => () => { version.current++ }, [])
  useEffect(() => {
    // History navigation restores the selected location from the saved request.
    // A null value means the user is editing: preserve their unfinished query.
    if (!value) return
    version.current++
    setQuery(value.label || '')
    setResults([]); setMessage(''); setLoading(false)
  }, [value])
  function choose(location: Location) {
    version.current++; setLoading(false); setQuery(location.label || ''); setResults([]); setMessage(''); onChange(location)
  }
  async function search() {
    if (query.trim().length < 3) { setMessage('Enter at least three characters to search.'); return }
    const request = ++version.current
    setLoading(true); setResults([]); setMessage('')
    try {
      const found = await api<Location[]>(`/locations/search?q=${encodeURIComponent(query.trim())}`)
      if (request !== version.current) return
      setResults(found); setMessage(found.length ? 'Choose the matching address below.' : 'No matches. Try a street address with a city or ZIP code.')
    } catch (e) { if (request === version.current) setMessage((e as Error).message) }
    finally { if (request === version.current) setLoading(false) }
  }
  return <div className="location-picker">
    <label htmlFor={id}>{label}</label>
    <div className="address-search"><input id={id} type="search" value={query} maxLength={200} placeholder="Street address, neighborhood, or city" autoComplete="off" aria-describedby={`${id}-status`} onChange={e => { version.current++; setQuery(e.target.value); setLoading(false); setResults([]); setMessage(''); onChange(null) }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void search() } }} /><button type="button" aria-label={`Search ${label.toLowerCase()}`} disabled={loading || query.trim().length < 3} onClick={search}><Search size={16} />{loading ? 'Searching…' : 'Search'}</button></div>
    <p id={`${id}-status`} className="field-hint" role="status">{message || (value ? 'Location selected. Edit to search somewhere else.' : 'Search, then select a result to confirm your location.')}</p>
    {results.length > 0 && <ul className="address-results" aria-label={`${label} search results`}>{results.map((location, i) => <li key={`${location.lat}-${location.lng}-${i}`}><button type="button" onClick={() => choose(location)}><MapPin size={16} /><span>{location.label}</span></button></li>)}</ul>}
    <small className="location-attribution">Search by Mapbox</small>
  </div>
}
