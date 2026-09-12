import { lazy, Suspense } from 'react'
import { ArrowRight, CarFront, Clock3, PackageCheck, Route as RouteIcon, Sparkles, Truck, Users } from 'lucide-react'
import { money } from './types'
import type { Bundle, Order, Category } from './types'
import { categoryIcon, categoryLabel } from './catalog'
import { googleMapsUrl } from './routeLink'
const RouteMap=lazy(()=>import('./RouteMap'))
function MapsLink({ route }: { route: Bundle['route'] }) {
  const url = googleMapsUrl(route)
  return url ? <a className="map-link" href={url} target="_blank" rel="noopener noreferrer">Open in Google Maps ↗</a> : null
}
function ProductImage({ category, src, title }: { category: Category; src?: string; title: string }) {
  return <img src={src || categoryIcon(category)} alt={title} loading="lazy" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = categoryIcon(category) }} />
}

export function BundleCard({ bundle, index, active, choose }: { bundle: Bundle; index: number; active: boolean; choose: () => void }) {
  return <article className={`bundle-card ${active ? 'chosen' : ''}`}>
    <div className="bundle-card-heading"><span className={index === 0 ? 'pill recommended' : 'pill'}>{index === 0 ? <><Sparkles size={12} /> Best match</> : `Option 0${index + 1}`}</span><span className="condition">{bundle.condition_score}<span>/10 condition</span></span></div>
    <div className="product-grid">{bundle.listings.map(item => <div className={`product-shot ${item.category}`} key={item.id}><ProductImage category={item.category} src={item.image_url} title={item.title} /><span>{categoryLabel(item.category)}</span><b>{money(item.price)}</b></div>)}</div>
    <h3>{index === 0 ? 'Your fresh-start bundle' : index === 1 ? 'Another good fit' : 'One more possibility'}</h3>
    {bundle.ranking_reason && <p className="ranking-reason">{bundle.ranking_reason}</p>}<p className="bundle-summary">{bundle.listings.length} pieces · {bundle.seller_count} {bundle.seller_count === 1 ? 'seller' : 'sellers'} · Ready for a new home</p>
    <div className="transport-line">{bundle.driver ? <Truck size={15} /> : <CarFront size={15} />}<span>{bundle.driver ? `Delivered by ${bundle.driver.name.split(' ')[0]}` : 'Your pickup route'}</span></div>
    <div className="bundle-metrics"><span><Clock3 size={14} /> {Math.ceil(bundle.duration_minutes)} min</span><span><RouteIcon size={14} /> {bundle.distance_miles} mi</span><span>{bundle.route.source === 'estimated' ? 'Estimated' : 'Road route'}</span></div>
    <div className="price-breakdown"><span>Furniture <b>{money(bundle.item_total)}</b></span><span>{bundle.driver ? 'Delivery' : 'Pickup fee'} <b>{money(bundle.delivery_fee)}</b></span></div>
    <div className="bundle-total"><div><strong>{money(bundle.total)}</strong><small>total</small></div><button onClick={choose} className="view-button" aria-label={`View bundle ${index + 1}`}>{active ? 'Viewing' : 'View bundle'} <ArrowRight size={15} /></button></div>
  </article>
}

export function BundleDetails({ bundle, onCheckout, pending, error, order, onSwap }: { bundle: Bundle; onCheckout: () => void; pending: boolean; error: string; order: Order | null; onSwap?: (id:string)=>void }) {
  return <section className="bundle-detail" aria-labelledby="detail-title">
    <div className="section-heading"><div><p className="eyebrow">THE WHOLE PLAN</p><h2 id="detail-title">Good finds. One simple route.</h2></div><span className="pill"><PackageCheck size={14} /> {bundle.driver ? 'Delivery included in total' : 'Self-pickup'}</span></div>
    <div className="detail-grid"><div><Suspense fallback={<div className="route-map loading-map">Loading route…</div>}><RouteMap route={bundle.route} /></Suspense>
      <p className="map-note">{bundle.route.warning || 'Driving route from Mapbox.'} Travel time excludes loading.<MapsLink route={bundle.route} /></p>
      <div className="route-stats"><span><RouteIcon size={18} /><b>{bundle.distance_miles} mi</b> total distance</span><span><Clock3 size={18} /><b>{Math.ceil(bundle.duration_minutes)} min</b> driving</span><span><Users size={18} /><b>{bundle.seller_count}</b> pickup {bundle.seller_count === 1 ? 'stop' : 'stops'}</span></div>
      <div className="included-items"><h3>Your furniture</h3>{bundle.listings.map(i => <div className="included-item" key={i.id}><div className="item-thumb"><ProductImage category={i.category} src={i.image_url} title={i.title} /></div><div><b>{i.title}</b><span>{bundle.sellers.find(s => s.id === i.seller_id)?.name} · {i.condition_score}/10 · {i.item_size} size units</span></div><strong>{money(i.price)}</strong>{onSwap && !order && <button className="text-button" onClick={()=>onSwap(i.id)}>Swap item<span className="sr-only"> {i.title}</span></button>}</div>)}</div>
    </div><div className="route-plan">
      <div className="driver-heading"><span className="avatar">{bundle.driver ? bundle.driver.name.split(' ').map(n => n[0]).join('') : <CarFront size={21} />}</span><div><h3>{bundle.driver ? `${bundle.driver.name.split(' ')[0]} brings it all together` : 'You’re in the driver’s seat'}</h3><p>{bundle.driver ? `${bundle.driver.vehicle_type?.toUpperCase()} · ${bundle.total_size} of ${bundle.driver.vehicle_capacity} capacity units` : 'Start and finish at your place'}</p></div></div>
      <ol className="stop-list">{bundle.route.stops.map((stop, index) => <li key={index}><span className={`stop-number ${stop.kind}`}>{index + 1}</span><div><b>{stop.name}{index === 0 ? ' · Start' : index === bundle.route.stops.length - 1 ? ' · Finish' : ''}</b><p>{stop.location.label || `${stop.location.lat.toFixed(4)}, ${stop.location.lng.toFixed(4)}`}</p>{stop.listing_ids.length > 0 && <small>{bundle.listings.filter(i => stop.listing_ids.includes(i.id)).map(i => categoryLabel(i.category)).join(' + ')}</small>}</div></li>)}</ol>
      <div className="checkout-summary"><span>Furniture <b>{money(bundle.item_total)}</b></span><span>{bundle.driver ? 'Driver reward / delivery fee' : 'Self-pickup fee'} <b>{money(bundle.delivery_fee)}</b></span><span className="checkout-total">Your total <b>{money(bundle.total)}</b></span></div>
      {bundle.driver && <p className="fee-note">Delivery: $5 + $1 per mile + $2 per additional seller stop.</p>}
      {error && <p role="alert" className="error-message">{error}</p>}
      {order ? <div className="success-message" role="status"><PackageCheck size={22} /><div><b>Order {order.status.replace('_', ' ')}.</b><p>{order.status === 'cancelled' ? 'This is a historical plan. These items are no longer held by this reservation.' : order.status === 'completed' ? 'All items have been received.' : 'Your route and pickup details are shown above.'}</p></div></div> : <button className="primary full" onClick={onCheckout} disabled={pending}>{pending ? 'Reserving your furniture…' : 'Choose this bundle'} <ArrowRight size={18} /></button>}
      <p className="fine-print">Demo reservation only. No payment is collected.</p>
    </div></div>
  </section>
}
