import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, ImagePlus, MapPin, PackageCheck, Plus, Truck, Upload, X } from 'lucide-react'
import { api, post } from './api'
import { money } from './types'
import type { AnalysisResult, Category, Listing, Seller, Location } from './types'
import LocationPicker from './LocationPicker'
import PriceResearch from './PriceResearch'
import CategoryPicker from './CategoryPicker'
import { categoryIcon } from './catalog'
import { navigate } from './navigation'
import { OrderHistory } from './Orders'
const today = () => new Date().toISOString().slice(0, 10)

export default function SellerView() {
  const [sellers, setSellers] = useState<Seller[]>([]), [listings, setListings] = useState<Listing[]>([])
  const route = window.location.pathname.split('/')
  const [sellerId, setSellerId] = useState(route[2] || '')
  const tab = route[3] || 'listings'
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [editingProfile, setEditingProfile] = useState(false)
  const [retry, setRetry] = useState(0)
  const profileInitialized = useRef(false)
  const dashboardLoaded = useRef(false)
  const inventoryVersion = useRef(0), inventoryWrites = useRef(0)
  const pendingListingIds = useRef(new Set<string>())
  const [pendingListings, setPendingListings] = useState<Set<string>>(new Set())
  function beginInventoryWrite(id: string) {
    if (pendingListingIds.current.has(id)) return false
    pendingListingIds.current.add(id)
    setPendingListings(new Set(pendingListingIds.current))
    inventoryVersion.current++; inventoryWrites.current++
    return true
  }
  function endInventoryWrite(id: string) {
    pendingListingIds.current.delete(id)
    setPendingListings(new Set(pendingListingIds.current))
    inventoryVersion.current++; inventoryWrites.current--
  }
  const [loadError, setLoadError] = useState('')
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
  function restoreProfile(current: Seller) {
    setName(current.name); setPickupLocation(current.location); setCanDrive(current.can_drive)
    setVehicle(current.vehicle_type || 'truck'); setEditingProfile(true); setNewProfile(true)
  }
  useEffect(() => {
    let alive = true
    const version = inventoryVersion.current
    const startedDuringWrite = inventoryWrites.current > 0
    setLoading(!dashboardLoaded.current); setLoadError('')
    Promise.all([api<{sellers: Seller[]}>('/me'), api<Listing[]>('/listings')])
      .then(([me, inventory]) => {
        if (!alive) return
        dashboardLoaded.current = true
        setSellers(me.sellers)
        if (!startedDuringWrite && inventoryWrites.current === 0 && version === inventoryVersion.current) setListings(inventory)
        if (sellerId && !me.sellers.some(person => person.id === sellerId)) {
          setSellerId(''); setLoadError('This seller profile is not owned by your account.'); return
        }
        if (!sellerId && me.sellers.length) {
          navigate('/seller/' + me.sellers[0].id + '/listings', true); return
        }
        if (!profileInitialized.current) {
          const current = me.sellers.find(p => p.id === sellerId)
          if (tab === 'profile' && current) restoreProfile(current)
          if (!me.sellers.length) setNewProfile(true)
          profileInitialized.current = true
        }
      })
      .catch(e => { if (alive) setLoadError(e.message) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [retry])

  useEffect(() => { const refresh = () => setRetry(n => n + 1); window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh) }, [])
  function edit(item: Listing) {
    if (pendingListingIds.current.has(item.id) || saving) return
    clearAnalysis(); setEditing(item.id); setTitle(item.title); setCategory(item.category); setDescription(item.description); setPrice(String(item.price)); setCondition(item.condition); setScore(String(item.condition_score)); setSize(String(item.item_size)); setImageUrl(item.image_url); setDate(item.available_date); setError(''); setSuccess('')
    document.getElementById('listing-editor')?.scrollIntoView({behavior: 'smooth'})
  }
  async function inventoryAction(id: string, action: string) {
    if (!beginInventoryWrite(id)) return
    setError('')
    try { const updated = await post<Listing>(`/listings/${id}/${action}`); setListings(items => items.map(i => i.id === id ? updated : i)) }
    catch (e) { setError((e as Error).message) }
    finally { endInventoryWrite(id) }
  }
  async function createProfile(e: React.FormEvent) {
    e.preventDefault(); setError('')
    if (!pickupLocation) { setError('Search and select a pickup address, or choose a demo neighborhood.'); return }
    setProfileSaving(true)
    try {
      const result = await api<Seller>(editingProfile ? `/sellers/${sellerId}` : '/sellers', {method: editingProfile ? 'PATCH' : 'POST', body: JSON.stringify({ name, location: pickupLocation, can_drive: canDrive, vehicle_type: canDrive ? vehicle : null })})
      clearAnalysis(); navigate(`/seller/${result.id}/listings`)
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
    const writeId = editing || 'new-listing'
    if (!beginInventoryWrite(writeId)) return
    clearAnalysis(); setSaving(true)
    try {
      const listing = await api<Listing>(editing ? `/listings/${editing}` : '/listings', {method: editing ? 'PATCH' : 'POST', body: JSON.stringify({ ...(!editing ? {seller_id: sellerId} : {}), title, category, description, price, condition, condition_score: Number(score), item_size: Number(size), image_url: imageUrl, available_date: date })})
      setListings(items => [listing, ...items.filter(i => i.id !== listing.id)]); setEditing(null)
      setSuccess(listing.status === 'withdrawn'
        ? `Changes to “${listing.title}” were saved. This listing is still withdrawn. Republish it to make it available to buyers.`
        : `“${listing.title}” is published${date > today() ? ` and will be available on ${date}` : ' and ready to be included in buyer bundles'}.`)
      setTitle(''); setDescription(''); setPrice(''); setImageUrl('')
    } catch (e) { setError((e as Error).message) } finally { endInventoryWrite(writeId); setSaving(false) }
  }
  return <main className="page-shell seller-page">
    <section className="seller-hero"><div><p className="eyebrow">MAKE ROOM FOR WHAT’S NEXT</p><h1>Good furniture.<br /><em>A new chapter.</em></h1><p className="hero-copy">List your piece. Help someone make a home.</p></div><div className="seller-profile"><label htmlFor="seller-persona">Your seller profile</label><select id="seller-persona" value={sellerId} onChange={e => { clearAnalysis(); navigate(`/seller/${e.target.value}/listings`) }}>{sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select><button className="text-button" onClick={() => { profileInitialized.current = true; setEditingProfile(false); setName(''); setPickupLocation(null); setCanDrive(false); setVehicle('truck'); setNewProfile(!newProfile); setError('') }}><Plus size={14} /> Create your own profile</button><p className="field-hint">Only profiles owned by your account appear here.</p></div></section>
    {newProfile && <form className="profile-form" onSubmit={createProfile}><div className="section-heading"><h2>Your pickup & delivery details</h2><button type="button" className="icon-button" aria-label="Close profile form" onClick={() => setNewProfile(false)}><X size={19} /></button></div><div className="profile-fields"><label>Your name<input required value={name} onChange={e => setName(e.target.value)} maxLength={80} /></label><LocationPicker label="Pickup address" value={pickupLocation} onChange={setPickupLocation} /><label className="checkbox-label"><input type="checkbox" checked={canDrive} onChange={e => setCanDrive(e.target.checked)} /> I can drive and offer delivery</label>{canDrive && <label>Your vehicle<select value={vehicle} onChange={e => setVehicle(e.target.value)}><option value="sedan">Sedan · 4 units</option><option value="suv">SUV · 7 units</option><option value="truck">Truck · 12 units</option></select></label>}</div>{editingProfile && seller && <button type="button" className="secondary" disabled={profileSaving} onClick={() => restoreProfile(seller)}>Discard profile changes</button>}<button className="primary" disabled={profileSaving}>{profileSaving ? 'Saving profile…' : 'Save seller profile'} <ArrowRight size={16} /></button></form>}
    {sellerId && <div className="seller-tabs" role="tablist" aria-label="Seller dashboard">{[['listings','Inventory'],['orders','Orders'],['deliveries','Deliveries'],['profile','Profile']].map(([id,label]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => navigate(`/seller/${sellerId}/${id}`)}>{label}</button>)}</div>}

    {loadError && <p className="error-message" role="alert">{loadError} <button className="secondary" onClick={() => setRetry(n => n + 1)}>Retry dashboard</button></p>}
    {error && <p className="error-message" role="alert">{error}</p>}{success && <p className="success-banner" role="status"><Check size={17} /> {success}</p>}
    {tab === 'listings' ? <div className="seller-grid"><section className="publish-panel" id="listing-editor"><h2>{editing ? 'Edit your listing' : 'Sell a piece.'}</h2>{editing && <button className="text-button" disabled={saving} onClick={() => { if (saving) return; setEditing(null); setTitle(''); setDescription(''); setImageUrl(''); setPrice(''); clearAnalysis() }}>Cancel editing</button>}<p className="muted">A good photo and the honest details.</p><form onSubmit={publish}><fieldset className="listing-editor-fields" disabled={saving} aria-label="Listing details">
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
      <button className="primary full" disabled={saving || uploading || !seller || pendingListings.has(editing || 'new-listing')}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Publish listing'} <ArrowRight size={17} /></button><p className="fine-print">Your item can be included in complete furniture bundles.</p>
    </fieldset></form></section><section className="seller-inventory"><div className="section-heading"><div><p className="eyebrow">READY FOR THEIR NEXT HOME</p><h2>{seller?.name.split(' ')[0] || 'Your'}’s furniture</h2></div><span className="pill">{listings.filter(i => i.seller_id === sellerId).length} listings</span></div>{loading ? <p role="status">Loading furniture…</p> : listings.filter(i => i.seller_id === sellerId).length === 0 ? <div className="empty-results"><PackageCheck size={35} strokeWidth={1} /><h3>Your first listing starts here.</h3><p>Upload a photo and tell us about your piece.</p></div> : <div className="inventory-grid">{listings.filter(i => i.seller_id === sellerId).map(i => <article className="inventory-item" key={i.id}><div className="inventory-photo"><img src={i.image_url || categoryIcon(i.category)} alt={i.title} /><span className="pill">{i.status === 'withdrawn' ? 'Withdrawn' : !i.available ? (i.status || 'Reserved / sold') : i.available_date > today() ? 'Upcoming' : 'Available'}</span></div><div className="inventory-info"><h3>{i.title}</h3><span>{money(i.price)}</span><p>{i.condition_score}/10 condition · {i.item_size} size units</p>{(i.available || i.status === 'withdrawn') && <div className="dialog-actions"><button className="secondary" disabled={saving || pendingListings.has(i.id)} onClick={() => edit(i)}>Edit</button><button className="secondary" disabled={pendingListings.has(i.id)} onClick={() => inventoryAction(i.id, i.status === 'withdrawn' ? 'publish' : 'withdraw')}>{i.status === 'withdrawn' ? 'Republish' : 'Withdraw'}</button></div>}</div></article>)}</div>}<div className="seller-tip"><Truck size={24} strokeWidth={1.4} /><h3>A little drive can go a long way.</h3><p>If your vehicle fits the bundle, you could be its delivery lead. Your reward and complete pickup plan will appear under Delivery plans after a buyer reserves it.</p></div></section></div> : sellerId && (tab === 'orders' || tab === 'deliveries') ? <OrderHistory key={sellerId + tab} sellerId={sellerId} deliveries={tab === 'deliveries'} /> : null}
  </main>
}
