import { useEffect, useRef, useState } from 'react'
import { api, post, ApiError } from './api'
import { navigate } from './navigation'
import type { BuyerRequest, OrderView, OrderList } from './types'
import { money } from './types'
import { BundleDetails } from './BundleDetails'

export const statusName = (status: string) => ({reserved: 'Reserved', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled'}[status] || status)

export function OrderActions({ order, onUpdate, sellerId, onMutationStart, onMutationEnd }: { order: OrderView; onUpdate: (order: OrderView) => void; sellerId?: string; onMutationStart?: () => void; onMutationEnd?: () => void }) {
  const [action, setAction] = useState<string | null>(null), [reason, setReason] = useState(''), [pending, setPending] = useState(false), [error, setError] = useState('')
  const dialog = useRef<HTMLDialogElement>(null), submitting = useRef(false), alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => { if (!action) return; const previous = document.activeElement as HTMLElement; dialog.current?.showModal?.(); return () => { dialog.current?.close?.(); previous?.focus() } }, [action])
  const actionName = (a: string) => a === 'cancel' ? 'Cancel reservation' : a === 'complete' ? (order.bundle.transportation_mode === 'seller_delivery' ? 'Confirm delivery received' : 'Complete pickup') : order.bundle.transportation_mode === 'seller_delivery' ? 'Start delivery' : 'Start pickup'
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (submitting.current || !action) return
    submitting.current = true; setPending(true); setError(''); onMutationStart?.()
    try {
      const refreshed = await post<OrderView>(`/orders/${order.id}/${action}${sellerId ? `?seller_id=${encodeURIComponent(sellerId)}` : ''}`, action === 'cancel' ? {reason} : undefined)
      if (alive.current) { onUpdate(refreshed); setAction(null) }
    } catch (e) { if (alive.current) setError((e as Error).message) }
    finally { submitting.current = false; if (alive.current) { setPending(false); onMutationEnd?.() } }
  }
  return <><div className="dialog-actions">{order.allowed_actions?.map(a => <button key={a} className={a === 'cancel' ? 'secondary' : 'primary'} onClick={() => { setError(''); setReason(''); setAction(a) }}>{actionName(a)}</button>)}</div>{action && <dialog ref={dialog} className="confirmation-dialog" aria-labelledby="order-action-title" onCancel={e => { e.preventDefault(); if (!pending) setAction(null) }}><form onSubmit={submit}><h2 id="order-action-title">{actionName(action)}?</h2><p>{action === 'cancel' ? 'This cancels the entire bundle and releases its reserved furniture.' : action === 'start' ? 'Once started, this order can no longer be cancelled.' : 'Confirm that you have received every item. The order will be marked completed.'}</p>{action === 'cancel' && <label>Cancellation reason<textarea required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>}{error && <p role="alert" className="error-message">{error}</p>}<div className="dialog-actions"><button type="button" className="secondary" disabled={pending} onClick={() => setAction(null)}>Keep current status</button><button className="primary" disabled={pending || (action === 'cancel' && !reason.trim())}>{pending ? 'Updating…' : 'Confirm'}</button></div></form></dialog>}</>
}

export function OrderHistory({ sellerId, deliveries = false }: { sellerId?: string; deliveries?: boolean }) {
  const [status, setStatus] = useState(''), [offset, setOffset] = useState(0), [result, setResult] = useState<OrderList | null>(null), [error, setError] = useState(''), [retry, setRetry] = useState(0)
  useEffect(() => { const refresh = () => setRetry(n => n + 1); window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh) }, [])
  useEffect(() => {
    let alive = true; setResult(null); setError('')
    const base = sellerId ? `/sellers/${encodeURIComponent(sellerId)}/${deliveries ? 'deliveries' : 'orders'}` : '/orders'
    api<OrderList>(`${base}?limit=20&offset=${offset}${status ? `&status=${status}` : ''}`).then(r => { if (alive) setResult(r) }).catch(e => { if (alive) setError(e.message) })
    return () => { alive = false }
  }, [sellerId, deliveries, offset, status, retry])
  return <section className="order-history"><h1 tabIndex={-1}>{sellerId ? deliveries ? 'Your deliveries' : 'Orders with your furniture' : 'My orders'}</h1><label>Order status<select value={status} onChange={e => { setStatus(e.target.value); setOffset(0) }}><option value="">All orders</option>{['reserved','in_progress','completed','cancelled'].map(s => <option key={s} value={s}>{statusName(s)}</option>)}</select></label>{error ? <p role="alert">{error} <button className="secondary" onClick={() => setRetry(n => n + 1)}>Retry</button></p> : !result ? <p role="status">Loading orders…</p> : <>{!result.items.length && <div className="empty-results"><h2>No orders here yet</h2><p>{sellerId ? 'Orders involving your furniture will appear here.' : 'Your reservations and their history will appear here.'}</p>{!sellerId && <button className="primary" onClick={() => navigate('/buyer')}>Find furniture</button>}</div>}{result.items.map(order => <article key={order.id} className="order-card"><span className="pill">{statusName(order.status)}</span><h2>Order {order.id.slice(0,8)}</h2><p>{new Date(order.created_at).toLocaleString()}</p><p>{order.bundle.listings.map(i => i.title).join(' · ')}</p><strong>{money(order.viewer_role === 'seller' ? order.bundle.listings.reduce((n,i) => n + Number(i.price), 0) : order.bundle.total)}{order.viewer_role === 'seller' ? ' · your items' : ' total'}</strong><button className="secondary" onClick={() => navigate(sellerId ? `/seller/${sellerId}/orders/${order.id}` : `/orders/${order.id}`)}>View order</button></article>)}<div className="dialog-actions"><button className="secondary" disabled={!offset} onClick={() => setOffset(n => Math.max(0, n - 20))}>Previous</button><span>{result.total} orders</span><button className="secondary" disabled={offset + 20 >= result.total} onClick={() => setOffset(n => n + 20)}>Next</button></div></>}</section>
}

