export * from './api-v7'

export type GenerosityRow = {
  id: string
  display_name: string
  profile_photo_data: string | null
  shot_count: number
  wine_count: number
  generosity_count: number
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

export function donateWineBottle() {
  return request<{ ok: true; donation_id: string; bottles: number }>('/api/v8/wine-donations', {
    method: 'POST',
    body: '{}',
  })
}

export function getGenerosity() {
  return request<{ rows: GenerosityRow[] }>('/api/v8/generosity')
}
