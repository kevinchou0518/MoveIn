import { useState } from 'react'
import { post } from './api'
import { useCatalog } from './catalog'
import type { CatalogCategory } from './catalog'
export default function CategoryPicker({ value, onChange, proposed }: { value: string; onChange: (value: string) => void; proposed?: string | null }) {
  const { catalog, addCategory, error: catalogError } = useCatalog()
  const [name, setName] = useState(''), [pending, setPending] = useState(false), [error, setError] = useState('')
  async function create(categoryName: string) {
    setPending(true); setError('')
    try { const c = await post<CatalogCategory>('/categories', { name: categoryName.trim() }); addCategory(c); onChange(c.id); setName('') }
    catch (e) { setError((e as Error).message) } finally { setPending(false) }
  }
  return <div className="category-picker"><label>Category<select value={value} onChange={e => onChange(e.target.value)}>{catalog.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><details><summary>Find or add a category</summary><label>Category name<input value={name} maxLength={60} onChange={e => setName(e.target.value)} /></label><div className="category-matches">{name.trim() && catalog.filter(c => c.name.toLowerCase().includes(name.trim().toLowerCase())).map(c => <button className="text-button" type="button" key={c.id} onClick={() => { onChange(c.id); setName('') }}>{c.name}</button>)}</div><button type="button" className="secondary" disabled={pending || !name.trim()} onClick={() => create(name)}>Create and select category</button></details>{proposed && <p>Suggested new category: {proposed} <button type="button" className="text-button" disabled={pending} onClick={() => create(proposed)}>Create suggested category</button></p>}{(error || catalogError) && <p role="alert">{error || catalogError}</p>}</div>
}
