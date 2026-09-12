import {JSDOM} from 'jsdom'
import {test,afterEach} from 'node:test'
import assert from 'node:assert/strict'
const dom=new JSDOM('<html><body></body></html>',{url:'http://localhost/account'})
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement})
const {render,screen,fireEvent,act,cleanup,waitFor}=await import('@testing-library/react')
const {default:React}=await import('react')
const {default:AccountPage}=await import('../src/AccountPage')
const {LoginProvider}=await import('../src/Auth')
const {configureApiAuth}=await import('../src/api')
afterEach(()=>{cleanup();window.sessionStorage.clear();configureApiAuth(null)})
const profile={id:'maya',name:'Maya Chen',location:{lat:40.44,lng:-79.94,label:'Oakland'},can_drive:false,vehicle_type:null,vehicle_capacity:0}

test('profile saves current user settings and switches complete accounts',async()=>{
  let finish:(r:Response)=>void=()=>{}, body:Record<string,unknown>={}
  globalThis.fetch=(async(url,options)=>{
    const user=new Headers(options?.headers).get('Authorization')
    if(String(url).endsWith('/me'))return Response.json({sellers:user==='Bearer maya'?[profile]:[]})
    if(options?.method==='PATCH'){body=JSON.parse(String(options.body));return new Promise<Response>(r=>{finish=r})}
    return Response.json([])
  }) as typeof fetch
  render(<LoginProvider><AccountPage /></LoginProvider>)
  const name=await screen.findByLabelText('Display name') as HTMLInputElement
  fireEvent.change(name,{target:{value:'Maya updated'}})
  fireEvent.click(screen.getByRole('button',{name:'Save settings'}))
  assert.equal(name.matches(':disabled'),true)
  await waitFor(()=>assert.equal(body.name,'Maya updated'))
  await act(async()=>finish(Response.json({...profile,name:'Maya updated'})))
  await screen.findByText('Profile settings saved.')
  assert.equal(body.name,'Maya updated')
  assert.equal(screen.queryByLabelText('Selling profile'),null)
  fireEvent.change(screen.getByLabelText('Current user'),{target:{value:'jordan'}})
  await screen.findByText('Set up your pickup details to publish your first listing.')
  assert.equal((screen.getByLabelText('Display name') as HTMLInputElement).value,'Jordan Brooks')
  assert.equal(screen.queryByRole('option',{name:'Maya updated'}),null)
  assert.equal(window.location.pathname,'/account')
  assert.ok(screen.getByText('Every account can buy furniture, sell items, and manage orders and deliveries.'))
})

test('failed profile loading offers retry without presenting a blank create form',async()=>{
  let failed=true
  globalThis.fetch=async()=>failed?Response.json({detail:'Unavailable'},{status:503}):Response.json({sellers:[profile]})
  render(<LoginProvider><AccountPage /></LoginProvider>)
  const retry=await screen.findByRole('button',{name:'Retry profile'})
  assert.equal(screen.queryByRole('button',{name:'Save settings'}),null)
  failed=false;fireEvent.click(retry)
  await screen.findByLabelText('Display name')
})
