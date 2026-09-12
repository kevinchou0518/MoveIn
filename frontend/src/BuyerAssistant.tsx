import { useRef, useState, useEffect } from 'react'
import { post } from './api'
import type { BuyerDraft } from './types'
import { categoryLabel } from './catalog'
import { rankingNames } from './types'
export default function BuyerAssistant({onApply}:{onApply:(draft:BuyerDraft)=>void}) {
  const [text,setText]=useState(''),[draft,setDraft]=useState<BuyerDraft|null>(null),[selected,setSelected]=useState<string[]>([]),[pending,setPending]=useState(false),[error,setError]=useState('')
  const version=useRef(0)
  useEffect(()=>()=>{version.current++},[])
  async function parse(){const id=++version.current;setPending(true);setError('');setDraft(null);try{const value=await post<BuyerDraft>('/buyer/parse',{text});if(id===version.current){setDraft(value);setSelected([])}}catch(e){if(id===version.current)setError((e as Error).message)}finally{if(id===version.current)setPending(false)}}
  const fields=draft ? [
    ['categories','Categories',draft.categories?.map(categoryLabel).join(', ')],['budget','Furniture budget',draft.budget==null?null:`$${draft.budget}`],['buyer_has_car','Transportation',draft.buyer_has_car==null?null:draft.buyer_has_car?'Self-pickup':'Seller delivery'],['location_text','Location to search',draft.location_text],['ranking','Priority',draft.ranking?rankingNames[draft.ranking]:null],
  ].filter(x=>x[2]!=null):[]
  return <details className="buyer-assistant"><summary>Describe what you need</summary><label>Your shopping request<textarea value={text} maxLength={2000} placeholder="A desk and chair under $150 near Oakland. I need delivery." onChange={e=>{version.current++;setText(e.target.value);setDraft(null);setPending(false)}} /></label><button type="button" className="secondary" disabled={pending||text.trim().length<3} onClick={parse}>{pending?'Reading your request…':'Review suggested requirements'}</button>{error&&<p role="alert">{error}</p>}{draft&&<div className="ai-panel"><h3>Choose fields to apply</h3>{fields.map(([key,label,value])=><label className="ai-suggestion" key={key}><input type="checkbox" checked={selected.includes(key!)} onChange={e=>setSelected(s=>e.target.checked?[...s,key!]:s.filter(k=>k!==key))}/><span><b>{label}</b><span>{value}</span></span></label>)}{draft.explanations.map((x,i)=><p key={i}>{x}</p>)}<p className="field-hint">Missing details stay unchanged. Select an address result before searching.</p><button type="button" className="secondary" disabled={!selected.length} onClick={()=>{const accepted={...draft};for(const key of ['categories','budget','buyer_has_car','location_text','ranking'])if(!selected.includes(key))Object.assign(accepted,{[key]:null});onApply(accepted);setDraft(null)}}>Apply selected requirements</button></div>}</details>
}
