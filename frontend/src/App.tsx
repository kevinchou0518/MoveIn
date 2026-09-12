import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ArrowRight, Armchair, CarFront, Check, ChevronDown, Clock3, Leaf, MapPin, PackageCheck, Plus, Route as RouteIcon, SlidersHorizontal, Sofa, Sparkles, Truck, Tv, Users } from 'lucide-react'
import { api, post } from './api'
import { categoryNames, money } from './types'
import type { Bundle, BundleResponse, Category, Order } from './types'
const SellerView = lazy(() => import('./SellerView'))
const RouteMap = lazy(() => import('./RouteMap'))
const categories = Object.keys(categoryNames) as Category[]
const INITIAL_CATEGORIES: Category[] = ['tv', 'tv_stand', 'desk', 'chair']
const places = [{ name: 'Oakland, Pittsburgh', lat: 40.443, lng: -79.943 }, { name: 'Shadyside, Pittsburgh', lat: 40.4512, lng: -79.9321 }, { name: 'Squirrel Hill, Pittsburgh', lat: 40.4318, lng: -79.9222 }]

function ProductImage({ category, src, title }: { category: Category; src?: string; title: string }) {
  return <img src={src || `/images/${category}.svg`} alt={title} loading="lazy" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = `/images/${category}.svg` }} />
}

function BundleCard({ bundle, index, active, choose }: { bundle: Bundle; index: number; active: boolean; choose: () => void }) {
  return <article className={`bundle-card ${active ? 'chosen' : ''}`}>
    <div className="bundle-card-heading"><span className={index === 0 ? 'pill recommended' : 'pill'}>{index === 0 ? <><Sparkles size={12} /> Best match</> : `Option 0${index + 1}`}</span><span className="condition">{bundle.condition_score}<span>/10 condition</span></span></div>
    <div className="product-grid">{bundle.listings.map(item => <div className={`product-shot ${item.category}`} key={item.id}><ProductImage category={item.category} src={item.image_url} title={item.title} /><span>{categoryNames[item.category]}</span><b>{money(item.price)}</b></div>)}</div>
    <h3>{index === 0 ? 'Your fresh-start bundle' : index === 1 ? 'Another good fit' : 'One more possibility'}</h3>
    <p className="bundle-summary">{bundle.listings.length} pieces · {bundle.seller_count} {bundle.seller_count === 1 ? 'seller' : 'sellers'} · Ready for a new home</p>
    <div className="transport-line">{bundle.driver ? <Truck size={15} /> : <CarFront size={15} />}<span>{bundle.driver ? `Delivered by ${bundle.driver.name.split(' ')[0]}` : 'Your pickup route'}</span></div>
    <div className="bundle-metrics"><span><Clock3 size={14} /> {Math.ceil(bundle.duration_minutes)} min</span><span><RouteIcon size={14} /> {bundle.distance_miles} mi</span><span>{bundle.route.source === 'estimated' ? 'Estimated' : 'Road route'}</span></div>
    <div className="price-breakdown"><span>Furniture <b>{money(bundle.item_total)}</b></span><span>{bundle.driver ? 'Delivery' : 'Pickup fee'} <b>{money(bundle.delivery_fee)}</b></span></div>
    <div className="bundle-total"><div><strong>{money(bundle.total)}</strong><small>total</small></div><button onClick={choose} className="view-button" aria-label={`View bundle ${index + 1}`}>{active ? 'Viewing' : 'View bundle'} <ArrowRight size={15} /></button></div>
  </article>
}

