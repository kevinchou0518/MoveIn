import { useEffect, useState } from 'react'
import { post } from './api'
import type { Bundle } from './types'

// One request per bundle per page load, shared by every card or page that shows the same bundle.
// Failures stay cached too: when AI is off, cards simply omit the preview instead of retrying.
const renders = new Map<string, Promise<string>>()
export function requestRoomImage(id: string) {
  let pending = renders.get(id)
  if (!pending) {
    pending = post<{ room_image_url: string }>(`/bundles/${encodeURIComponent(id)}/room-image`).then(r => r.room_image_url)
    pending.catch(() => {})
    renders.set(id, pending)
  }
  return pending
}

export default function RoomPreview({ bundle }: { bundle: Bundle }) {
  const [url, setUrl] = useState(bundle.room_image_url || '')
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (bundle.room_image_url) { setUrl(bundle.room_image_url); return }
    let active = true
    requestRoomImage(bundle.id).then(u => { if (active && u) setUrl(u); else if (active) setFailed(true) }, () => { if (active) setFailed(true) })
    return () => { active = false }
  }, [bundle.id, bundle.room_image_url])
  if (failed) return null
  if (!url) return <div className="room-preview skeleton" role="status"><span className="sr-only">Sketching this room…</span></div>
  return <figure className="room-preview-figure"><img className="room-preview" src={url} alt="AI preview of a room furnished with this bundle's items" loading="lazy" /><figcaption className="preview-pill">AI preview</figcaption></figure>
}
