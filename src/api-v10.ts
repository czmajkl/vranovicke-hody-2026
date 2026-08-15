export * from './api-v9'

import type { ShotKind } from './shot-kinds'

export type OwedShot = {
  id: string
  shot_kind: ShotKind
  accepted_at: string
  recipient_id: string
  recipient_name: string
  recipient_photo_data: string | null
}

export type PairSpiceStatus = {
  allowed: boolean
  spicy_count: number
  extra_allowed: boolean
}

type ApiError = { error?: string }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body && !headers.has('content-type')) headers.set('content-type', 'application/json')
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers,
  })
  const text = await response.text()
  let body: (T & ApiError) | null = null
  if (text) {
    try { body = JSON.parse(text) as T & ApiError } catch { body = null }
  }
  if (!response.ok) throw new Error(body?.error || `Server vrátil chybu ${response.status}.`)
  if (!body) throw new Error('Server poslal nečitelnú odpověď.')
  return body
}

export function getOwedShots() {
  return request<{ shots: OwedShot[] }>('/api/v10/shots/owed')
}

export function markShotDelivered(shotId: string) {
  return request<{ ok: true; delivered?: boolean; already_delivered?: boolean }>(`/api/v10/shots/${encodeURIComponent(shotId)}/delivered`, {
    method: 'POST',
    body: '{}',
  })
}

export function getPairSpiceStatus(personId: string) {
  return request<PairSpiceStatus>(`/api/v10/pair-spice?person_id=${encodeURIComponent(personId)}`)
}