function BundleDetails({ bundle, onCheckout, pending, error, order }: { bundle: Bundle; onCheckout: () => void; pending: boolean; error: string; order: Order | null }) {
  return <section className="bundle-detail" aria-labelledby="detail-title">
    <div className="section-heading"><div><p className="eyebrow">THE WHOLE PLAN</p><h2 id="detail-title">Good finds. One simple route.</h2></div><span className="pill"><PackageCheck size={14} /> {bundle.driver ? 'Delivery included in total' : 'Self-pickup'}</span></div>
    <div className="detail-grid"><div><Suspense fallback={<div className="route-map loading-map">Loading route…</div>}><RouteMap route={bundle.route} /></Suspense>
      <p className="map-note">{bundle.route.warning || 'Driving route from Mapbox.'} Travel time excludes loading.</p>
      <div className="route-stats"><span><RouteIcon size={18} /><b>{bundle.distance_miles} mi</b> total distance</span><span><Clock3 size={18} /><b>{Math.ceil(bundle.duration_minutes)} min</b> driving</span><span><Users size={18} /><b>{bundle.seller_count}</b> pickup {bundle.seller_count === 1 ? 'stop' : 'stops'}</span></div>
      <div className="included-items"><h3>Your furniture</h3>{bundle.listings.map(i => <div className="included-item" key={i.id}><div className="item-thumb"><ProductImage category={i.category} src={i.image_url} title={i.title} /></div><div><b>{i.title}</b><span>{bundle.sellers.find(s => s.id === i.seller_id)?.name} · {i.condition_score}/10 · {i.item_size} size units</span></div><strong>{money(i.price)}</strong></div>)}</div>
    </div><div className="route-plan">
      <div className="driver-heading"><span className="avatar">{bundle.driver ? bundle.driver.name.split(' ').map(n => n[0]).join('') : <CarFront size={21} />}</span><div><h3>{bundle.driver ? `${bundle.driver.name.split(' ')[0]} brings it all together` : 'You’re in the driver’s seat'}</h3><p>{bundle.driver ? `${bundle.driver.vehicle_type?.toUpperCase()} · ${bundle.total_size} of ${bundle.driver.vehicle_capacity} capacity units` : 'Start and finish at your place'}</p></div></div>
      <ol className="stop-list">{bundle.route.stops.map((stop, index) => <li key={index}><span className={`stop-number ${stop.kind}`}>{index + 1}</span><div><b>{stop.name}{index === 0 ? ' · Start' : index === bundle.route.stops.length - 1 ? ' · Finish' : ''}</b><p>{stop.location.label || `${stop.location.lat.toFixed(4)}, ${stop.location.lng.toFixed(4)}`}</p>{stop.listing_ids.length > 0 && <small>{bundle.listings.filter(i => stop.listing_ids.includes(i.id)).map(i => categoryNames[i.category]).join(' + ')}</small>}</div></li>)}</ol>
      <div className="checkout-summary"><span>Furniture <b>{money(bundle.item_total)}</b></span><span>{bundle.driver ? 'Driver reward / delivery fee' : 'Self-pickup fee'} <b>{money(bundle.delivery_fee)}</b></span><span className="checkout-total">Your total <b>{money(bundle.total)}</b></span></div>
      {bundle.driver && <p className="fee-note">Delivery: $5 + $1 per mile + $2 per additional seller stop.</p>}
      {error && <p role="alert" className="error-message">{error}</p>}
      {order ? <div className="success-message" role="status"><PackageCheck size={22} /><div><b>Your bundle is reserved.</b><p>{bundle.driver ? `The pickup plan is now in ${bundle.driver.name.split(' ')[0]}’s seller dashboard.` : 'Your pickup plan is ready above.'} Demo reservation {order.id.slice(0, 8)}.</p></div></div> : <button className="primary full" onClick={onCheckout} disabled={pending}>{pending ? 'Reserving your furniture…' : 'Choose this bundle'} <ArrowRight size={18} /></button>}
      <p className="fine-print">Demo reservation only. No payment is collected.</p>
    </div></div>
  </section>
}

