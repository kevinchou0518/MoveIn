export class ApiError extends Error { constructor(message:string,public status:number) { super(message) } }
const BASE = import.meta.env?.VITE_API_URL || '/api'
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, { ...options, headers: { ...(options?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...options?.headers } })
  } catch { throw new Error('Could not connect. Check that the demo server is running and try again.') }
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const detail = body?.detail
    throw new ApiError(typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map((d: { msg: string }) => d.msg).join(' ') : 'Something went wrong. Please try again.', response.status)
  }
  return response.json() as Promise<T>
}
export const post = <T>(path: string, body?: unknown) => api<T>(path, { method: 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
