import { JSDOM } from 'jsdom'
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' })
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, FormData: dom.window.FormData, File: dom.window.File })
const { render, screen, fireEvent, waitFor, cleanup, act } = await import('@testing-library/react')
const { default: React } = await import('react')
const { default: SellerView } = await import('../src/SellerView')
afterEach(cleanup)
const sellers = ['jordan','maya'].map(id => ({id,name:id,location:{lat:40,lng:-79,label:'Oakland'},can_drive:true,vehicle_type:'truck',vehicle_capacity:12}))
const result = {title:'Suggested chair',description:'Wooden chair',category:'chair',condition:'fair',condition_score:6,visible_issues:['Scratch'],estimated_product:null,suggested_price_min:30,suggested_price_max:51,confidence:.8}
let resolveAnalysis: (value: Response) => void
let published: Record<string,unknown> | undefined

for (const failed of [false,true]) {
  test(`pending save locks cancellation and editor fields, then restores editing (failure: ${failed})`, async () => {
    window.history.replaceState(null,'','/seller/jordan/listings')
    const item={id:'chair-test',seller_id:'jordan',title:'Original chair',category:'chair',description:'Chair',price:30,condition:'good',condition_score:8,item_size:1,image_url:'/images/chair.svg',available:true,status:'available',available_date:'2020-01-01'}
    let finish:(r:Response)=>void=()=>{}
    globalThis.fetch=(async(url,options)=>{
      if(String(url).endsWith('/me'))return Response.json({sellers})
      if(options?.method==='PATCH')return new Promise<Response>(r=>{finish=r})
      return Response.json(String(url).endsWith('/listings')?[item]:[])
    }) as typeof fetch
    dom.window.HTMLElement.prototype.scrollIntoView=()=>{}
    render(<SellerView />)
    fireEvent.click(await screen.findByRole('button',{name:'Edit',exact:true}))
    const title=screen.getByLabelText('Listing title') as HTMLInputElement
    fireEvent.change(title,{target:{value:'Saved title'}})
    fireEvent.click(screen.getByRole('button',{name:'Save changes'}))
    const cancel=screen.getByRole('button',{name:'Cancel editing'}) as HTMLButtonElement
    assert.equal(cancel.disabled,true)
    fireEvent.click(cancel)
    assert.ok(screen.getByRole('heading',{name:'Edit your listing'}))
    const fields=screen.getByRole('group',{name:'Listing details'})
    for(const control of fields.querySelectorAll('input,select,textarea,button')) {
      assert.ok(control.matches(':disabled'), 'Every editor control must be disabled while saving')
    }
    await act(async()=>finish(failed ? Response.json({detail:'Save failed'},{status:503}) : Response.json({...item,title:'Saved title'})))
    assert.equal(title.matches(':disabled'),false)
    if(failed) {
      assert.equal(title.value,'Saved title')
      assert.equal(cancel.disabled,false)
      fireEvent.click(cancel)
    } else {
      assert.ok(screen.getByRole('heading',{name:'Saved title'}))
      assert.equal(screen.queryByRole('button',{name:'Cancel editing'}),null)
    }
    fireEvent.change(title,{target:{value:'My next listing draft'}})
    await act(async()=>{})
    assert.equal(title.value,'My next listing draft')
  })
}

