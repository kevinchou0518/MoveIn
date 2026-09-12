import { useEffect, useId, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { categoryLabel, useCatalog } from './catalog'

const LIMIT = 6

export default function BuyerCategorySelect({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  const { catalog, error } = useCatalog()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const id = useId()
  const atLimit = value.length >= LIMIT
  const matches = catalog.filter(c => c.name.toLowerCase().includes(query.trim().toLowerCase()))

  useEffect(() => {
    if (!open) return
    search.current?.focus()
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])

  function toggle(id: string) {
    if (value.includes(id)) onChange(value.filter(c => c !== id))
    else if (!atLimit) onChange([...value, id])
  }

  return <fieldset className="category-field">
    <legend><span className="step-number">01</span> What do you need?</legend>
    <div className="buyer-category-select" ref={root} onKeyDown={event => {
      if (event.key === 'Escape' && open) {
        event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus()
      }
    }} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
    }}>
      <div className="buyer-category-tags">
        {value.map(id => <span className="buyer-category-tag" key={id}>
          {catalog.find(c => c.id === id)?.name || categoryLabel(id)}
          <button type="button" aria-label={`Remove ${categoryLabel(id)}`} onClick={() => {
            toggle(id); trigger.current?.focus()
          }}><X size={13} aria-hidden="true" /></button>
        </span>)}
        <button className="buyer-category-add" type="button" ref={trigger} aria-expanded={open} aria-controls={`${id}-panel`} onClick={() => {
          if (!open) setQuery('')
          setOpen(!open)
        }}><Plus size={14} aria-hidden="true" /> Add category</button>
      </div>
      {open && <div className="buyer-category-panel" id={`${id}-panel`}>
        <label htmlFor={`${id}-search`}>Search categories</label>
        <input id={`${id}-search`} ref={search} value={query} placeholder="Type a category name…" onChange={e => setQuery(e.target.value)} />
        <div className="buyer-category-options" role="group" aria-label="Available categories">
          {matches.map(c => <label className={`buyer-category-option ${atLimit && !value.includes(c.id) ? 'unavailable' : ''}`} key={c.id}>
            <input type="checkbox" checked={value.includes(c.id)} disabled={atLimit && !value.includes(c.id)} onChange={() => toggle(c.id)} />
            <span>{c.name}</span>
          </label>)}
          {!matches.length && <p className="buyer-category-empty">No categories found. Try another name.</p>}
        </div>
        {error && <p className="buyer-category-empty" role="status">Couldn’t refresh categories. Showing available options.</p>}
      </div>}
    </div>
    <p className="field-hint buyer-category-count" role="status">{value.length} / {LIMIT} categories selected{atLimit ? ' — remove one to add another.' : '. Choose up to six.'}</p>
  </fieldset>
}
