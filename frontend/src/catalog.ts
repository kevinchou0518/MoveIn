import { useEffect, useState } from 'react'
import { api } from './api'
import { categoryNames } from './types'
export type CatalogCategory = { id: string; name: string }
const eventName = 'catalog-changed'
export function useCatalog() {
  const [catalog, setCatalog] = useState<CatalogCategory[]>(Object.entries(categoryNames).map(([id, name]) => ({ id, name })))
  const [error, setError] = useState('')
  useEffect(() => {
    let alive = true
    function refresh() {
      api<CatalogCategory[]>('/categories').then(rows => {
        if (alive && rows.length) {
          rows.forEach(c => { categoryNames[c.id] = c.name })
          setCatalog(rows); setError('')
        }
      }).catch(e => { if (alive) setError(e.message) })
    }
    refresh(); window.addEventListener(eventName, refresh)
    return () => { alive = false; window.removeEventListener(eventName, refresh) }
  }, [])
  function addCategory(c: CatalogCategory) {
    categoryNames[c.id] = c.name
    setCatalog(rows => [...rows.filter(x => x.id !== c.id), c])
    window.dispatchEvent(new window.Event(eventName))
  }
  return { catalog, error, addCategory }
}
export const categoryLabel = (id: string) => categoryNames[id] || id.replaceAll('_', ' ')
export const categoryIcon = (id: string) => ['tv', 'tv_stand', 'desk', 'chair', 'sofa', 'table'].includes(id) ? `/images/${id}.svg` : '/images/item.svg'
