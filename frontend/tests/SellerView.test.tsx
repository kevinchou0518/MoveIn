import { JSDOM } from 'jsdom'
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' })
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, FormData: dom.window.FormData, File: dom.window.File })
const { render, screen, fireEvent, waitFor, cleanup } = await import('@testing-library/react')
const { default: React } = await import('react')
const { default: SellerView } = await import('../src/SellerView')
afterEach(cleanup)
const sellers = ['jordan','maya'].map(id => ({id,name:id,location:{lat:40,lng:-79,label:'Oakland'},can_drive:true,vehicle_type:'truck',vehicle_capacity:12}))
const result = {title:'Suggested chair',description:'Wooden chair',category:'chair',condition:'fair',condition_score:6,visible_issues:['Scratch'],estimated_product:null,suggested_price_min:30,suggested_price_max:51,confidence:.8}
let resolveAnalysis: (value: Response) => void
let published: Record<string,unknown> | undefined
function setup() {
  published = undefined
  globalThis.fetch = (async (url: string, options?: RequestInit) => {
    const path=String(url)
    if (path.endsWith('/sellers')) return Response.json(sellers)
    if (path.endsWith('/uploads')) return Response.json({image_url:'/uploads/photo.jpg'})
    if (path.endsWith('/listings/analyze')) return new Promise<Response>(resolve => {resolveAnalysis=resolve})
    if (options?.method==='POST') { published=JSON.parse(String(options.body)); return Response.json({...published,id:'new',available:true}) }
    return Response.json([])
  }) as typeof fetch
  render(<SellerView />)
}
async function upload() {
  await screen.findByRole('option',{name:'jordan'})
  fireEvent.change(screen.getByLabelText('Furniture photo'),{target:{files:[new File(['image'],'chair.jpg',{type:'image/jpeg'})]}})
  await screen.findByRole('button',{name:'Analyze photo'})
}
test('review preserves edits, applies selected suggestions, then publishes edited values',async () => {
  setup(); await upload()
  fireEvent.change(screen.getByLabelText('Listing title'),{target:{value:'My title'}})
  fireEvent.click(screen.getByRole('button',{name:'Analyze photo'}))
  resolveAnalysis(Response.json(result))
  await screen.findByRole('heading',{name:'Review suggestions'})
  assert.equal((screen.getByLabelText('Listing title') as HTMLInputElement).value,'My title')
  fireEvent.click(screen.getByRole('button',{name:'Apply selected suggestions'}))
  assert.equal((screen.getByLabelText('Listing title') as HTMLInputElement).value,'My title')
  assert.equal((screen.getByLabelText('Asking price ($)',{exact:true}) as HTMLInputElement).value,'40.50')
  assert.equal((screen.getByLabelText('Condition',{exact:true}) as HTMLSelectElement).value,'good')
  assert.equal((screen.getByLabelText('Description',{exact:true}) as HTMLTextAreaElement).value,'Wooden chair\nScratch')
  fireEvent.change(screen.getByLabelText('Asking price ($)',{exact:true}),{target:{value:'44'}})
  fireEvent.click(screen.getByRole('button',{name:'Publish listing'}))
  await waitFor(()=>assert.equal(published?.price,'44'))
  assert.equal(published?.title,'My title')
})
test('profile changes discard an in-flight result',async () => {
  setup(); await upload()
  fireEvent.click(screen.getByRole('button',{name:'Analyze photo'}))
  fireEvent.change(screen.getByLabelText('Demo seller profile'),{target:{value:'maya'}})
  resolveAnalysis(Response.json(result))
  await waitFor(()=>assert.ok(screen.getByRole('button',{name:'Analyze photo'})))
  assert.equal(screen.queryByRole('heading',{name:'Review suggestions'}),null)
})
test('photo replacement discards an in-flight result',async () => {
  setup(); await upload()
  fireEvent.click(screen.getByRole('button',{name:'Analyze photo'}))
  const finish=resolveAnalysis
  await upload()
  finish(Response.json(result))
  await waitFor(()=>assert.ok(screen.getByRole('button',{name:'Analyze photo'})))
  assert.equal(screen.queryByRole('heading',{name:'Review suggestions'}),null)
})
test('provider failure leaves manual publishing available',async () => {
  setup(); await upload()
  fireEvent.click(screen.getByRole('button',{name:'Analyze photo'}))
  resolveAnalysis(Response.json({detail:'AI unavailable'},{status:503}))
  await screen.findByRole('alert')
  assert.equal((screen.getByRole('button',{name:'Publish listing'}) as HTMLButtonElement).disabled,false)
})
test('no usable suggestions cannot be applied',async () => {
  setup(); await upload()
  fireEvent.click(screen.getByRole('button',{name:'Analyze photo'}))
  resolveAnalysis(Response.json({...result,title:null,description:null,category:null,condition:null,condition_score:null,visible_issues:[],suggested_price_min:null,suggested_price_max:null}))
  await screen.findByRole('heading',{name:'Review suggestions'})
  assert.equal((screen.getByRole('button',{name:'Apply selected suggestions'}) as HTMLButtonElement).disabled,true)
})
