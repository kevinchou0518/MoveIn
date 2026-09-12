import {useRef, useState} from 'react'
import {MapPin} from 'lucide-react'
import LocationPicker from './LocationPicker'
import type {Location, Seller} from './types'

export default function SellerPickup({seller,onSave}:{seller:Seller;onSave:(location:Location)=>Promise<void>}) {
  const [editing,setEditing]=useState(false), [draft,setDraft]=useState<Location|null>(seller.location)
  const [error,setError]=useState(''), [saving,setSaving]=useState(false)
  const pending=useRef(false)
  async function save() {
    if(!draft || pending.current)return
    pending.current=true;setSaving(true);setError('')
    try {await onSave(draft);setEditing(false)}
    catch(e){setError((e as Error).message)}
    finally {pending.current=false;setSaving(false)}
  }
  return <div className="seller-pickup">
    <div className="pickup-heading"><MapPin size={17} /><div><b>Pickup address</b><p>{seller.location.label || 'Choose an address'}</p></div>{!editing && <button className="text-button" type="button" onClick={()=>{setDraft(seller.location);setError('');setEditing(true)}}>Change address</button>}</div>
    {editing && <div className="pickup-editor"><LocationPicker label="Seller pickup address" value={draft} onChange={setDraft} />{error && <p role="alert" className="error-message">{error}</p>}<div className="dialog-actions"><button className="secondary" type="button" disabled={saving} onClick={()=>setEditing(false)}>Cancel address change</button><button className="primary" type="button" disabled={saving || !draft} onClick={save}>{saving?'Saving…':'Save address'}</button></div></div>}
  </div>
}
