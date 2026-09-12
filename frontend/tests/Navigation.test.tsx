import { JSDOM } from 'jsdom'
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/buyer', pretendToBeVisual: true })
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement })
window.scrollTo = () => {}
let scrolled = ''
dom.window.HTMLElement.prototype.scrollIntoView = function () { scrolled = this.getAttribute('aria-label') || '' }
const { render, screen, fireEvent, waitFor, cleanup, act } = await import('@testing-library/react')
const { default: React } = await import('react')
const { default: Marketplace } = await import('../src/App')
const { AuthContext } = await import('../src/Auth')
function App() { return <AuthContext.Provider value={{configured:true,authenticated:true,loading:false,login:()=>{},logout:()=>{}}}><Marketplace /></AuthContext.Provider> }
const { saveSearch, readSearch } = await import('../src/searchSession')
const { navigate, backToResults } = await import('../src/navigation')
const request = { categories: ['chair'], budget: 100, buyer_has_car: true, buyer_location: { lat: 40.44, lng: -79.94, label: 'Oakland' }, radius_miles: 25, ranking: 'best_condition' as const }
const response = { bundles: [], message: 'Nothing available', diagnostics: { candidate_count: 0, possible_combinations: 0, candidate_bundle_limit: 10, constraints: [], filtered_out: {}, combination_checks: null } }
afterEach(() => { cleanup(); window.sessionStorage.clear(); window.history.replaceState(null, '', '/buyer') })
function mockSearch(handler: (body: unknown) => Promise<Response>) {
  globalThis.fetch = (async (url, options) => {
    if (String(url).endsWith('/bundles/generate')) return handler(JSON.parse(String(options?.body)))
    if (String(url).endsWith('/categories')) return Response.json([{ id: 'chair', name: 'Chair' }])
    if (String(url).includes('/orders/')) return Response.json({detail:'Order not found'}, {status:404})
    return Response.json({ storage: 'local_demo', routing: 'estimated' })
  }) as typeof fetch
}
test('search entry reload regenerates the saved request and positions results', async () => {
  const path = saveSearch(request)
  window.history.replaceState(null, '', path)
  const bodies: unknown[] = []
  mockSearch(async body => { bodies.push(body); return Response.json(response) })
  const view = render(<App />)
  await screen.findByRole('heading', { name: 'No complete bundle just yet.' })
  await waitFor(() => assert.equal(scrolled, 'Bundle results'))
  view.unmount(); render(<App />)
  await screen.findByRole('heading', { name: 'No complete bundle just yet.' })
  assert.deepEqual(bodies, [request, request])
})
test('Back from a swapped bundle returns to the original results without pushing history', async () => {
  const path = saveSearch(request)
  navigate(path); navigate('/bundles/original'); navigate('/bundles/replacement')
  const length = window.history.length
  backToResults(request)
  await waitFor(() => assert.equal(window.location.pathname + window.location.search, path))
  assert.equal(window.history.length, length)
})
test('missing saved search returns to the form with an explanation', async () => {
  window.history.replaceState(null, '', '/buyer/results?search=missing')
  mockSearch(async () => { throw new Error('Should not generate') })
  render(<App />)
  await screen.findByText('This search could not be restored. Review your preferences and build a new bundle.')
  assert.equal(window.location.pathname, '/buyer')
})
test('failed generation retries the original request even after form edits', async () => {
  window.history.replaceState(null, '', saveSearch(request))
  const bodies: unknown[] = []
  mockSearch(async body => { bodies.push(body); return bodies.length === 1 ? Response.json({ detail: 'Offline' }, { status: 503 }) : Response.json(response) })
  render(<App />)
  await screen.findByRole('button', { name: 'Retry search' })
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Furniture budget' }), { target: { value: '500' } })
  fireEvent.click(screen.getByRole('button', { name: 'Retry search' }))
  await screen.findByRole('heading', { name: 'No complete bundle just yet.' })
  assert.deepEqual(bodies, [request, request])
})
test('leaving results discards a late generation response', async () => {
  window.history.replaceState(null, '', saveSearch(request))
  let finish!: (r: Response) => void
  mockSearch(() => new Promise(resolve => { finish = resolve }))
  render(<App />)
  await waitFor(() => assert.ok(finish))
  await act(async () => { navigate('/buyer'); finish(Response.json(response)) })
  assert.equal(screen.queryByRole('heading', { name: 'No complete bundle just yet.' }), null)
})
test('saved search snapshots are independent of subsequent form mutations', () => {
  const copy = structuredClone(request)
  const path = saveSearch(copy)
  copy.categories.push('desk'); copy.budget = 500
  assert.deepEqual(readSearch(path), request)
})
test('returning from a receipt regenerates instead of restoring stale options', async () => {
  const path = saveSearch(request)
  window.history.replaceState(null, '', '/buyer')
  navigate(path)
  let calls = 0
  mockSearch(async () => { calls++; return Response.json({ ...response, message: calls === 1 ? 'Original inventory' : 'Remaining inventory' }) })
  render(<App />)
  await screen.findByText('Original inventory')
  await act(async () => { navigate('/orders/receipt') })
  await act(async () => { backToResults(request) })
  await screen.findByText('Remaining inventory')
  assert.equal(calls, 2)
  assert.equal(screen.queryByText('Original inventory'), null)
})
test('storage-disabled sessions keep in-memory searches usable', () => {
  const descriptor = Object.getOwnPropertyDescriptor(window, 'sessionStorage')!
  Object.defineProperty(window, 'sessionStorage', { configurable: true, get() { throw new Error('Storage unavailable') } })
  try { assert.deepEqual(readSearch(saveSearch(request)), request) }
  finally { Object.defineProperty(window, 'sessionStorage', descriptor) }
})