export function OrderPage({ path, onFindAnother }: { path: string; onFindAnother: (r: BuyerRequest) => void }) {
  const parts = path.split('?')[0].split('/'), sellerId = parts[1] === 'seller' ? parts[2] : undefined
  const id = sellerId ? parts[4] : parts[2], plan = parts.at(-1) === 'plan'
  const [order, setOrder] = useState<OrderView | null>(null), [error, setError] = useState(''), [retry, setRetry] = useState(0)
  useEffect(() => { const refresh = () => setRetry(n => n + 1); window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh) }, [])
  const requestVersion = useRef(0), mutationPending = useRef(false)
  useEffect(() => {
    if (mutationPending.current) return
    const version = ++requestVersion.current
    setError('')
    api<OrderView>(`/orders/${encodeURIComponent(id || '')}${sellerId ? `?seller_id=${encodeURIComponent(sellerId)}` : ''}`)
      .then(result => { if (version === requestVersion.current) setOrder(result) })
      .catch(e => {
        if (version !== requestVersion.current) return
        if (e instanceof ApiError && [401,403,404].includes(e.status)) setOrder(null)
        setError(e.message)
      })
    return () => { requestVersion.current++ }
  }, [id, sellerId, retry])
  function acceptUpdate(updated: OrderView) {
    requestVersion.current++
    setOrder(updated); setError('')
  }

  useEffect(() => { if (order) document.querySelector<HTMLElement>('main h1')?.focus() }, [!!order])
  const back = sellerId ? `/seller/${sellerId}/orders` : '/buyer/orders'
  return <main className="page-shell"><button className="text-button" onClick={() => navigate(back)}>← Back to {sellerId ? 'seller orders' : 'my orders'}</button>{error && <p role="alert">{order ? `Could not refresh this order. Showing the last confirmed status. ${error}` : error} <button className="secondary" onClick={() => setRetry(n => n + 1)}>Refresh order</button></p>}{!order ? !error && <p role="status">Loading your order…</p> : <><h1 tabIndex={-1}>{plan ? order.bundle.transportation_mode === 'seller_delivery' ? 'Your delivery plan' : 'Your pickup plan' : `Order ${order.id.slice(0,8)}`}</h1><p className="pill">{statusName(order.status)}</p><p>Reserved {new Date(order.created_at).toLocaleString()}</p>{order.cancellation_reason && <p>Cancellation reason: {order.cancellation_reason}</p>}<OrderActions key={order.id} order={order} sellerId={sellerId} onUpdate={acceptUpdate} onMutationStart={() => { mutationPending.current = true; requestVersion.current++ }} onMutationEnd={() => { mutationPending.current = false }} /><div className="dialog-actions">{!sellerId && order.viewer_role !== 'seller' && <><button className="secondary" onClick={() => navigate(plan ? `/orders/${order.id}` : `/orders/${order.id}/plan`)}>{plan ? 'View order details' : `View ${order.bundle.transportation_mode === 'seller_delivery' ? 'delivery' : 'pickup'} plan`}</button><button className="primary" onClick={() => order.bundle.request ? onFindAnother(order.bundle.request) : navigate('/buyer')}>Find another bundle</button></>}</div>{order.viewer_role === 'seller' ? <section><h2>Your pickup responsibilities</h2>{order.bundle.sellers.map(s => <p key={s.id}>{s.name} · {s.location.label}</p>)}{order.bundle.listings.map(i => <p key={i.id}>{i.title} · {money(Number(i.price))}</p>)}</section> : <BundleDetails bundle={order.bundle} order={order} pending={false} error="" onCheckout={() => {}} />}<section><h2>Status history</h2><ol>{order.history?.map((event, n) => <li key={n}>{statusName(event.status)} · {new Date(event.at).toLocaleString()}{event.reason && ` · ${event.reason}`}</li>)}</ol></section></>}</main>
}
