import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import LocationPicker from './LocationPicker'
import type { Location } from './types'

export default function BuyerLocation({value,initialQuery,onChange,onEditingChange}:{value:Location|null;initialQuery:string;onChange:(value:Location)=>void;onEditingChange:(editing:boolean)=>void}) {
  const [editing,setEditing]=useState(!value)
  const [draft,setDraft]=useState(value)
  useEffect(()=>{onEditingChange(editing);return()=>onEditingChange(false)},[editing,onEditingChange])
  return <div className="seller-pickup buyer-address">
    <div className="pickup-heading"><MapPin size={17}/><div><b>Delivery address</b><p>{value?.label || 'Choose an address'}</p></div>{!editing && <button type="button" className="text-button" onClick={()=>{setDraft(value);setEditing(true)}}>Change address</button>}</div>
    {editing && <div className="pickup-editor">
      <LocationPicker label="Buyer location" value={draft} initialQuery={initialQuery} onChange={setDraft}/>
      <div className="dialog-actions">{value && <button type="button" className="secondary" onClick={()=>setEditing(false)}>Cancel address change</button>}<button type="button" className="primary" disabled={!draft} onClick={()=>{if(draft){setEditing(false);onChange(draft)}}}>Save address</button></div>
    </div>}
  </div>
}
