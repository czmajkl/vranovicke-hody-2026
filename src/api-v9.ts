export * from './api-v8'

import type { ApiUser } from './api-v8'

export type RelationshipStatus = 'looking' | 'fate' | 'third' | 'not_looking' | 'taken'

export type ApiUserV9 = ApiUser & {
  relationship_status: RelationshipStatus
}

type ApiError = { error?: string }

async function request<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: 'same-origin' })
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

export function getMeV9() {
  return request<{ user: ApiUserV9 | null }>('/api/me')
}

export function getUsersV9() {
  return request<{ users: ApiUserV9[] }>('/api/users')
}