export default function App() {
  const [mode, setMode] = useState<'buyer' | 'seller'>('buyer')
  const [selected, setSelected] = useState<Category[]>(INITIAL_CATEGORIES)
  const [budget, setBudget] = useState('300')
  const [hasCar, setHasCar] = useState(false)
  const [place, setPlace] = useState('0')
  const [lat, setLat] = useState('40.443'), [lng, setLng] = useState('-79.943')
  const [radius, setRadius] = useState('25')
  const [result, setResult] = useState<BundleResponse | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false), [error, setError] = useState('')
  const [checkoutLoading, setCheckoutLoading] = useState(false), [checkoutError, setCheckoutError] = useState('')
  const [order, setOrder] = useState<Order | null>(null)
  const [health, setHealth] = useState<{ storage: string; routing: string } | null>(null)
  const detailRef = useRef<HTMLDivElement>(null), resultsRef = useRef<HTMLDivElement>(null)
  useEffect(() => { let alive = true; api<{ storage: string; routing: string }>('/health').then(h => { if (alive) setHealth(h) }).catch(() => {}); return () => { alive = false } }, [])
  const bundle = result?.bundles.find(b => b.id === activeId)
  async function generate(e: React.FormEvent) {
    e.preventDefault()
    if (!selected.length) { setError('Choose at least one furniture category.'); return }
    setLoading(true); setError(''); setCheckoutError(''); setOrder(null); setActiveId(null); setResult(null)
    try {
      const location = place === 'custom' ? { lat: Number(lat), lng: Number(lng), label: 'Your location' } : { ...places[Number(place)], label: places[Number(place)].name }
      const { lat: latitude, lng: longitude, label } = location
      const data = await post<BundleResponse>('/bundles/generate', { categories: selected, budget, buyer_has_car: hasCar, buyer_location: { lat: latitude, lng: longitude, label }, radius_miles: Number(radius) })
      setResult(data)
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    } catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  }
  function choose(b: Bundle) { setActiveId(b.id); setCheckoutError(''); setOrder(null); setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30) }
  async function checkout() {
    if (!bundle) return
    setCheckoutLoading(true); setCheckoutError('')
    try { setOrder(await post<Order>(`/bundles/${bundle.id}/checkout`)) } catch (e) { setCheckoutError((e as Error).message) } finally { setCheckoutLoading(false) }
  }
  return <>
    <header className="site-header"><a className="brand" href="/" aria-label="SnackOverflow home"><span className="brand-symbol"><Sofa size={23} strokeWidth={1.8} /></span>SnackOverflow<span className="brand-dot">.</span></a><nav className="mode-switch" aria-label="Marketplace mode"><button onClick={() => setMode('buyer')} aria-pressed={mode === 'buyer'} className={mode === 'buyer' ? 'active' : ''}>Find furniture</button><button onClick={() => setMode('seller')} aria-pressed={mode === 'seller'} className={mode === 'seller' ? 'active' : ''}>Sell furniture</button></nav><span className="header-location"><MapPin size={15} /> Pittsburgh, PA <span className="demo-tag">DEMO</span></span></header>
    {mode === 'seller' ? <Suspense fallback={<main className="page-shell"><p role="status">Loading seller dashboard…</p></main>}><SellerView /></Suspense> : <main className="page-shell">
      <section className="hero"><div><p className="eyebrow"><span className="little-star">✳</span> A FRESH START, SECONDHAND.</p><h1>Your new place.<br /><em>Already coming together.</em></h1><p className="hero-copy">Tell us what you need. We’ll find the furniture,<br className="desktop-br" /> fit your budget, and work out the pickup.</p></div><div className="hero-note"><span className="circular-leaf"><Leaf size={22} /></span><span>Less searching.<br />More settling in.</span><svg width="72" height="51" viewBox="0 0 72 51" aria-hidden="true"><path d="M7 5C55 1 77 33 34 41m0 0 11-12m-11 12 17 4" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg></div></section>
      <div className="workspace-grid"><aside className="requirements"><form onSubmit={generate}>
        <div className="form-heading"><h2>Make yourself at home.</h2><SlidersHorizontal size={19} /></div><p className="muted">A few details. A whole room sorted.</p>
        <fieldset className="category-field"><legend><span className="step-number">01</span> What do you need?</legend><div className="category-grid">{categories.map(c => <button key={c} className={`category-choice ${selected.includes(c) ? 'selected' : ''}`} type="button" aria-pressed={selected.includes(c)} onClick={() => setSelected(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])}><img src={`/images/${c}.svg`} alt="" /><span>{categoryNames[c]}</span>{selected.includes(c) && <Check className="category-check" size={12} />}</button>)}</div></fieldset>
        <fieldset><legend><span className="step-number">02</span> Your furniture budget</legend><div className="budget-input"><span>$</span><input aria-label="Furniture budget" type="number" min="1" max="100000" step="0.01" value={budget} onChange={e => setBudget(e.target.value)} required /><span>USD</span></div><p className="field-hint">Delivery is calculated separately.</p></fieldset>
        <fieldset><legend><span className="step-number">03</span> Where’s your new place?</legend><label className="select-location"><MapPin size={16} /><select aria-label="Buyer location" value={place} onChange={e => setPlace(e.target.value)}>{places.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}<option value="custom">Enter coordinates</option></select><ChevronDown size={14} /></label>{place === 'custom' && <div className="field-row coordinate-inputs"><label>Latitude<input type="number" step="any" min="-90" max="90" value={lat} onChange={e => setLat(e.target.value)} required /></label><label>Longitude<input type="number" step="any" min="-180" max="180" value={lng} onChange={e => setLng(e.target.value)} required /></label></div>}</fieldset>
        <fieldset><legend><span className="step-number">04</span> How will it get there?</legend><div className="transport-toggle"><button type="button" className={!hasCar ? 'selected' : ''} aria-pressed={!hasCar} onClick={() => setHasCar(false)}><Truck size={18} /><span>Bring it to me<small>I don’t have a car</small></span>{!hasCar && <Check size={14} />}</button><button type="button" className={hasCar ? 'selected' : ''} aria-pressed={hasCar} onClick={() => setHasCar(true)}><CarFront size={18} /><span>I’ll pick it up<small>I have a car</small></span>{hasCar && <Check size={14} />}</button></div>{hasCar && <p className="field-hint">For this demo, you arrange a vehicle that fits all selected items.</p>}</fieldset>
        <details className="search-options"><summary>Search area <Plus size={13} /></summary><label>Within {radius} miles<input aria-label="Search radius" type="range" min="5" max="100" step="5" value={radius} onChange={e => setRadius(e.target.value)} /></label></details>
        {error && <p role="alert" className="error-message">{error}</p>}<button type="submit" className="primary full" disabled={loading}>{loading ? <><span className="spinner" /> Finding your furniture…</> : <>Build my bundle <ArrowRight size={18} /></>}</button><p className="form-footnote"><Check size={12} /> Budget checked. Transport worked out.</p>
      </form></aside>
      <div className="results-area" ref={resultsRef} aria-live="polite" aria-busy={loading}>
        {loading ? <div className="loading-state"><span className="large-spinner" /><p className="eyebrow">BRINGING IT TOGETHER</p><h2>Finding a bundle that fits.</h2><p>Checking furniture, drivers, and pickup routes.</p></div> : result ? <>
          <div className="results-heading"><div><p className="eyebrow">YOUR PLACE, YOUR POSSIBILITIES</p><h2>{result.bundles.length ? `${result.bundles.length} ways to settle in.` : 'Let’s try a different fit.'}</h2></div>{result.bundles.length > 0 && <span className="results-check"><Check size={14} /> All furniture within budget</span>}</div>
          {result.bundles.length ? <div className="bundle-grid">{result.bundles.map((b, i) => <BundleCard key={b.id} bundle={b} index={i} active={b.id === activeId} choose={() => choose(b)} />)}</div> : <div className="empty-results"><Armchair size={40} strokeWidth={1} /><h3>No complete bundle just yet.</h3><p>{result.message}</p><p>Adjust your requirements on the left and try again.</p></div>}
          <details className="optimization-details"><summary>How these bundles were chosen <ChevronDown size={14} /></summary><p>We considered {result.diagnostics.candidate_count} relevant listings and {result.diagnostics.possible_combinations.toLocaleString()} possible combinations, then routed up to {result.diagnostics.candidate_bundle_limit} candidate bundles.</p><p>Each option meets: {result.diagnostics.constraints.join(', ')}. Ranking balances condition, price, sellers, distance, and delivery cost.</p>{result.diagnostics.combination_checks && <div className="constraint-audit"><b>{result.diagnostics.combination_checks.feasible_before_routing} of {result.diagnostics.combination_checks.examined} combinations pass the bundle constraints.</b><div className="filter-facts">{Object.entries(result.diagnostics.combination_checks.rejected).filter(([, count]) => count > 0).map(([reason, count]) => <span key={reason}>{count} rejected: {({ budget: 'over budget', no_driver: 'no seller driver', capacity: 'vehicle too small' } as Record<string, string>)[reason]}</span>)}</div><p>Each rejected combination is counted once, at its first failed constraint.</p></div>}<div className="filter-facts">{Object.entries(result.diagnostics.filtered_out).filter(([, value]) => value > 0).map(([key, value]) => <span key={key}>{value} excluded: {({ unavailable: 'unavailable / future', distance: 'outside area', price: 'over item budget', category: 'other categories', candidate_limit: 'candidate limit' } as Record<string, string>)[key] || key}</span>)}</div><p>This bounded search returns the best options it found; it does not guarantee the best combination across the entire marketplace.</p></details>
          <p className="results-note"><Leaf size={14} /> A second life for good furniture. A little less work for you.</p>
        </> : <section className="welcome-panel"><div className="welcome-top"><span className="pill">GOOD THINGS COME TOGETHER</span><span className="edition">PITTSBURGH / 001</span></div><div className="room-scene"><img src="/images/room.svg" alt="Illustration of a cozy apartment corner furnished with a desk, chair, TV, and oak TV stand" /><span className="room-label label-desk">A spot to focus <span>↙</span></span><span className="room-label label-home">A place to unwind <span>↗</span></span></div><div className="welcome-bottom"><h2>A room full of possibilities.<br /><em>Without the endless tabs.</em></h2><p>Good local finds, bundled with a way<br />to get them home.</p></div><div className="benefit-strip"><span><Tv size={17} /> Every piece you need</span><span><Truck size={17} /> A delivery that fits</span><span><RouteIcon size={17} /> One thought-out route</span></div></section>}
      </div></div>
      {bundle && <div ref={detailRef} className="detail-anchor"><BundleDetails key={bundle.id} bundle={bundle} onCheckout={checkout} pending={checkoutLoading} error={checkoutError} order={order} /></div>}
      <section className="how-it-works"><p className="eyebrow">FROM EMPTY ROOM TO YOUR ROOM</p><div><span><b>01</b> Tell us what’s missing.</span><ArrowRight size={18} /><span><b>02</b> Pick your favorite bundle.</span><ArrowRight size={18} /><span><b>03</b> Get the whole pickup plan.</span></div></section>
    </main>}
    <footer className="site-footer"><span><Leaf size={14} /> Good furniture deserves another chapter.</span><span>Hackathon demo · Fictional listings{health?.storage === 'local_demo' ? ' · Saved locally' : ''}</span></footer>
  </>
}