for (const firstAction of ['withdraw','save','failed-withdraw']) {
  test(`same listing writes wait for ${firstAction} to finish`, async () => {
    window.history.replaceState(null,'','/seller/jordan/listings')
    const item={id:'chair-test',seller_id:'jordan',title:'Original chair',category:'chair',description:'Chair',price:30,condition:'good',condition_score:8,item_size:1,image_url:'/images/chair.svg',available:true,status:'available',available_date:'2020-01-01'}
    const writes:{url:string;finish:(r:Response)=>void}[]=[]
    globalThis.fetch=(async(url,options)=>{
      if(String(url).endsWith('/me'))return Response.json({sellers})
      if(options?.method==='PATCH' || options?.method==='POST')return new Promise<Response>(finish=>writes.push({url:String(url),finish}))
      return Response.json(String(url).endsWith('/listings')?[item]:[])
    }) as typeof fetch
    dom.window.HTMLElement.prototype.scrollIntoView=()=>{}
    render(<SellerView />)
    fireEvent.click(await screen.findByRole('button',{name:'Edit',exact:true}))
    fireEvent.change(screen.getByLabelText('Listing title'),{target:{value:'Updated chair'}})
    const save=screen.getByRole('button',{name:'Save changes'}) as HTMLButtonElement
    const withdraw=screen.getByRole('button',{name:'Withdraw',exact:true}) as HTMLButtonElement
    fireEvent.click(firstAction === 'save' ? save : withdraw)
    assert.equal(save.disabled,true)
    assert.equal(withdraw.disabled,true)
    assert.equal((screen.getByRole('button',{name:'Edit',exact:true}) as HTMLButtonElement).disabled,true)
    // Submission through the form must also respect the synchronous lock.
    fireEvent.submit(save.closest('form')!)
    fireEvent.click(withdraw)
    assert.equal(writes.length,1)
    const failed=firstAction === 'failed-withdraw'
    const firstResult={...item,title:firstAction === 'save'?'Updated chair':item.title,status:firstAction === 'save'?'available':'withdrawn',available:firstAction === 'save'}
    await act(async()=>writes[0].finish(failed ? Response.json({detail:'Try again'},{status:503}) : Response.json(firstResult)))
    if(firstAction === 'save') {
      assert.equal(withdraw.disabled,false)
      fireEvent.click(withdraw)
    } else {
      assert.equal(save.disabled,false)
      fireEvent.click(save)
    }
    assert.equal(writes.length,2)
    await act(async()=>writes[1].finish(Response.json({...item,title:'Updated chair',status:failed?'available':'withdrawn',available:failed})))
    assert.ok(screen.getByRole('heading',{name:'Updated chair'}))
    assert.equal(screen.queryByRole('heading',{name:'Original chair'}),null)
    assert.equal((screen.getByRole('button',{name:failed?'Withdraw':'Republish',exact:true}) as HTMLButtonElement).disabled,false)
  })
}

