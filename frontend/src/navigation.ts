import { useEffect, useState } from 'react'
import type { BuyerRequest } from './types'
import { saveSearch } from './searchSession'
type Entry = { index: number; results?: { index: number; path: string } }
function currentEntry(): Entry {
  if (Number.isInteger(window.history.state?.snack?.index)) return window.history.state.snack
  const path = window.location.pathname + window.location.search
  const entry: Entry = { index: 0, results: path.startsWith('/buyer/results') ? { index: 0, path } : undefined }
  window.history.replaceState({ ...window.history.state, snack: entry }, '')
  return entry
}
export function navigate(path: string, replace = false) {
  const current = currentEntry()
  const index = current.index + (replace ? 0 : 1)
  const results = path.startsWith('/buyer/results') ? { index, path } :
    /^\/(bundles|orders)\//.test(path) ? current.results : undefined
  const state = { snack: { index, results } }
  if (replace) window.history.replaceState(state, '', path)
  else window.history.pushState(state, '', path)
  window.dispatchEvent(new window.PopStateEvent('popstate'))
}
export function backToResults(request?: BuyerRequest) {
  const current = currentEntry()
  if (current.results && current.results.index < current.index) {
    window.history.go(current.results.index - current.index)
  } else navigate(request ? saveSearch(request) : '/buyer', true)
}
export function usePath() {
  const [path, setPath] = useState(window.location.pathname+window.location.search)
  useEffect(() => { const update = () => setPath(window.location.pathname+window.location.search); window.addEventListener('popstate',update); return () => window.removeEventListener('popstate',update) },[])
  return path
}
