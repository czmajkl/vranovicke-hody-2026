export * from './api-v6'
export { SHOT_KINDS, shotKindLabel, type ShotKind } from './shot-kinds'

import type { ShotKind } from './shot-kinds'

export type V7PendingShot = {
  id: string
  created_at: string
  shot_kind: ShotKind
  giver_id: string
  giver_name: string
  giver_photo_data: string | null
  forwarded_by_id: string | null
  forwarded_by_name: string | null
  forwarded_by_photo_data: string | null
}

export type PhotoChallengeStatus = {
  challenge: {
    id: string
    text: string
  }
  completed: number
  total: number
  needed: number
  achievement: {
    id: string
    name: string
    earned: boolean
  }
  seconds_until_change: number
}

type ApiError = { error?: string }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: init?.body ? { 'content-type': 'application/json', ...(init.headers ?? {}) } : init?.headers,
    ...init,
  })
  const text = await response.text()
  let body: (T & ApiError) | null = null
  if (text) {
    try {
      body = JSON.parse(text) as T & ApiError
    } catch {
      body = null
    }
  }
  if (!response.ok) throw new Error(body?.error || `Server vrátil chybu ${response.status}.`)
  if (!body) throw new Error('Server poslal nečitelnú odpověď.')
  return body
}

export function buySpecificShot(recipientUserId: string, shotKind: ShotKind) {
  return request<{ ok: true; shot_id: string; shot_kind: ShotKind }>('/api/v7/shots', {
    method: 'POST',
    body: JSON.stringify({ recipient_user_id: recipientUserId, shot_kind: shotKind }),
  })
}

export function getV7PendingShots() {
  return request<{ shots: V7PendingShot[] }>('/api/v7/shots/mine')
}

export function getPhotoChallenge() {
  return request<PhotoChallengeStatus>('/api/v7/photo-challenge')
}

export function completePhotoChallenge(challengeId: string, photoId: string) {
  return request<{
    ok: true
    completed: number
    total: number
    needed: number
    achievement_earned: boolean
  }>('/api/v7/photo-challenge/complete', {
    method: 'POST',
    body: JSON.stringify({ challenge_id: challengeId, photo_id: photoId }),
  })
}
