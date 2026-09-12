import { useRef, useState, useEffect } from 'react'
import { post } from './api'
import type { BuyerDraft } from './types'
import { categoryLabel } from './catalog'
import { rankingNames } from './types'
export default function BuyerAssistant({onApply}:{onApply:(draft:BuyerDraft)=>void}) {
  const [text,setText]=useState(''),[draft,setDraft]=useState<BuyerDraft|null>(null),[pending,setPending]=useState(false),[error,setError]=useState('')
  const version=useRef(0)
  useEffect(()=>()=>{version.current++},[])
  // Parsed fields are applied to the form as soon as they arrive; the panel only reports what changed.
  async function parse(){const id=++version.current;setPending(true);setError('');setDraft(null);try{const value=await post<BuyerDraft>('/buyer/parse',{text});if(id===version.current){onApply(value);setDraft(value)}}catch(e){if(id===version.current)setError((e as Error).message)}finally{if(id===version.current)setPending(false)}}
  const fields=draft ? [
    ['categories','Categories',draft.categories?.map(categoryLabel).join(', ')],['budget','Furniture budget',draft.budget==null?null:`$${draft.budget}`],['buyer_has_car','Transportation',draft.buyer_has_car==null?null:draft.buyer_has_car?'Self-pickup':'Seller delivery'],['location','Location',draft.buyer_location?draft.buyer_location.label||`${draft.buyer_location.lat}, ${draft.buyer_location.lng}`:draft.location_text],['ranking','Priority',draft.ranking?rankingNames[draft.ranking]:null],
  ].filter(x=>x[2]!=null):[]
  return <details className="buyer-assistant"><summary>Describe what you need</summary><label>Your shopping request<textarea value={text} maxLength={2000} placeholder="A desk and chair under $150 near Oakland. I need delivery." onChange={e=>{version.current++;setText(e.target.value);setDraft(null);setPending(false)}} /></label><button type="button" className="secondary" disabled={pending||text.trim().length<3} onClick={parse}>{pending?'Reading your request…':'Fill in my requirements'}</button>{error&&<p role="alert">{error}</p>}{draft&&<div className="ai-panel" role="status"><h3>{fields.length?'Applied to the form below':'Nothing to apply'}</h3>{fields.map(([key,label,value])=><p className="ai-suggestion" key={key}><b>{label}</b><span>{value}</span></p>)}{draft.explanations.map((x,i)=><p key={i}>{x}</p>)}<p className="field-hint">Missing details stay unchanged. Adjust anything below before building your bundle.</p></div>}</details>
}
