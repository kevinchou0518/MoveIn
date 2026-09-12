import { JSDOM } from 'jsdom'
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/bundles/b1' })
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement })
dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
const { render, screen, fireEvent, waitFor, cleanup } = await import('@testing-library/react')
const { default: React } = await import('react')
const { default: BundlePage } = await import('../src/BundlePage')
const { default: BuyerAssistant } = await import('../src/BuyerAssistant')
const { default: PriceResearch } = await import('../src/PriceResearch')
const { default: CategoryPicker } = await import('../src/CategoryPicker')
import type { Bundle, BuyerRequest } from '../src/types'
afterEach(cleanup)
const location = { lat: 40.44, lng: -79.94, label: 'Oakland' }
const request: BuyerRequest = { categories: ['chair'], budget: 100, buyer_location: location, buyer_has_car: true, radius_miles: 25, ranking: 'lowest_cost' }
const bundle: Bundle = { id: 'b1', request, listings: [{ id: 'c1', seller_id: 's1', title: 'Wooden chair', category: 'chair', description: '', price: 30, condition: 'good', condition_score: 8, item_size: 1, image_url: '', location, available: true, available_date: '2020-01-01' }], sellers: [{ id: 's1', name: 'Sam', location, can_drive: false, vehicle_type: null, vehicle_capacity: 0 }], driver: null, item_total: 30, total: 30, condition_score: 8, seller_count: 1, total_size: 1, transportation_mode: 'buyer_pickup', delivery_fee: 0, distance_miles: 1, duration_minutes: 3, final_score: 1, selection_score: 1, route: { source: 'estimated', geometry_source: 'schematic', warning: 'Estimate', distance_miles: 1, duration_minutes: 3, geometry: [[-79.94, 40.44]], stops: [{ kind: 'buyer', seller_id: null, name: 'Your place', location, listing_ids: [] }] } }

test('cancel sends no checkout; repeated confirmation submits once and navigates to receipt', async () => {
  let posts = 0, finish: (r: Response) => void = () => {}
  globalThis.fetch = (async (_url, options) => { if (options?.method === 'POST') { posts++; return new Promise<Response>(r => { finish = r }) } return Response.json(bundle) }) as typeof fetch
  render(<BundlePage path="/bundles/b1" onFindAnother={() => {}} />)
  const choose = await screen.findByRole('button', { name: 'Choose this bundle' })
  fireEvent.click(choose)
  fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }))
  assert.equal(posts, 0); assert.equal(screen.queryByRole('dialog'), null)
  fireEvent.click(choose)
  const confirm = screen.getByRole('button', { name: 'Confirm reservation' })
  fireEvent.click(confirm); fireEvent.click(confirm)
  assert.equal(posts, 1)
  finish(Response.json({ id: 'o1', bundle_id: 'b1', bundle, status: 'reserved', created_at: new Date().toISOString() }))
  await waitFor(() => assert.equal(window.location.pathname, '/orders/o1'))
})

test('expired confirmation offers a fresh search with identical preferences', async () => {
  let fresh: BuyerRequest | undefined
  globalThis.fetch = (async (_url, options) => options?.method === 'POST' ? Response.json({ detail: 'Bundle expired' }, { status: 410 }) : Response.json(bundle)) as typeof fetch
  render(<BundlePage path="/bundles/b1" onFindAnother={r => { fresh = r }} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Choose this bundle' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm reservation' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Refresh bundle options' }))
  assert.deepEqual(fresh, request)
})

test('receipt reload shows persisted order and Find another retains preferences', async () => {
  let fresh: BuyerRequest | undefined
  globalThis.fetch = (async () => Response.json({ id: 'o1', bundle_id: 'b1', bundle, status: 'reserved', created_at: new Date().toISOString() })) as typeof fetch
  render(<BundlePage path="/orders/o1" onFindAnother={r => { fresh = r }} />)
  await screen.findByRole('heading', { name: 'Order o1' })
  assert.equal(screen.queryByRole('button', { name: 'Choose this bundle' }), null)
  fireEvent.click(screen.getByRole('button', { name: 'Find another bundle' }))
  assert.deepEqual(fresh, request)
})

test('buyer AI applies only checked fields and requires address review', async () => {
  let accepted: unknown
  globalThis.fetch = (async () => Response.json({ categories: ['chair'], budget: 100, buyer_has_car: false, location_text: 'Oakland', ranking: null, explanations: [] })) as typeof fetch
  render(<BuyerAssistant onApply={d => { accepted = d }} />)
  fireEvent.click(screen.getByText('Describe what you need'))
  fireEvent.change(screen.getByLabelText('Your shopping request'), { target: { value: 'Chair for $100 in Oakland' } })
  fireEvent.click(screen.getByRole('button', { name: 'Review suggested requirements' }))
  fireEvent.click(await screen.findByLabelText(/Furniture budget/))
  fireEvent.click(screen.getByRole('button', { name: 'Apply selected requirements' }))
  assert.deepEqual(accepted, { categories: null, budget: 100, buyer_has_car: null, location_text: null, ranking: null, explanations: [] })
})

test('price research needs explicit apply and field edits invalidate results', async () => {
  let price = ''
  globalThis.fetch = (async () => Response.json({ comparables: [], price_min: 20, price_max: 40, summary: 'Used asking prices', researched_at: new Date().toISOString() })) as typeof fetch
  const view = render(<PriceResearch title="Chair" category="chair" condition="good" imageUrl="" onApply={p => { price = p }} />)
  fireEvent.click(screen.getByText('Research comparable prices'))
  fireEvent.click(screen.getByRole('button', { name: 'Search comparable prices' }))
  await screen.findByRole('button', { name: 'Apply researched price' })
  assert.equal(price, '')
  fireEvent.change(screen.getByLabelText('Price to apply ($)'), { target: { value: '25' } })
  fireEvent.click(screen.getByRole('button', { name: 'Apply researched price' }))
  assert.equal(price, '25.00')
  view.rerender(<PriceResearch title="Different chair" category="chair" condition="good" imageUrl="" onApply={p => { price = p }} />)
  assert.equal(screen.queryByRole('button', { name: 'Apply researched price' }), null)
})

test('seller-created category becomes selectable', async () => {
  let chosen = '', created = false
  globalThis.fetch = (async (_url, options) => {
    if (options?.method === 'POST') { created = true; return Response.json({ id: 'cat_bookcase', name: 'Bookcase' }) }
    return Response.json([{ id: 'chair', name: 'Chair' }, ...(created ? [{ id: 'cat_bookcase', name: 'Bookcase' }] : [])])
  }) as typeof fetch
  render(<CategoryPicker value="chair" onChange={c => { chosen = c }} />)
  fireEvent.click(screen.getByText('Find or add a category'))
  fireEvent.change(screen.getByLabelText('Category name'), { target: { value: 'Bookcase' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create and select category' }))
  await waitFor(() => assert.equal(chosen, 'cat_bookcase'))
  assert.ok(screen.getByRole('option', { name: 'Bookcase' }))
})
