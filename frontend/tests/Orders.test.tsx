import { JSDOM } from 'jsdom'
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
const dom = new JSDOM('<!doctype html><html><body></body></html>', {url:'http://localhost/orders/o1'})
Object.assign(globalThis, {window:dom.window, document:dom.window.document, HTMLElement:dom.window.HTMLElement, Event:dom.window.Event})
dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open','') }
dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
const {render, screen, fireEvent, waitFor, cleanup} = await import('@testing-library/react')
const {default:React} = await import('react')
const {OrderPage, OrderHistory, OrderActions} = await import('../src/Orders')
const {LoginRequired, AuthContext} = await import('../src/Auth')
const {api, configureApiAuth} = await import('../src/api')
import type {Order, OrderView, Bundle} from '../src/types'
const location = {lat:40.44,lng:-79.94,label:'Oakland'}
const seller = {id:'s1',name:'Sam',location,can_drive:true,vehicle_type:'truck' as const,vehicle_capacity:12}
const bundle:Bundle = {id:'b1',listings:[],sellers:[seller],driver:seller,transportation_mode:'seller_delivery',total:100,item_total:90,delivery_fee:10,distance_miles:5,duration_minutes:10,total_size:2,condition_score:8,seller_count:1,final_score:1,selection_score:1,route:{source:'estimated',geometry_source:'schematic',warning:'Estimate',distance_miles:5,duration_minutes:10,geometry:[[-79.94,40.44]],stops:[]}}
const order:Order = {id:'o1',bundle_id:'b1',bundle,status:'reserved',created_at:'2026-09-12T10:00:00Z',allowed_actions:['cancel'],viewer_role:'buyer',history:[{status:'reserved',at:'2026-09-12T10:00:00Z'}]}
afterEach(() => {cleanup();configureApiAuth(null);window.history.replaceState(null,'','/orders/o1')})

test('buyer delivery button stays on a buyer order route', async () => {
  globalThis.fetch = async () => Response.json(order)
  render(<OrderPage path="/orders/o1" onFindAnother={()=>{}} />)
  fireEvent.click(await screen.findByRole('button',{name:'View delivery plan'}))
  assert.equal(window.location.pathname,'/orders/o1/plan')
  assert.equal(screen.queryByRole('button',{name:'Start delivery'}),null)
})

test('cancellation requires confirmation and reason; repeated clicks send once', async () => {
  let calls=0, finish: (r:Response)=>void=()=>{}, updated:OrderView|undefined
  const cancelled = {...order,status:'cancelled' as const,allowed_actions:[],cancellation_reason:'Moving later'}
  globalThis.fetch = (async (_url, options) => {
    if (options?.method === 'POST') {calls++;assert.equal(JSON.parse(String(options.body)).reason,'Moving later');return new Promise<Response>(r=>{finish=r})}
    return Response.json(cancelled)
  }) as typeof fetch
  render(<OrderActions order={order} onUpdate={o=>{updated=o}} />)
  fireEvent.click(screen.getByRole('button',{name:'Cancel reservation'}))
  assert.equal(calls,0)
  assert.equal((screen.getByRole('button',{name:'Confirm',exact:true}) as HTMLButtonElement).disabled,true)
  fireEvent.change(screen.getByLabelText('Cancellation reason'),{target:{value:'Moving later'}})
  const confirm = screen.getByRole('button',{name:'Confirm',exact:true})
  fireEvent.click(confirm);fireEvent.click(confirm)
  assert.equal(calls,1)
  finish(Response.json(cancelled))
  await waitFor(()=>assert.equal(updated?.status,'cancelled'))
  assert.equal(screen.queryByRole('dialog'),null)
})

test('cancelled receipt is history and exposes no reservation actions', async () => {
  globalThis.fetch = async () => Response.json({...order,status:'cancelled',allowed_actions:[],cancellation_reason:'Plans changed'})
  render(<OrderPage path="/orders/o1" onFindAnother={()=>{}} />)
  await screen.findByText('Cancellation reason: Plans changed')
  assert.equal(screen.queryByRole('button',{name:'Cancel reservation'}),null)
  assert.equal(screen.queryByRole('button',{name:'Choose this bundle'}),null)
  assert.ok(screen.getByText(/These items are no longer held/))
})

