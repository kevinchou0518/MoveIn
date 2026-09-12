import { useRef, useState, useEffect } from 'react'
import { post } from './api'
import type { BuyerDraft } from './types'
import { Check, WandSparkles } from 'lucide-react'
export default function BuyerAssistant({onApply}:{onApply:(draft:BuyerDraft)=>void}) {
  const [text,setText]=useState(''),[draft,setDraft]=useState<BuyerDraft|null>(null),[pending,setPending]=useState(false),[error,setError]=useState('')
  const version=useRef(0)
  useEffect(()=>()=>{version.current++},[])
  // Parsed fields are applied to the form as soon as they arrive; the panel only reports what changed.
  async function parse(){const id=++version.current;setPending(true);setError('');setDraft(null);try{const value=await post<BuyerDraft>('/buyer/parse',{text});if(id===version.current){onApply(value);setDraft(value)}}catch(e){if(id===version.current)setError((e as Error).message)}finally{if(id===version.current)setPending(false)}}
  const fields = draft ? [
    draft.categories?.length ? 'categories' : null,
    draft.budget != null ? 'budget' : null,
    draft.buyer_has_car != null ? 'transportation' : null,
    draft.buyer_location || draft.location_text ? 'location' : null,
    draft.ranking ? 'priority' : null,
  ].filter((field): field is string => field !== null) : []
  const updated = fields.length > 1 ? `${fields.slice(0, -1).join(', ')} and ${fields.at(-1)}` : fields[0]
  return <section className="buyer-assistant">
    <h3 className="buyer-assistant-title">Describe what you need</h3>
    <textarea aria-label="Your shopping request" rows={3} value={text} maxLength={2000}
      placeholder="A desk and chair under $150 near Oakland. I need delivery."
      onChange={e=>{version.current++;setText(e.target.value);setDraft(null);setError('');setPending(false)}} />
    <button type="button" className="buyer-autofill-button" disabled={pending||text.trim().length<3} onClick={parse}>
      <WandSparkles size={16} aria-hidden="true" />{pending?'Filling…':'Auto-fill preferences'}
    </button>
    {error && <p className="buyer-autofill-error" role="alert">{error}</p>}
    {draft && <div className="buyer-autofill-feedback" role="status">
      <p className="buyer-autofill-status">
        {fields.length > 0 && <Check size={16} aria-hidden="true" />}
        <span>{fields.length ? `Updated ${updated}.` : 'No preferences found. Try adding more detail.'}</span>
      </p>
      {draft.explanations.length > 0 && <details className="buyer-autofill-notes">
        <summary>{draft.explanations.length === 1 ? '1 note to review' : `${draft.explanations.length} notes to review`}</summary>
        {draft.explanations.map((note,i)=><p key={i}>{note}</p>)}
      </details>}
    </div>}
  </section>
}
