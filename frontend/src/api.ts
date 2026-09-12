export class ApiError extends Error { constructor(message:string,public status:number) { super(message) } }
const BASE = import.meta.env?.VITE_API_URL || '/api'
let tokenGetter: (() => Promise<string>) | null = null
let identity: string | undefined
let generation = 0
export function configureApiAuth(getter: (() => Promise<string>) | null, subject?: string) {
  if (subject !== identity) { generation++; identity = subject }
  tokenGetter = getter
}
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const started = generation
  const headers = new Headers(options?.headers)
  if (!(options?.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  if (tokenGetter) {
    try { headers.set('Authorization', `Bearer ${await tokenGetter()}`) }
    catch { throw new ApiError('Choose a demo user and try again.', 401) }
  }
  if (started !== generation) throw new ApiError('Account changed. Reload this page.', 401)
  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, { ...options, headers })
  } catch { throw new Error('Could not connect. Check that the demo server is running and try again.') }
  if (started !== generation) throw new ApiError('Account changed. Reload this page.', 401)
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const detail = body?.detail
    throw new ApiError(typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map((d: { msg: string }) => d.msg).join(' ') : 'Something went wrong. Please try again.', response.status)
  }
  const data = await response.json() as T
  if (started !== generation) throw new ApiError('Account changed. Reload this page.', 401)
  return data
}
export const post = <T>(path: string, body?: unknown) => api<T>(path, { method: 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