test('late refresh cannot overwrite cancellation and failed refresh preserves confirmed status', async () => {
  let reads=0, finish: (r:Response)=>void=()=>{}
  const cancelled = {...order,status:'cancelled',allowed_actions:[],cancellation_reason:'Plans changed'}
  globalThis.fetch = (async (_url, options) => {
    if (options?.method === 'POST') return Response.json(cancelled)
    reads++
    if (reads === 1) return Response.json(order)
    if (reads === 2) return new Promise<Response>(r=>{finish=r})
    return Response.json({detail:'Service unavailable'},{status:503})
  }) as typeof fetch
  render(<OrderPage path="/orders/o1" onFindAnother={()=>{}} />)
  await screen.findByRole('button',{name:'Cancel reservation'})
  fireEvent(window,new Event('focus'))
  await waitFor(()=>assert.equal(reads,2))
  fireEvent.click(screen.getByRole('button',{name:'Cancel reservation'}))
  fireEvent.change(screen.getByLabelText('Cancellation reason'),{target:{value:'Plans changed'}})
  fireEvent.click(screen.getByRole('button',{name:'Confirm',exact:true}))
  await screen.findByText('Cancellation reason: Plans changed')
  assert.equal(reads,2, 'mutation uses its response without a second GET')
  finish(Response.json(order))
  fireEvent(window,new Event('focus'))
  await screen.findByText(/Showing the last confirmed status/)
  assert.ok(screen.getByText('Cancellation reason: Plans changed'))
  assert.equal(screen.queryByRole('button',{name:'Cancel reservation'}),null)
})

test('seller cancellation retains selected profile and reduced response', async () => {
  const reduced = {...order,viewer_role:'seller',bundle:{listings:[],sellers:[seller],driver_name:'Driver',transportation_mode:'seller_delivery'}}
  globalThis.fetch = (async (url,options) => {
    assert.ok(String(url).includes('?seller_id=s1'))
    return Response.json(options?.method === 'POST' ? {...reduced,status:'cancelled',allowed_actions:[],cancellation_reason:'Unavailable'} : reduced)
  }) as typeof fetch
  render(<OrderPage path="/seller/s1/orders/o1" onFindAnother={()=>{}} />)
  fireEvent.click(await screen.findByRole('button',{name:'Cancel reservation'}))
  fireEvent.change(screen.getByLabelText('Cancellation reason'),{target:{value:'Unavailable'}})
  fireEvent.click(screen.getByRole('button',{name:'Confirm',exact:true}))
  await screen.findByText('Cancellation reason: Unavailable')
  assert.ok(screen.getByRole('heading',{name:'Your pickup responsibilities'}))
  assert.equal(screen.queryByRole('button',{name:'View delivery plan'}),null)
})

test('order filters and pagination request current account history', async () => {
  const urls:string[]=[]
  globalThis.fetch = async url => {urls.push(String(url));return Response.json({items:[order],total:21,offset:0,limit:20})}
  render(<OrderHistory />)
  fireEvent.click(await screen.findByRole('button',{name:'Next'}))
  await waitFor(()=>assert.ok(urls.some(u=>u.includes('offset=20'))))
  fireEvent.change(screen.getByLabelText('Order status'),{target:{value:'cancelled'}})
  await waitFor(()=>assert.ok(urls.some(u=>u.includes('offset=0&status=cancelled'))))
})

test('demo users switch without login and reset private routes', async () => {
  const {LoginProvider,UserSwitcher}=await import('../src/Auth')
  render(<LoginProvider><UserSwitcher /><LoginRequired><p>Demo content</p></LoginRequired></LoginProvider>)
  assert.ok(screen.getByText('Demo content'))
  fireEvent.change(screen.getByLabelText('Demo user'),{target:{value:'demo-seller'}})
  assert.equal(window.location.pathname,'/seller')
  assert.equal(window.sessionStorage.getItem('demo-user'),'demo-seller')
  globalThis.fetch=async (_url,options)=>{
    assert.equal(new Headers(options?.headers).get('Authorization'),'Bearer demo-seller')
    return Response.json({})
  }
  await api('/me')
  fireEvent.change(screen.getByLabelText('Demo user'),{target:{value:'demo-buyer'}})
  assert.equal(window.location.pathname,'/buyer')
})

test('API sends access token and rejects responses after account changes', async () => {
  let finish: (r:Response)=>void=()=>{}
  configureApiAuth(async ()=>'access-token','buyer-a')
  globalThis.fetch = (async (_url,options) => {assert.equal(new Headers(options?.headers).get('Authorization'),'Bearer access-token');return new Promise<Response>(r=>{finish=r})}) as typeof fetch
  const result=api('/orders')
  await new Promise(resolve=>setTimeout(resolve,0))
  configureApiAuth(async ()=>'other-token','buyer-b')
  finish(Response.json({items:[]}))
  await assert.rejects(result,/Account changed/)
})
