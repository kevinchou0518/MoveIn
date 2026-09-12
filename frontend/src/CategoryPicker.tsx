import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown, Plus } from 'lucide-react'
import { post } from './api'
import { categoryLabel, useCatalog } from './catalog'
import type { CatalogCategory } from './catalog'
export default function CategoryPicker({ value, onChange, proposed }: { value: string; onChange: (value: string) => void; proposed?: string | null }) {
  const { catalog, addCategory, error: catalogError } = useCatalog()
  const [name, setName] = useState(''), [pending, setPending] = useState(false), [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), search = useRef<HTMLInputElement>(null)
  const id = useId()
  const query = name.trim()
  const matches = catalog.filter(c => c.name.toLowerCase().includes(query.toLowerCase()))
  const exact = catalog.some(c => c.name.toLowerCase() === query.toLowerCase())
  useEffect(() => {
    if (!open) return
    search.current?.focus()
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  function select(categoryId: string) {
    onChange(categoryId); setOpen(false); setName(''); trigger.current?.focus()
  }
  async function create(categoryName: string) {
    setPending(true); setError('')
    try { const c = await post<CatalogCategory>('/categories', { name: categoryName.trim() }); addCategory(c); select(c.id) }
    catch (e) { setError((e as Error).message) } finally { setPending(false) }
  }
  return <div className="category-picker" ref={root} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
  }} onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus() }
  }}>
    <label id={`${id}-label`} htmlFor={`${id}-trigger`}>Category</label>
    <button id={`${id}-trigger`} ref={trigger} className="seller-category-trigger" type="button" aria-labelledby={`${id}-label ${id}-value`} aria-expanded={open} aria-controls={`${id}-panel`} onClick={() => {
      if (!open) { setName(''); setError('') }
      setOpen(!open)
    }}><span id={`${id}-value`}>{catalog.find(c => c.id === value)?.name || categoryLabel(value) || 'Select category'}</span><ChevronDown size={16} aria-hidden="true" /></button>
    {open && <div className="seller-category-panel" id={`${id}-panel`}>
      <input aria-label="Search categories" ref={search} value={name} maxLength={60} placeholder="Search or add…" disabled={pending} onChange={e => setName(e.target.value)} onKeyDown={e => {
        if (e.key === 'Enter') e.preventDefault()
      }} />
      <div className="seller-category-options" role="group" aria-label="Categories">
        {matches.map(c => <button type="button" key={c.id} aria-pressed={value === c.id} disabled={pending} onClick={() => select(c.id)}>
          <span>{c.name}</span>{value === c.id && <Check size={14} aria-hidden="true" />}
        </button>)}
        {!matches.length && <p>No matching categories.</p>}
      </div>
      {query && !exact && <button className="seller-category-create" type="button" disabled={pending} onClick={() => create(query)}><Plus size={14} aria-hidden="true" />{pending ? 'Adding…' : `Add “${query}”`}</button>}
      {!query && proposed && !catalog.some(c => c.name.toLowerCase() === proposed.trim().toLowerCase()) && <button className="seller-category-create" type="button" disabled={pending} onClick={() => create(proposed)}><Plus size={14} aria-hidden="true" />{pending ? 'Adding…' : `Add suggested “${proposed}”`}</button>}
    </div>}
    {(error || catalogError) && <p className="seller-category-error" role="alert">{error || catalogError}</p>}
  </div>
}
