import {JSDOM} from 'jsdom'
import {test,afterEach} from 'node:test'
import assert from 'node:assert/strict'
const dom=new JSDOM('<html><body></body></html>',{url:'http://localhost'})
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement})
const {render,screen,fireEvent,cleanup}=await import('@testing-library/react')
const {default:React}=await import('react')
const {default:BuyerLocation}=await import('../src/BuyerLocation')
afterEach(cleanup)
const old={lat:40.44,lng:-79.94,label:'4400 Forbes Avenue, Pittsburgh'}
const next={lat:40.45,lng:-79.93,label:'5436 Walnut Street, Pittsburgh'}
test('buyer address changes require selection and save; cancel preserves the selected address',async()=>{
 const changes:unknown[]=[];let editing=false
 globalThis.fetch=async()=>Response.json([next])
 render(<BuyerLocation value={old} initialQuery="" onChange={v=>changes.push(v)} onEditingChange={v=>{editing=v}} />)
 assert.equal(screen.queryByRole('searchbox'),null)
 fireEvent.click(screen.getByRole('button',{name:'Change address'}))
 assert.equal(editing,true)
 fireEvent.change(screen.getByRole('searchbox'),{target:{value:'5436 Walnut'}})
 assert.equal((screen.getByRole('button',{name:'Save address'}) as HTMLButtonElement).disabled,true)
 fireEvent.click(screen.getByRole('button',{name:'Search buyer location'}))
 fireEvent.click(await screen.findByRole('button',{name:next.label}))
 assert.deepEqual(changes,[])
 fireEvent.click(screen.getByRole('button',{name:'Cancel address change'}))
 assert.equal(editing,false);assert.deepEqual(changes,[])
 fireEvent.click(screen.getByRole('button',{name:'Change address'}))
 assert.equal((screen.getByRole('searchbox') as HTMLInputElement).value,old.label)
 fireEvent.change(screen.getByRole('searchbox'),{target:{value:'5436 Walnut'}})
 fireEvent.click(screen.getByRole('button',{name:'Search buyer location'}))
 fireEvent.click(await screen.findByRole('button',{name:next.label}))
 fireEvent.click(screen.getByRole('button',{name:'Save address'}))
 assert.deepEqual(changes,[next]);assert.equal(editing,false)
})
test('unresolved AI location opens the address search with its draft',()=>{
 render(<BuyerLocation value={null} initialQuery="Forbes Avenue" onChange={()=>{}} onEditingChange={()=>{}} />)
 assert.equal((screen.getByRole('searchbox') as HTMLInputElement).value,'Forbes Avenue')
 assert.equal((screen.getByRole('button',{name:'Save address'}) as HTMLButtonElement).disabled,true)
 assert.equal(screen.queryByText('Search by Mapbox'),null)
})
