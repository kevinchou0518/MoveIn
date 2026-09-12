import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ArrowRight, Armchair, CarFront, Check, ChevronDown, Leaf, Plus, Route as RouteIcon, Sofa, Truck, Tv } from 'lucide-react'
import { api, post } from './api'
import { rankingNames } from './types'
import type { BundleResponse, Category, Location, BuyerRequest, Ranking } from './types'
import LocationPicker, { demoPlaces } from './LocationPicker'
const SellerView = lazy(() => import('./SellerView'))
import { BundleCard } from './BundleDetails'
import BundlePage from './BundlePage'
import BuyerAssistant from './BuyerAssistant'
import { usePath, navigate } from './navigation'
import BuyerCategorySelect from './BuyerCategorySelect'
import { readPreferences, readSearch, saveSearch } from './searchSession'
import { LoginRequired, useSession } from './Auth'
import { OrderHistory, OrderPage } from './Orders'
import AccountPage from './AccountPage'
const INITIAL_CATEGORIES: Category[] = ['tv', 'tv_stand', 'desk', 'chair']


export default function App() {
  const session = useSession()
  const path=usePath()
  const mode=path.startsWith('/seller')?'seller':'buyer'
  const activeSection = path.startsWith('/account') ? 'profile' : path === '/buyer/orders' || path.startsWith('/orders/') ? 'orders' : mode === 'seller' ? 'seller' : 'buyer'
  const initial=useRef(readPreferences()).current
  const [selected, setSelected] = useState<Category[]>(initial.categories || INITIAL_CATEGORIES)
  const [budget, setBudget] = useState(String(initial.budget || '300'))
  const [hasCar, setHasCar] = useState(initial.buyer_has_car ?? false)
  const [buyerLocation, setBuyerLocation] = useState<Location | null>(initial.buyer_location || demoPlaces[0])
  const [radius, setRadius] = useState(String(initial.radius_miles || 25))
  const [locationDraft,setLocationDraft]=useState('')
  const [ranking,setRanking]=useState<Ranking>(initial.ranking || 'balanced')
  const [result, setResult] = useState<BundleResponse | null>(null)
  const [loading, setLoading] = useState(false), [error, setError] = useState('')
  const [health, setHealth] = useState<{ storage: string; routing: string } | null>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  useEffect(() => { let alive = true; api<{ storage: string; routing: string }>('/health').then(h => { if (alive) setHealth(h) }).catch(() => {}); return () => { alive = false } }, [])
  const requestVersion=useRef(0)
  const [retry,setRetry]=useState(0)
  const [resultPath,setResultPath]=useState('')
  const isResults=path.startsWith('/buyer/results')
  useEffect(()=>{if(!isResults){document.querySelector<HTMLElement>('main h1, main h2')?.focus(); window.scrollTo({top:0,behavior:'instant'})}},[path,isResults])
  useEffect(()=>{try{if(buyerLocation)window.sessionStorage.setItem('buyer-preferences',JSON.stringify({categories:selected,budget,buyer_has_car:hasCar,buyer_location:buyerLocation,radius_miles:Number(radius),ranking}))}catch{/* Storage is optional. */}},[selected,budget,hasCar,buyerLocation,radius,ranking])
  useEffect(()=>{
    const version=++requestVersion.current
    setResult(null)
    if(!isResults || !session.authenticated){setLoading(false);return}
    const request=readSearch(path)
    if(!request){setError('This search could not be restored. Review your preferences and build a new bundle.');navigate('/buyer',true);return}
    setSelected(request.categories); setBudget(String(request.budget)); setHasCar(request.buyer_has_car); setBuyerLocation(request.buyer_location); setRadius(String(request.radius_miles)); setRanking(request.ranking || 'balanced')
    setLocationDraft(''); setLoading(true); setError(''); setResultPath(path)
    const frame=window.requestAnimationFrame(()=>{
      resultsRef.current?.focus({preventScroll:true})
      resultsRef.current?.scrollIntoView({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'})
    })
    post<BundleResponse>('/bundles/generate',request).then(data=>{if(version===requestVersion.current)setResult(data)})
      .catch(e=>{if(version===requestVersion.current)setError(e.message)})
      .finally(()=>{if(version===requestVersion.current)setLoading(false)})
    return()=>{requestVersion.current++;window.cancelAnimationFrame(frame)}
  },[path,isResults,retry,session.authenticated])
  function runSearch(request:BuyerRequest) { navigate(saveSearch(request)) }
  async function generate(e:React.FormEvent) {
    e.preventDefault()
    if(!selected.length){setError('Choose at least one category.');return}
    if(!buyerLocation){setError('Search and select your location.');return}
    await runSearch({categories:selected,budget,buyer_has_car:hasCar,buyer_location:buyerLocation,radius_miles:Number(radius),ranking})
  }
  return <>
    <header className="site-header"><a className="brand" href="/" aria-label="MoveIn home"><span className="brand-symbol"><Sofa size={23} strokeWidth={1.8} /></span>MoveIn<span className="brand-dot">.</span></a><nav className="mode-switch" aria-label="Marketplace navigation">{[{id:'buyer',label:'Find furniture',url:'/buyer'},{id:'orders',label:'My orders',url:'/buyer/orders'},{id:'seller',label:'Sell furniture',url:'/seller'},{id:'profile',label:'Profile',url:'/account'}].map(item=><button key={item.id} onClick={()=>navigate(item.url)} aria-current={activeSection===item.id?'page':undefined} aria-pressed={activeSection===item.id} className={activeSection===item.id?'active':''}>{item.label}</button>)}</nav></header>
    {!session.authenticated && (isResults || path.startsWith('/bundles/') || path.startsWith('/orders/') || mode === 'seller' || path === '/buyer/orders' || path.startsWith('/account') || path.startsWith('/auth/')) ? <LoginRequired><></></LoginRequired> : path.startsWith('/account') ? <AccountPage /> : path.startsWith('/orders/') || /^\/seller\/[^/]+\/orders\/[^/]+/.test(path) ? <OrderPage key={path} path={path} onFindAnother={runSearch} /> : path === '/buyer/orders' ? <main className="page-shell"><OrderHistory /></main> : path.startsWith('/bundles/') ? <BundlePage key={path} path={path} onFindAnother={runSearch} /> : mode === 'seller' ? <Suspense fallback={<main className="page-shell"><p role="status">Loading seller dashboard…</p></main>}><SellerView key={path} /></Suspense> : <main className="page-shell page-transition">
      <header className="buyer-page-heading"><h1 tabIndex={-1}>Find furniture</h1></header>
      <div className="workspace-grid"><aside className="requirements"><form onSubmit={generate}>
        <BuyerAssistant onApply={draft=>{if(draft.categories)setSelected(draft.categories);if(draft.budget!=null)setBudget(String(draft.budget));if(draft.buyer_has_car!=null)setHasCar(draft.buyer_has_car);if(draft.ranking)setRanking(draft.ranking);if(draft.buyer_location){setBuyerLocation(draft.buyer_location);setLocationDraft('')}else if(draft.location_text){setBuyerLocation(null);setLocationDraft(draft.location_text)}}} />
        <BuyerCategorySelect value={selected} onChange={setSelected} />
        <fieldset><legend><span className="step-number">02</span> Your furniture budget</legend><div className="budget-input"><span>$</span><input aria-label="Furniture budget" type="number" min="1" max="100000" step="0.01" value={budget} onChange={e => setBudget(e.target.value)} required /><span>USD</span></div><p className="field-hint">Delivery is calculated separately.</p></fieldset>
        <fieldset><legend><span className="step-number">03</span> Where’s your new place?</legend><LocationPicker key={locationDraft} initialQuery={locationDraft} label="Buyer location" value={buyerLocation} onChange={setBuyerLocation} /></fieldset>
        <fieldset><legend><span className="step-number">04</span> How will it get there?</legend><div className="transport-toggle"><button type="button" className={!hasCar ? 'selected' : ''} aria-pressed={!hasCar} onClick={() => setHasCar(false)}><Truck size={18} /><span>Bring it to me<small>I don’t have a car</small></span>{!hasCar && <Check size={14} />}</button><button type="button" className={hasCar ? 'selected' : ''} aria-pressed={hasCar} onClick={() => setHasCar(true)}><CarFront size={18} /><span>I’ll pick it up<small>I have a car</small></span>{hasCar && <Check size={14} />}</button></div>{hasCar && <p className="field-hint">For this demo, you arrange a vehicle that fits all selected items.</p>}</fieldset>
        <label className="ranking-picker">What matters most?<select value={ranking} onChange={e=>setRanking(e.target.value as Ranking)}>{Object.entries(rankingNames).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
        <details className="search-options"><summary>Search area <Plus size={13} /></summary><label>Within {radius} miles<input aria-label="Search radius" type="range" min="5" max="100" step="5" value={radius} onChange={e => setRadius(e.target.value)} /></label></details>
        {error && <p role="alert" className="error-message">{error}</p>}<button type="submit" className="primary full" disabled={loading}>{loading ? <><span className="spinner" /> Finding your furniture…</> : <>Build my bundle <ArrowRight size={18} /></>}</button><p className="form-footnote"><Check size={12} /> Budget checked. Transport worked out.</p>
      </form></aside>
      <div className="results-area" ref={resultsRef} tabIndex={-1} role="region" aria-label="Bundle results" aria-live="polite" aria-busy={loading}>
        {isResults&&(loading||resultPath!==path) ? <div className="loading-state"><span className="large-spinner" /><p className="eyebrow">BRINGING IT TOGETHER</p><h2>Finding a bundle that fits.</h2><p>Checking furniture, drivers, and pickup routes.</p></div> : isResults&&error ? <div className="empty-results"><h2>Couldn’t load your bundles.</h2><p role="alert">{error}</p><button className="primary" onClick={()=>setRetry(n=>n+1)}>Retry search</button></div> : isResults&&result ? <>
          <div className="results-heading"><div><p className="eyebrow">YOUR PLACE, YOUR POSSIBILITIES</p><h2>{result.bundles.length ? `${result.bundles.length} ways to settle in.` : 'Let’s try a different fit.'}</h2></div>{result.bundles.length > 0 && <span className="results-check"><Check size={14} /> All furniture within budget</span>}</div>
          {result.bundles.length ? <div className="bundle-grid">{result.bundles.map((b, i) => <BundleCard key={b.id} bundle={b} index={i} active={false} choose={() => navigate(`/bundles/${b.id}`)} />)}</div> : <div className="empty-results"><Armchair size={40} strokeWidth={1} /><h3>No complete bundle just yet.</h3><p>{result.message}</p><p>Adjust your requirements on the left and try again.</p></div>}
          <details className="optimization-details"><summary>How these bundles were chosen <ChevronDown size={14} /></summary><p>We considered {result.diagnostics.candidate_count} relevant listings and {result.diagnostics.possible_combinations.toLocaleString()} possible combinations, then routed up to {result.diagnostics.candidate_bundle_limit} candidate bundles.</p><p>Each option meets: {result.diagnostics.constraints.join(', ')}. Ranking balances condition, price, sellers, distance, and delivery cost.</p>{result.diagnostics.combination_checks && <div className="constraint-audit"><b>{result.diagnostics.combination_checks.feasible_before_routing} of {result.diagnostics.combination_checks.examined} combinations pass the bundle constraints.</b><div className="filter-facts">{Object.entries(result.diagnostics.combination_checks.rejected).filter(([, count]) => count > 0).map(([reason, count]) => <span key={reason}>{count} rejected: {({ budget: 'over budget', no_driver: 'no seller driver', capacity: 'vehicle too small' } as Record<string, string>)[reason]}</span>)}</div><p>Each rejected combination is counted once, at its first failed constraint.</p></div>}<div className="filter-facts">{Object.entries(result.diagnostics.filtered_out).filter(([, value]) => value > 0).map(([key, value]) => <span key={key}>{value} excluded: {({ unavailable: 'unavailable / future', distance: 'outside area', price: 'over item budget', category: 'other categories', candidate_limit: 'candidate limit' } as Record<string, string>)[key] || key}</span>)}</div><p>This bounded search returns the best options it found; it does not guarantee the best combination across the entire marketplace.</p></details>
          <p className="results-note"><Leaf size={14} /> A second life for good furniture. A little less work for you.</p>
        </> : <section className="welcome-panel"><div className="welcome-top"><span className="pill">GOOD THINGS COME TOGETHER</span><span className="edition">PITTSBURGH / 001</span></div><div className="room-scene"><img src="/images/room.svg" alt="Illustration of a cozy apartment corner furnished with a desk, chair, TV, and oak TV stand" /><span className="room-label label-desk">A spot to focus <span>↙</span></span><span className="room-label label-home">A place to unwind <span>↗</span></span></div><div className="welcome-bottom"><h2>A room full of possibilities.<br /><em>Without the endless tabs.</em></h2><p>Good local finds, bundled with a way<br />to get them home.</p></div><div className="benefit-strip"><span><Tv size={17} /> Every piece you need</span><span><Truck size={17} /> A delivery that fits</span><span><RouteIcon size={17} /> One thought-out route</span></div></section>}
      </div></div>

      <section className="how-it-works"><p className="eyebrow">FROM EMPTY ROOM TO YOUR ROOM</p><div><span><b>01</b> Tell us what’s missing.</span><ArrowRight size={18} /><span><b>02</b> Pick your favorite bundle.</span><ArrowRight size={18} /><span><b>03</b> Get the whole pickup plan.</span></div></section>
    </main>}
    <footer className="site-footer"><span><Leaf size={14} /> Good furniture deserves another chapter.</span><span>Hackathon demo · Fictional listings{health?.storage === 'local_demo' ? ' · Saved locally' : ''}</span></footer>
  </>
}
