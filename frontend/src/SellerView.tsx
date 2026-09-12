import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, ImagePlus, MapPin, PackageCheck, Plus, Truck, Upload, X } from 'lucide-react'
import { api, post } from './api'
import { money } from './types'
import type { AnalysisResult, Category, Listing, Order, Seller, Location } from './types'
import LocationPicker from './LocationPicker'
import PriceResearch from './PriceResearch'
import CategoryPicker from './CategoryPicker'
import { categoryIcon } from './catalog'
const RouteMap = lazy(() => import('./RouteMap'))
const today = () => new Date().toISOString().slice(0, 10)

export default function SellerView() {
  const [sellers, setSellers] = useState<Seller[]>([]), [listings, setListings] = useState<Listing[]>([])
  const [sellerId, setSellerId] = useState(new URLSearchParams(window.location.search).get('driver') || 'jordan'), [tab, setTab] = useState<'listings' | 'deliveries'>(new URLSearchParams(window.location.search).get('tab') === 'deliveries' ? 'deliveries' : 'listings')
  const [deliveries, setDeliveries] = useState<Order[]>([]), [loading, setLoading] = useState(true)
  const [deliveryLoading, setDeliveryLoading] = useState(false)
  const [error, setError] = useState(''), [success, setSuccess] = useState(''), [saving, setSaving] = useState(false)
  const [newProfile, setNewProfile] = useState(false), [profileSaving, setProfileSaving] = useState(false)
  const [name, setName] = useState('')
  const [pickupLocation, setPickupLocation] = useState<Location | null>(null)
  const [canDrive, setCanDrive] = useState(false), [vehicle, setVehicle] = useState('truck')
  const [imageUrl, setImageUrl] = useState(''), [uploading, setUploading] = useState(false)
  const [title, setTitle] = useState(''), [category, setCategory] = useState<Category>('chair'), [description, setDescription] = useState('')
  const [price, setPrice] = useState(''), [condition, setCondition] = useState('good'), [score, setScore] = useState('8')
  const [size, setSize] = useState('2'), [date, setDate] = useState(today())
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null), [analyzing, setAnalyzing] = useState(false)
  const [aiError, setAiError] = useState(''), [selected, setSelected] = useState<string[]>([])
  const analysisVersion = useRef(0)
  const currentFields = useRef({ title, category, description, condition, score, price })
  currentFields.current = { title, category, description, condition, score, price }
  function clearAnalysis() { analysisVersion.current++; setAnalysis(null); setAnalyzing(false); setAiError(''); setSelected([]) }
  useEffect(() => () => { analysisVersion.current++ }, [])
  async function analyzePhoto() {
    const version = ++analysisVersion.current
    setAnalyzing(true); setAiError(''); setAnalysis(null)
    try {
      const result = await post<AnalysisResult>('/listings/analyze', { image_url: imageUrl, title, description })
      if (version !== analysisVersion.current) return
      setAnalysis(result)
      setSelected(Object.entries(currentFields.current).filter(([, value]) => !value).map(([key]) => key))
    } catch (e) { if (version === analysisVersion.current) setAiError((e as Error).message) }
    finally { if (version === analysisVersion.current) setAnalyzing(false) }
  }
  const suggestedDescription = analysis ? [analysis.description, ...analysis.visible_issues].filter(Boolean).join('\n').slice(0, 2000) : ''
  const suggestedPrice = analysis?.suggested_price_min != null && analysis.suggested_price_max != null ? (Math.round((analysis.suggested_price_min + analysis.suggested_price_max) * 50) / 100).toFixed(2) : null
  const suggestions = analysis ? [
    { key: 'title', label: 'Title', value: analysis.title, current: title },
    { key: 'category', label: 'Category', value: analysis.category, current: category },
    { key: 'description', label: 'Description and visible issues', value: suggestedDescription, current: description },
    { key: 'condition', label: 'Condition', value: analysis.condition, current: condition },
    { key: 'score', label: 'Condition score', value: analysis.condition_score == null ? null : String(analysis.condition_score), current: score },
    { key: 'price', label: 'Asking price ($)', value: suggestedPrice, current: price },
  ].filter(x => x.value != null && x.value !== '') : []
  function applySuggestions() {
    if (!analysis) return
    if (selected.includes('title') && analysis.title) setTitle(analysis.title)
    if (selected.includes('category') && analysis.category) setCategory(analysis.category)
    if (selected.includes('description')) setDescription(suggestedDescription)
    if (selected.includes('condition') && analysis.condition) setCondition(analysis.condition)
    if (selected.includes('score') && analysis.condition_score != null) setScore(String(analysis.condition_score))
    if (selected.includes('price') && suggestedPrice) setPrice(suggestedPrice)
    setSelected([]); setSuccess('Selected suggestions applied. Review and edit your listing before publishing.')
  }
  const seller = sellers.find(s => s.id === sellerId)
  useEffect(() => {
    let alive = true
    Promise.all([api<Seller[]>('/sellers'), api<Listing[]>('/listings')]).then(([s, l]) => { if (alive) { setSellers(s); setListings(l); if (!s.some(person => person.id === sellerId)) setSellerId(s[0]?.id || '') } }).catch(e => { if (alive) setError(e.message) }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])
  useEffect(() => {
    if (tab !== 'deliveries') return
    let alive = true
    setDeliveryLoading(true); setDeliveries([]); setError('')
    api<Order[]>(`/deliveries/${sellerId}`).then(d => { if (alive) setDeliveries(d) }).catch(e => { if (alive) setError(e.message) }).finally(() => { if (alive) setDeliveryLoading(false) })
    return () => { alive = false }
  }, [sellerId, tab])
  async function createProfile(e: React.FormEvent) {
    e.preventDefault(); setError('')
    if (!pickupLocation) { setError('Search and select a pickup address, or choose a demo neighborhood.'); return }
    setProfileSaving(true)
    try {
      const result = await post<Seller>('/sellers', { name, location: pickupLocation, can_drive: canDrive, vehicle_type: canDrive ? vehicle : null })
      clearAnalysis(); setSellers(s => [...s, result]); setSellerId(result.id); setNewProfile(false); setSuccess('Your seller profile is ready. Add your first piece below.')
    } catch (e) { setError((e as Error).message) } finally { setProfileSaving(false) }
  }
  async function upload(file?: File) {
    if (!file) return
    clearAnalysis(); setError(''); setSuccess('')
    if (file.size > 8 * 1024 * 1024) { setError('Choose a photo smaller than 8 MB.'); return }
    setUploading(true)
    try { const data = new FormData(); data.append('file', file); const result = await api<{ image_url: string }>('/uploads', { method: 'POST', body: data }); setImageUrl(result.image_url) }
    catch (e) { setError((e as Error).message) } finally { setUploading(false) }
  }
  async function publish(e: React.FormEvent) {
    e.preventDefault(); setError(''); setSuccess('')
    if (!imageUrl) { setError('Add a photo of your furniture before publishing.'); return }
    clearAnalysis(); setSaving(true)
    try {
      const listing = await post<Listing>('/listings', { seller_id: sellerId, title, category, description, price, condition, condition_score: Number(score), item_size: Number(size), image_url: imageUrl, available_date: date })
      setListings(items => [listing, ...items]); setSuccess(`“${listing.title}” is published${date > today() ? ` and will be available on ${date}` : ' and ready to be included in buyer bundles'}.`)
      setTitle(''); setDescription(''); setPrice(''); setImageUrl('')
    } catch (e) { setError((e as Error).message) } finally { setSaving(false) }
  }
  return <main className="page-shell seller-page">
    <section className="seller-hero"><div><p className="eyebrow">MAKE ROOM FOR WHAT’S NEXT</p><h1>Good furniture.<br /><em>A new chapter.</em></h1><p className="hero-copy">List your piece. Help someone make a home.</p></div><div className="seller-profile"><label htmlFor="seller-persona">Demo seller profile</label><select id="seller-persona" value={sellerId} onChange={e => { clearAnalysis(); setSellerId(e.target.value); setSuccess('') }}>{sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select><button className="text-button" onClick={() => { setNewProfile(!newProfile); setError('') }}><Plus size={14} /> Create your own profile</button><p className="field-hint">Switch profiles to explore this demo. No sign-in required.</p></div></section>
    {newProfile && <form className="profile-form" onSubmit={createProfile}><div className="section-heading"><h2>Your pickup & delivery details</h2><button type="button" className="icon-button" aria-label="Close profile form" onClick={() => setNewProfile(false)}><X size={19} /></button></div><div className="profile-fields"><label>Your name<input required value={name} onChange={e => setName(e.target.value)} maxLength={80} /></label><LocationPicker label="Pickup address" value={pickupLocation} onChange={setPickupLocation} /><label className="checkbox-label"><input type="checkbox" checked={canDrive} onChange={e => setCanDrive(e.target.checked)} /> I can drive and offer delivery</label>{canDrive && <label>Your vehicle<select value={vehicle} onChange={e => setVehicle(e.target.value)}><option value="sedan">Sedan · 4 units</option><option value="suv">SUV · 7 units</option><option value="truck">Truck · 12 units</option></select></label>}</div><button className="primary" disabled={profileSaving}>{profileSaving ? 'Saving profile…' : 'Save seller profile'} <ArrowRight size={16} /></button></form>}
    <div className="seller-tabs" role="tablist" aria-label="Seller dashboard"><button role="tab" aria-selected={tab === 'listings'} className={tab === 'listings' ? 'active' : ''} onClick={() => setTab('listings')}>Your listings</button><button role="tab" aria-selected={tab === 'deliveries'} className={tab === 'deliveries' ? 'active' : ''} onClick={() => setTab('deliveries')}>Delivery plans <Truck size={15} /></button></div>
    {error && <p className="error-message" role="alert">{error}</p>}{success && <p className="success-banner" role="status"><Check size={17} /> {success}</p>}
    {tab === 'listings' ? <div className="seller-grid"><section className="publish-panel"><h2>Sell a piece.</h2><p className="muted">A good photo and the honest details.</p><form onSubmit={publish}>
      <label className={`photo-upload ${imageUrl ? 'has-photo' : ''}`}>
        {imageUrl ? <img src={imageUrl} alt="Your uploaded furniture" /> : <><ImagePlus size={30} strokeWidth={1.2} /><b>{uploading ? 'Uploading your photo…' : 'Give your furniture a close-up'}</b><span>Choose a JPEG, PNG, or WebP · up to 8 MB</span></>}
        <input aria-label="Furniture photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading || saving} onChange={e => { void upload(e.target.files?.[0]); e.target.value = '' }} />
        {imageUrl && <span className="change-photo"><Upload size={13} /> Change photo</span>}
      </label>
      <label>Listing title<input required maxLength={120} placeholder="e.g. A well-loved oak writing desk" value={title} onChange={e => setTitle(e.target.value)} /></label>
      {imageUrl && <section className="ai-panel" aria-label="AI listing assistant">
        <button type="button" className="secondary" onClick={analyzePhoto} disabled={analyzing || uploading || saving}>{analyzing ? 'Analyzing photo…' : 'Analyze photo'}</button>
        <p className="field-hint">Send this photo to Grok for optional suggestions. You choose what to apply.</p>
        {analyzing && <p role="status">Looking at your furniture… You can keep editing.</p>}
        {aiError && <p role="alert" className="error-message">{aiError}</p>}
        {analysis && <><h3>Review suggestions</h3><p>AI confidence: {Math.round(analysis.confidence * 100)}%{analysis.estimated_product ? ` · ${analysis.estimated_product}` : ''}</p>
          {analysis.suggested_price_min != null && <p>Estimated resale range: {money(analysis.suggested_price_min)}–{money(analysis.suggested_price_max!)}. This is a rough estimate, not researched market pricing.</p>}
          {suggestions.length === 0 ? <p>No reliable suggestions. Try a clearer furniture photo or enter details manually.</p> : suggestions.map(suggestion => <label className="ai-suggestion" key={suggestion.key}><input type="checkbox" checked={selected.includes(suggestion.key)} onChange={e => setSelected(keys => e.target.checked ? [...keys, suggestion.key] : keys.filter(k => k !== suggestion.key))} /><span><b>{suggestion.label}</b><span>{suggestion.value}</span>{suggestion.current && <small>Replaces: {suggestion.current}</small>}</span></label>)}
          <button type="button" className="secondary" disabled={!suggestions.some(s => selected.includes(s.key))} onClick={applySuggestions}>Apply selected suggestions</button>
          <p className="field-hint">Confirm visible wear and actual condition yourself. Every field remains editable.</p>
        </>}
      </section>}
      <div className="field-row"><CategoryPicker value={category} onChange={setCategory} proposed={analysis?.proposed_category} /><label>Asking price ($)<input required type="number" min="0" max="100000" step="0.01" placeholder="45" value={price} onChange={e => setPrice(e.target.value)} /></label></div>
      <label>Description<textarea rows={3} placeholder="Dimensions, wear, and anything a new owner should know." maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} /></label>
      <div className="field-row"><label>Condition<select value={condition} onChange={e => { setCondition(e.target.value); setScore(e.target.value === 'like_new' ? '9.5' : e.target.value === 'good' ? '8' : '6') }}><option value="like_new">Like new</option><option value="good">Good</option><option value="fair">Fair</option></select></label><label>Condition score (0–10)<input type="number" required min="0" max="10" step="0.1" value={score} onChange={e => setScore(e.target.value)} /></label></div>
      <PriceResearch key={sellerId} title={title} category={category} condition={condition} imageUrl={imageUrl} onApply={setPrice} />
      <div className="field-row"><label>Item size<select value={size} onChange={e => setSize(e.target.value)}><option value="1">Small · 1 unit</option><option value="2">Medium · 2 units</option><option value="3">Large · 3 units</option></select></label><label>Available from<input type="date" required value={date} onChange={e => setDate(e.target.value)} /></label></div>
      <div className="pickup-settings"><MapPin size={18} /><div><b>Pickup in {seller?.location.label || 'your neighborhood'}</b><p>{seller?.can_drive ? `You offer delivery with a ${seller.vehicle_type} (${seller.vehicle_capacity} units).` : 'Pickup only. Another seller may deliver your item.'}</p></div></div>
      <button className="primary full" disabled={saving || uploading || !seller}>{saving ? 'Publishing…' : 'Publish listing'} <ArrowRight size={17} /></button><p className="fine-print">Your item can be included in complete furniture bundles.</p>
    </form></section><section className="seller-inventory"><div className="section-heading"><div><p className="eyebrow">READY FOR THEIR NEXT HOME</p><h2>{seller?.name.split(' ')[0] || 'Your'}’s furniture</h2></div><span className="pill">{listings.filter(i => i.seller_id === sellerId).length} listings</span></div>{loading ? <p role="status">Loading furniture…</p> : listings.filter(i => i.seller_id === sellerId).length === 0 ? <div className="empty-results"><PackageCheck size={35} strokeWidth={1} /><h3>Your first listing starts here.</h3><p>Upload a photo and tell us about your piece.</p></div> : <div className="inventory-grid">{listings.filter(i => i.seller_id === sellerId).map(i => <article className="inventory-item" key={i.id}><div className="inventory-photo"><img src={i.image_url || categoryIcon(i.category)} alt={i.title} /><span className="pill">{!i.available ? 'Reserved / sold' : i.available_date > today() ? 'Upcoming' : 'Available'}</span></div><div className="inventory-info"><h3>{i.title}</h3><span>{money(i.price)}</span><p>{i.condition_score}/10 condition · {i.item_size} size units</p></div></article>)}</div>}<div className="seller-tip"><Truck size={24} strokeWidth={1.4} /><h3>A little drive can go a long way.</h3><p>If your vehicle fits the bundle, you could be its delivery lead. Your reward and complete pickup plan will appear under Delivery plans after a buyer reserves it.</p></div></section></div> : <section className="deliveries-section"><div className="section-heading"><div><p className="eyebrow">THE NEXT STOP: A NEW HOME</p><h2>Your delivery plans</h2></div></div>{deliveryLoading ? <p role="status">Loading delivery plans…</p> : deliveries.length === 0 ? <div className="empty-results"><Truck size={38} strokeWidth={1} /><h3>No delivery assignments yet.</h3><p>Reserve a seller-delivered bundle in buyer mode, then choose its driver’s profile here.</p></div> : deliveries.map(order => <article className="delivery-card" key={order.id}><div className="section-heading"><div><span className="pill"><Check size={13} /> Reserved · {order.id.slice(0, 8)}</span><h3>{order.bundle.listings.length} pieces. One new home.</h3></div><div className="driver-reward"><small>You earn</small><strong>{money(order.bundle.delivery_fee)}</strong>{order.bundle.reward_breakdown && <p className="reward-breakdown">Base {money(order.bundle.reward_breakdown.base)}<br />{order.bundle.distance_miles} miles × $1 = {money(order.bundle.reward_breakdown.distance)}<br />{order.bundle.reward_breakdown.additional_stops} additional stops × $2 = {money(order.bundle.reward_breakdown.stops_fee)}</p>}<small>Demo reward · no payment is processed</small></div></div><div className="detail-grid"><div><Suspense fallback={<p>Loading route…</p>}><RouteMap route={order.bundle.route} /></Suspense><p className="map-note">{order.bundle.route.warning} Driving time excludes loading.</p></div><div><p className="delivery-facts"><b>{order.bundle.distance_miles} miles</b> · {Math.ceil(order.bundle.duration_minutes)} min driving · {order.bundle.total_size}/{order.bundle.driver?.vehicle_capacity} capacity units</p><ol className="stop-list">{order.bundle.route.stops.map((s, index) => <li key={index}><span className={`stop-number ${s.kind}`}>{index + 1}</span><div><b>{s.name}{s.kind === 'buyer' ? ' · Deliver here' : ''}</b><p>{s.location.label || 'Pickup location'}</p><small>{order.bundle.listings.filter(i => s.listing_ids.includes(i.id)).map(i => i.title).join(', ')}</small></div></li>)}</ol></div></div></article>)}</section>}
  </main>
}
