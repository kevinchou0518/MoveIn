import { useEffect, useRef, useState } from 'react'
import { api } from './api'
import { UserSwitcher, useSession } from './Auth'
import LocationPicker from './LocationPicker'
import type { Location, Seller } from './types'
import { navigate } from './navigation'

export default function AccountPage() {
  const session=useSession()
  const [profiles,setProfiles]=useState<Seller[]>([]), [selected,setSelected]=useState('')
  const [name,setName]=useState(''), [location,setLocation]=useState<Location|null>(null)
  const [canDrive,setCanDrive]=useState(false), [vehicle,setVehicle]=useState('truck')
  const [loading,setLoading]=useState(true), [saving,setSaving]=useState(false)
  const [loaded,setLoaded]=useState(false)
  const [error,setError]=useState(''), [success,setSuccess]=useState(''), [retry,setRetry]=useState(0)
  const pending=useRef(false), alive=useRef(true)
  useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
  function fill(profile?:Seller) {
    setSelected(profile?.id || '');setName(profile?.name || session.name || '')
    setLocation(profile?.location || null);setCanDrive(profile?.can_drive || false);setVehicle(profile?.vehicle_type || 'truck')
  }
  useEffect(()=>{
    let current=true;setLoading(true);setLoaded(false);setError('')
    api<{sellers:Seller[]}>('/me').then(me=>{
      if(!current)return
      setProfiles(me.sellers)
      setLoaded(true)
      fill(me.sellers.find(s=>s.id===session.userId) || me.sellers[0])
    }).catch(e=>{if(current)setError(e.message)}).finally(()=>{if(current)setLoading(false)})
    return()=>{current=false}
  },[session.userId,retry])
  async function save(e:React.FormEvent) {
    e.preventDefault();if(pending.current)return
    if(!location){setError('Choose a pickup address.');return}
    pending.current=true;setSaving(true);setError('');setSuccess('')
    try {
      const profile=await api<Seller>(selected?`/sellers/${selected}`:'/sellers',{method:selected?'PATCH':'POST',body:JSON.stringify({name,location,can_drive:canDrive,vehicle_type:canDrive?vehicle:null})})
      if(!alive.current)return
      setProfiles(items=>[...items.filter(p=>p.id!==profile.id),profile]);fill(profile)
      setSuccess('Profile settings saved.')
    } catch(e){if(alive.current)setError((e as Error).message)}
    finally {pending.current=false;if(alive.current)setSaving(false)}
  }
  return <main className="page-shell account-page"><h1 tabIndex={-1}>Profile & settings</h1><p>Every account can buy furniture, sell items, and manage orders and deliveries.</p>
    <section className="account-card"><h2>Your account</h2><UserSwitcher /><p>Switch users here to explore the demo. Each account keeps its own listings and orders.</p></section>
    <section className="account-card"><h2>Pickup & delivery settings</h2>
      {error && <p role="alert" className="error-message">{error}</p>}{success && <p role="status">{success}</p>}
      {loading?<p role="status">Loading profile…</p>:!loaded?<button className="secondary" onClick={()=>setRetry(n=>n+1)}>Retry profile</button>:<>
        {!profiles.length && <p>Set up your pickup details to publish your first listing.</p>}
        <form onSubmit={save}><fieldset disabled={saving}>

          <label>Display name<input required maxLength={80} value={name} onChange={e=>setName(e.target.value)} /></label>
          <LocationPicker label="Pickup address" value={location} onChange={setLocation} />
          <label className="checkbox-label"><input type="checkbox" checked={canDrive} onChange={e=>setCanDrive(e.target.checked)} />I can offer delivery</label>
          {canDrive && <label>Vehicle<select value={vehicle} onChange={e=>setVehicle(e.target.value)}><option value="sedan">Sedan</option><option value="suv">SUV</option><option value="truck">Truck</option></select></label>}
          <div className="dialog-actions"><button className="primary">{saving?'Saving…':'Save settings'}</button>{selected && <button type="button" className="secondary" onClick={()=>navigate(`/seller/${selected}/listings`)}>Manage my listings</button>}</div>
        </fieldset></form><button className="text-button" onClick={()=>setRetry(n=>n+1)} disabled={saving}>Reload saved settings</button>
      </>}
    </section></main>
}
