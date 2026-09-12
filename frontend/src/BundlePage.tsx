import { useEffect, useRef, useState } from 'react'
import { api, post, ApiError } from './api'
import type { Bundle, BundleResponse, BuyerRequest, Order } from './types'
import { money } from './types'
import { BundleDetails } from './BundleDetails'
import { navigate, backToResults } from './navigation'
import { OrderPage } from './Orders'

export function ConfirmationDialog({bundle,pending,error,onCancel,onConfirm,onRefresh}:{bundle:Bundle;pending:boolean;error:string;onCancel:()=>void;onConfirm:()=>void;onRefresh?:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null)
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null; const dialog=ref.current;dialog?.showModal?.();return()=>{dialog?.close?.();previous?.focus()}},[])
  return <dialog ref={ref} className="confirmation-dialog" aria-labelledby="confirm-title" onCancel={e=>{e.preventDefault();if(!pending)onCancel()}}><h2 id="confirm-title">Confirm your bundle</h2><p>{bundle.listings.length} items for {bundle.request?.buyer_location.label || 'your selected destination'}</p><ul>{bundle.listings.map(i=><li key={i.id}>{i.title} <b>{money(i.price)}</b></li>)}</ul><p>{bundle.driver?`Delivered by ${bundle.driver.name}`:'You will pick up these items.'}</p><div className="checkout-summary"><span>Furniture <b>{money(bundle.item_total)}</b></span><span>Delivery <b>{money(bundle.delivery_fee)}</b></span><span className="checkout-total">Total <b>{money(bundle.total)}</b></span></div><p className="fine-print">This reserves the items. No payment is collected.</p>{error&&<p className="error-message" role="alert">{error}</p>}<div className="dialog-actions"><button type="button" className="secondary" disabled={pending} onClick={onCancel}>Cancel</button>{onRefresh?<button className="primary" onClick={onRefresh}>Refresh bundle options</button>:<button className="primary" disabled={pending} onClick={onConfirm}>{pending?'Reserving…':'Confirm reservation'}</button>}</div></dialog>
}

export default function BundlePage({path,onFindAnother}:{path:string;onFindAnother:(request:BuyerRequest)=>void}) {
  return path.startsWith('/orders/') ? <OrderPage path={path} onFindAnother={onFindAnother} /> : <BundleReview key={path} path={path} onFindAnother={onFindAnother} />
}

function BundleReview({path,onFindAnother}:{path:string;onFindAnother:(request:BuyerRequest)=>void}) {
  const id=path.split('/')[2]?.split('?')[0]
  const [bundle,setBundle]=useState<Bundle|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[confirm,setConfirm]=useState(false),[pending,setPending]=useState(false),[status,setStatus]=useState(0)
  const [swaps,setSwaps]=useState<BundleResponse|null>(null),[swapPending,setSwapPending]=useState(false)
  const alive=useRef(true),submitting=useRef(false)
  useEffect(()=>{
    let active=true; alive.current=true
    api<Bundle>(`/bundles/${encodeURIComponent(id||'')}`).then(data=>{if(active)setBundle(data)}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)})
    return()=>{active=false;alive.current=false}
  },[id])
  useEffect(()=>{if(!loading)document.querySelector<HTMLElement>('main h1')?.focus()},[loading])
  function fresh(){if(bundle?.request)onFindAnother(bundle.request);else navigate('/buyer')}
  async function checkout(){if(!bundle||submitting.current)return;submitting.current=true;setPending(true);setError('');setStatus(0);try{const result=await post<Order>(`/bundles/${bundle.id}/checkout`);if(alive.current)navigate(`/orders/${result.id}`,true)}catch(e){if(alive.current){setError((e as Error).message);setStatus(e instanceof ApiError?e.status:0)}}finally{submitting.current=false;if(alive.current)setPending(false)}}
  async function swap(item:string){if(!bundle)return;setSwapPending(true);setError('');setSwaps(null);try{const result=await post<BundleResponse>(`/bundles/${bundle.id}/alternatives`,{listing_id:item});if(alive.current)setSwaps(result)}catch(e){if(alive.current)setError((e as Error).message)}finally{if(alive.current)setSwapPending(false)}}
  if(loading)return <main className="page-shell"><p role="status">Loading your plan…</p></main>
  if(!bundle)return <main className="page-shell"><h1 tabIndex={-1}>This plan is unavailable.</h1><p role="alert">{error}</p><button className="primary" onClick={()=>navigate('/buyer')}>Start a fresh search</button></main>
  return <main className="page-shell page-transition"><div className="page-navigation"><button className="text-button" onClick={()=>backToResults(bundle.request)}>← Back to results</button></div><h1 tabIndex={-1}>Review your bundle</h1><p className="muted">Check every item, compare swaps, and review the route before reserving.</p>
    {error&&!confirm&&<p role="alert" className="error-message">{error} <button className="text-button" onClick={fresh}>Refresh bundle options</button></p>}
    {bundle.order_id?<section className="ai-panel"><h2>This bundle has an existing order.</h2><button className="primary" onClick={()=>navigate(`/orders/${bundle.order_id}`)}>View reservation</button></section>:<BundleDetails bundle={bundle} order={null} pending={pending} error="" onCheckout={()=>{setError('');setStatus(0);setConfirm(true)}} onSwap={!swapPending?swap:undefined}/>}
    {swapPending&&<p role="status">Checking replacements, drivers, and routes…</p>}
    {swaps&&<section className="swap-panel"><h2>Replacement options</h2><p>{swaps.message}</p><div className="swap-grid">{swaps.bundles.map(b=>{const changed=b.listings.find(i=>!bundle.listings.some(old=>old.id===i.id));return <article key={b.id}><h3>{changed?.title}</h3>{changed?.image_url&&<img src={changed.image_url} alt={changed.title}/>}<p>Item: {money(changed?.price||0)} · Total: {money(b.total)}</p><p>{(b.total_difference||0)>=0?'+':'−'}{money(Math.abs(b.total_difference||0))} total change</p><p>{b.driver?`Driver: ${b.driver.name}`:'Self-pickup'} · {Math.ceil(b.duration_minutes)} min · {b.distance_miles} miles</p><button className="secondary" onClick={()=>navigate(`/bundles/${b.id}`)}>Use this replacement</button></article>})}</div></section>}
    {confirm&&<ConfirmationDialog bundle={bundle} pending={pending} error={error} onCancel={()=>setConfirm(false)} onConfirm={checkout} onRefresh={[404,409,410].includes(status)?()=>{setConfirm(false);fresh()}:undefined}/>}</main>
}
