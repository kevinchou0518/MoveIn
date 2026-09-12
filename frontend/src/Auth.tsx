import { createContext, useContext, useState, type ReactNode } from 'react'
import { configureApiAuth } from './api'
import { navigate } from './navigation'
import { clearSearches } from './searchSession'

export const demoUsers = [
  {id:'maya', name:'Maya Chen'},
  {id:'jordan', name:'Jordan Brooks'},
  {id:'alex', name:'Alex Rivera'},
  {id:'sam', name:'Sam Patel'},
  {id:'riley', name:'Riley Morgan'},
  {id:'jamie', name:'Jamie Park'},
  {id:'distant', name:'Taylor Reed'},
]
const legacyUsers: Record<string,string> = {'demo-buyer':'maya','demo-buyer-2':'jordan','demo-seller':'riley'}
type Session = { configured:boolean; authenticated:boolean; loading:boolean; name?:string; userId?:string; selectUser?:(id:string)=>void; login:()=>void; logout:()=>void }
export const AuthContext = createContext<Session>({configured:true,authenticated:true,loading:false,login:()=>{},logout:()=>{}})
export const useSession = () => useContext(AuthContext)
function initialUser() {
  try { const stored=window.sessionStorage.getItem('demo-user') || ''; const id=legacyUsers[stored] || stored; if(demoUsers.some(u=>u.id===id))return id! } catch {}
  return 'maya'
}
export function LoginProvider({children}:{children:ReactNode}) {
  const [userId,setUserId]=useState(initialUser)
  configureApiAuth(async()=>userId,userId)
  function selectUser(id:string) {
    if (!demoUsers.some(u=>u.id===id) || id===userId)return
    configureApiAuth(async()=>id,id)
    clearSearches()
    try {window.sessionStorage.removeItem('buyer-preferences');window.sessionStorage.setItem('demo-user',id)} catch {}
    navigate('/account',true)
    setUserId(id)
  }
  return <AuthContext.Provider value={{configured:true,authenticated:true,loading:false,userId,name:demoUsers.find(u=>u.id===userId)?.name,selectUser,login:()=>{},logout:()=>selectUser('maya')}}><div key={userId}>{children}</div></AuthContext.Provider>
}
export function UserSwitcher() {
  const session=useSession()
  return <label className="demo-user-switch">Current user<select aria-label="Current user" value={session.userId || 'maya'} onChange={e=>session.selectUser?.(e.target.value)}>{demoUsers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
}
export function LoginRequired({children}:{children:ReactNode}) {return <>{children}</>}