for (const action of ['withdraw','republish','edit','create']) for (const refreshDuringWrite of [false,true]) {
  test(`late inventory refresh cannot overwrite ${action} (refresh during write: ${refreshDuringWrite})`, async () => {
    window.history.replaceState(null,'','/seller/jordan/listings')
    const item = {id:'chair-test',seller_id:'jordan',title:'Original chair',category:'chair',description:'A chair',price:30,condition:'good',condition_score:8,item_size:1,image_url:'/images/chair.svg',available:action !== 'republish',status:action === 'republish' ? 'withdrawn' : 'available',available_date:'2020-01-01'}
    let reads=0, finishRefresh:(value:Response)=>void=()=>{}, finishWrite:(value:Response)=>void=()=>{}
    globalThis.fetch = (async (url,options) => {
      if (String(url).endsWith('/me')) return Response.json({sellers})
      if (String(url).endsWith('/uploads')) return Response.json({image_url:'/uploads/new.jpg'})
      if (options?.method === 'POST' || options?.method === 'PATCH') return new Promise<Response>(r=>{finishWrite=r})
      if (String(url).endsWith('/listings')) {
        reads++
        return reads === 1 ? Response.json([item]) : new Promise<Response>(r=>{finishRefresh=r})
      }
      return Response.json([])
    }) as typeof fetch
    dom.window.HTMLElement.prototype.scrollIntoView=()=>{}
    render(<SellerView />)
    await screen.findByRole('heading',{name:'Original chair'})
    fireEvent(window,new dom.window.Event('focus'))
    await waitFor(()=>assert.equal(reads,2))
    if (action === 'edit' || action === 'create') {
      if (action === 'edit') fireEvent.click(screen.getByRole('button',{name:'Edit',exact:true}))
      else {
        fireEvent.change(screen.getByLabelText('Furniture photo'),{target:{files:[new File(['image'],'chair.jpg',{type:'image/jpeg'})]}})
        await screen.findByRole('button',{name:'Analyze photo'})
        fireEvent.change(screen.getByLabelText('Asking price ($)',{exact:true}),{target:{value:'35'}})
      }
      fireEvent.change(screen.getByLabelText('Listing title'),{target:{value:'Updated chair'}})
      fireEvent.click(screen.getByRole('button',{name:action === 'edit' ? 'Save changes' : 'Publish listing'}))
    } else fireEvent.click(screen.getByRole('button',{name:action === 'withdraw' ? 'Withdraw' : 'Republish',exact:true}))
    // A refresh requested while the write is pending must also be discarded.
    const oldRefresh=finishRefresh
    if (refreshDuringWrite) {
      fireEvent(window,new dom.window.Event('focus'))
      await waitFor(()=>assert.equal(reads,3))
    }
    await act(async()=>{finishWrite(Response.json({...item,id:action === 'create' ? 'new-chair' : item.id,title:['edit','create'].includes(action)?'Updated chair':item.title,status:action === 'withdraw'?'withdrawn':'available',available:action !== 'withdraw'}))})
    await act(async()=>{oldRefresh(Response.json([item]));if(refreshDuringWrite)finishRefresh(Response.json([item]))})
    if (['edit','create'].includes(action)) assert.ok(screen.getByRole('heading',{name:'Updated chair'}))
    else assert.ok(screen.getByRole('button',{name:action === 'withdraw' ? 'Republish' : 'Withdraw',exact:true}))
    assert.equal(screen.queryByText('Loading furniture…'),null)
  })
}

test('saving withdrawn furniture explains that republishing is still required', async () => {
  window.history.replaceState(null,'','/seller/jordan/listings')
  const item={id:'withdrawn-chair',seller_id:'jordan',title:'Withdrawn chair',category:'chair',description:'Chair',price:30,condition:'good',condition_score:8,item_size:1,image_url:'/images/chair.svg',available:false,status:'withdrawn',available_date:'2020-01-01'}
  globalThis.fetch=(async(url,options)=>{
    if(String(url).endsWith('/me'))return Response.json({sellers})
    if(options?.method==='PATCH')return Response.json({...item,title:'Updated withdrawn chair'})
    return Response.json(String(url).endsWith('/listings')?[item]:[])
  }) as typeof fetch
  dom.window.HTMLElement.prototype.scrollIntoView=()=>{}
  render(<SellerView />)
  fireEvent.click(await screen.findByRole('button',{name:'Edit',exact:true}))
  fireEvent.change(screen.getByLabelText('Listing title'),{target:{value:'Updated withdrawn chair'}})
  fireEvent.click(screen.getByRole('button',{name:'Save changes'}))
  await screen.findByText(/This listing is still withdrawn. Republish it/)
  assert.ok(screen.getByRole('button',{name:'Republish',exact:true}))
  assert.equal(screen.queryByText(/is published/),null)
})

test('profile refresh preserves drafts and explicit discard restores current server values', async () => {
  window.history.replaceState(null,'','/seller/jordan/profile')
  let reads=0
  globalThis.fetch = async url => {
    if (String(url).endsWith('/me')) { reads++; return Response.json({id:'owner',sellers:[{...sellers[0],name:reads === 1 ? 'Jordan' : 'Jordan updated'}]}) }
    return Response.json([])
  }
  render(<SellerView />)
  const name = await screen.findByLabelText('Your name') as HTMLInputElement
  fireEvent.change(name,{target:{value:'My unsaved name'}})
  fireEvent(window,new dom.window.Event('focus'))
  await screen.findByRole('option',{name:'Jordan updated'})
  assert.equal(name.value,'My unsaved name')
  fireEvent.click(screen.getByRole('button',{name:'Discard profile changes'}))
  assert.equal(name.value,'Jordan updated')
})

