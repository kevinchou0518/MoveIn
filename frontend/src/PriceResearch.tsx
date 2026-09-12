import { useEffect, useRef, useState } from 'react'
import { post } from './api'
import { categoryLabel } from './catalog'
import { money } from './types'
import type { ResearchResult } from './types'
export default function PriceResearch({ title, category, condition, imageUrl, onApply }: { title: string; category: string; condition: string; imageUrl: string; onApply: (price: string) => void }) {
  const [brand, setBrand] = useState(''), [model, setModel] = useState('')
  const [result, setResult] = useState<ResearchResult | null>(null), [pending, setPending] = useState(false), [error, setError] = useState(''), [price, setPrice] = useState('')
  const version = useRef(0)
  useEffect(() => { version.current++; setResult(null); setPending(false); setError(''); return () => { version.current++ } }, [title, category, condition, brand, model, imageUrl])
  async function research() {
    const id = ++version.current
    setPending(true); setError(''); setResult(null)
    try {
      const data = await post<ResearchResult>('/listings/research-price', { title, category, condition, brand, model })
      if (id === version.current) { setResult(data); setPrice(data.price_min == null ? '' : String(data.price_min)) }
    } catch (e) { if (id === version.current) setError((e as Error).message) }
    finally { if (id === version.current) setPending(false) }
  }
  return <details className="price-research"><summary>Research comparable prices</summary><p className="field-hint">Review your title, category and condition above first. This separate search sends those details to Grok.</p><div className="field-row"><label>Brand (optional)<input maxLength={80} value={brand} onChange={e => setBrand(e.target.value)} /></label><label>Model (optional)<input maxLength={120} value={model} onChange={e => setModel(e.target.value)} /></label></div><p>{title || 'Add a listing title'} · {categoryLabel(category)} · {condition.replaceAll('_', ' ')}</p><button type="button" className="secondary" onClick={research} disabled={pending || !title.trim()}>{pending ? 'Researching prices…' : 'Search comparable prices'}</button>{pending && <p role="status">Checking sources. This can take up to a minute.</p>}{error && <p role="alert" className="error-message">{error}</p>}{result && <div className="research-results"><p>{result.summary}</p><small>Researched {new Date(result.researched_at).toLocaleString()}</small>{result.comparables.map(c => <article key={c.url}><a href={c.url} target="_blank" rel="noopener noreferrer">{c.title} ↗</a><p><b>{money(c.price)}</b> · {({ used_asking: 'Used asking price', sold: 'Reported sold price', new_retail: 'New retail price' } as Record<string, string>)[c.kind]}{c.condition ? ` · ${c.condition}` : ''}</p></article>)}{result.price_min != null && result.price_max != null && <><p>Used asking range: <b>{money(result.price_min)}–{money(result.price_max)}</b></p><label>Price to apply ($)<input type="number" min="0" max="100000" step="0.01" value={price} onChange={e => setPrice(e.target.value)} /></label><button className="secondary" type="button" disabled={!price || !Number.isFinite(Number(price)) || Number(price) < 0 || Number(price) > 100000} onClick={() => onApply(Number(price).toFixed(2))}>Apply researched price</button></>}</div>}</details>
}
