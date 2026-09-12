import { createContext, useContext, useState, type ReactNode } from 'react'
import { configureApiAuth } from './api'
import { navigate } from './navigation'
import { clearSearches } from './searchSession'

export const demoUsers = [
  {id:'demo-buyer', name:'Demo buyer'},
  {id:'demo-buyer-2', name:'Second buyer'},
  {id:'demo-seller', name:'Demo seller'},
]
type Session = { configured:boolean; authenticated:boolean; loading:boolean; name?:string; userId?:string; selectUser?:(id:string)=>void; login:()=>void; logout:()=>void }
export const AuthContext = createContext<Session>({configured:true,authenticated:true,loading:false,login:()=>{},logout:()=>{}})
export const useSession = () => useContext(AuthContext)
function initialUser() {
  try { const id=window.sessionStorage.getItem('demo-user'); if(demoUsers.some(u=>u.id===id))return id! } catch {}
  return 'demo-buyer'
}
export function LoginProvider({children}:{children:ReactNode}) {
  const [userId,setUserId]=useState(initialUser)
  configureApiAuth(async()=>userId,userId)
  function selectUser(id:string) {
    if (!demoUsers.some(u=>u.id===id) || id===userId)return
    configureApiAuth(async()=>id,id)
    clearSearches()
    try {window.sessionStorage.removeItem('buyer-preferences');window.sessionStorage.setItem('demo-user',id)} catch {}
    navigate(id==='demo-seller'?'/seller':'/buyer',true)
    setUserId(id)
  }
  return <AuthContext.Provider value={{configured:true,authenticated:true,loading:false,userId,name:demoUsers.find(u=>u.id===userId)?.name,selectUser,login:()=>{},logout:()=>selectUser('demo-buyer')}}><div key={userId}>{children}</div></AuthContext.Provider>
}
export function UserSwitcher() {
  const session=useSession()
  return <label className="demo-user-switch">Demo user<select aria-label="Demo user" value={session.userId || 'demo-buyer'} onChange={e=>session.selectUser?.(e.target.value)}>{demoUsers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
}
export function LoginRequired({children}:{children:ReactNode}) {return <>{children}</>}
export function AccountPage() {
  return <main className="page-shell"><h1>Your demo account</h1><UserSwitcher /><p>Switch between buyers and the seller to try orders, inventory, and delivery. No sign-in is needed.</p></main>
}