test('dashboard load failure offers a working retry', async () => {
  window.history.replaceState(null,'','/seller/jordan/profile')
  let failed=true
  globalThis.fetch = async url => String(url).endsWith('/me')
    ? failed ? Response.json({detail:'Unavailable'},{status:503}) : Response.json({id:'owner',sellers})
    : Response.json([])
  render(<SellerView />)
  const retry=await screen.findByRole('button',{name:'Retry dashboard'})
  failed=false
  fireEvent.click(retry)
  await screen.findByLabelText('Your name')
  assert.equal(screen.queryByRole('button',{name:'Retry dashboard'}),null)
})

test('inventory editing uses PATCH and withdrawal uses a dedicated action',async () => {
  window.history.replaceState(null,'','/seller/jordan/listings')
  const item = {id:'chair-test',seller_id:'jordan',title:'Original chair',category:'chair',description:'A chair',price:30,condition:'good',condition_score:8,item_size:1,image_url:'/images/chair.svg',available:true,status:'available',available_date:'2020-01-01'}
  const writes: {url:string;method:string;body:Record<string,unknown>}[]=[]
  globalThis.fetch = (async (url, options) => {
    if (String(url).endsWith('/me')) return Response.json({id:'owner',sellers})
    if (options?.method === 'PATCH' || options?.method === 'POST') {
      const body=JSON.parse(String(options.body || '{}'));writes.push({url:String(url),method:options.method,body})
      return Response.json({...item,...body,...(String(url).endsWith('/withdraw') ? {status:'withdrawn',available:false} : {})})
    }
    if (String(url).endsWith('/listings')) return Response.json([item])
    return Response.json([])
  }) as typeof fetch
  dom.window.HTMLElement.prototype.scrollIntoView = () => {}
  render(<SellerView />)
  fireEvent.click(await screen.findByRole('button',{name:'Edit',exact:true}))
  fireEvent.change(screen.getByLabelText('Listing title'),{target:{value:'Updated chair'}})
  fireEvent.click(screen.getByRole('button',{name:'Save changes'}))
  await waitFor(()=>assert.equal(writes[0]?.method,'PATCH'))
  assert.equal(writes[0].body.title,'Updated chair')
  assert.equal(writes[0].body.seller_id,undefined)
  fireEvent.click(await screen.findByRole('button',{name:'Withdraw',exact:true}))
  await waitFor(()=>assert.ok(writes.some(w=>w.url.endsWith('/listings/chair-test/withdraw'))))
  await screen.findByRole('button',{name:'Republish'})
})

test('seller dashboard requests only owned profiles and provides distinct order tabs',async () => {
  window.history.replaceState(null,'','/seller/jordan/orders')
  const urls:string[]=[]
  globalThis.fetch = async url => { urls.push(String(url)); if(String(url).endsWith('/me'))return Response.json({id:'owner',sellers:[sellers[0]]}); if(String(url).includes('/orders?'))return Response.json({items:[],total:0,offset:0,limit:20}); return Response.json([]) }
  render(<SellerView />)
  await screen.findByRole('heading',{name:'Orders with your furniture'})
  await waitFor(()=>assert.ok(urls.some(u=>u.includes('/sellers/jordan/orders?'))))
  assert.equal(screen.queryByRole('option',{name:'maya'}),null)
  assert.ok(screen.getByRole('tab',{name:'Deliveries'}))
})
function setup() {
  window.history.replaceState(null, '', '/seller/jordan/listings')
  published = undefined
  globalThis.fetch = (async (url: string, options?: RequestInit) => {
    const path=String(url)
    if (path.endsWith('/me')) return Response.json({id:'owner',sellers})
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
  fireEvent.change(screen.getByLabelText('Your seller profile'),{target:{value:'maya'}})
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
