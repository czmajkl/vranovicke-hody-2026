import baseWorker from './worker-v12'
import type { PhotoStorageEnv } from './photo-storage'

interface D1Result<T = Record<string, unknown>> {
  success: boolean
  results?: T[]
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>
}

interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>
}

interface AssetsBinding {
  fetch(request: Request): Promise<Response>
}

interface Env extends PhotoStorageEnv {
  DB: D1Database
  ASSETS: AssetsBinding
}

type SessionUser = { id: string }
type ListedUser = { id: string; [key: string]: unknown }
type PhotoRow = { id: string; [key: string]: unknown }

const FEED_ONLY_CAPTION = '__feed_only__'

function json(data: unknown, status = 200, headers?: HeadersInit) {
  const next = new Headers(headers)
  next.delete('content-length')
  next.set('content-type', 'application/json; charset=utf-8')
  next.set('cache-control', 'no-store')
  return new Response(JSON.stringify(data), { status, headers: next })
}

async function parseBody(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) return null
  try {
    return await request.json() as Record<string, unknown>
  } catch {
    return null
  }
}

async function currentUser(request: Request, env: Env): Promise<SessionUser | null> {
  const url = new URL(request.url)
  url.pathname = '/api/me'
  url.search = ''
  const response = await baseWorker.fetch(new Request(url, { method: 'GET', headers: request.headers }), env as never)
  if (!response.ok) return null
  const payload = await response.json() as { user?: SessionUser | null }
  return payload.user ?? null
}

function hashString(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function shuffledForSession<T extends ListedUser>(items: T[], seed: string) {
  return [...items].sort((a, b) => {
    const aHash = hashString(`${seed}:${a.id}`)
    const bHash = hashString(`${seed}:${b.id}`)
    return aHash === bHash ? a.id.localeCompare(b.id) : aHash - bHash
  })
}

async function randomizedUsers(request: Request, env: Env) {
  const response = await baseWorker.fetch(request, env as never)
  if (!response.ok) return response
  const payload = await response.json() as { users?: ListedUser[]; [key: string]: unknown }
  const cookie = request.headers.get('cookie') ?? ''
  if (!cookie.includes('hody_session=')) return json(payload, response.status, response.headers)
  return json({ ...payload, users: shuffledForSession(payload.users ?? [], cookie) }, response.status, response.headers)
}

async function freeMoment(request: Request, env: Env) {
  const user = await currentUser(request, env)
  if (!user) return json({ error: 'Nejsi přihlášený.' }, 401)

  const body = await parseBody(request)
  if (!body) return json({ error: 'Momentku sa nepodařilo přečíst.' }, 400)
  const imageData = typeof body.image_data === 'string' ? body.image_data : ''
  const driveFileId = typeof body.drive_file_id === 'string' ? body.drive_file_id.slice(0, 200) : ''
  const taggedUserId = typeof body.tagged_user_id === 'string' ? body.tagged_user_id : ''

  if (taggedUserId === user.id) return json({ error: 'Sám sebe vybírat nemusíš.' }, 400)
  if (taggedUserId) {
    const tagged = await env.DB.prepare('SELECT id FROM users WHERE id = ?1 LIMIT 1').bind(taggedUserId).first<{ id: string }>()
    if (!tagged) return json({ error: 'Vybraného člověka už tu nevidím.' }, 404)
  }

  const url = new URL(request.url)
  url.pathname = '/api/photos'
  url.search = ''
  const headers = new Headers(request.headers)
  headers.set('content-type', 'application/json')
  headers.delete('content-length')
  const stored = await baseWorker.fetch(new Request(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      image_data: imageData,
      drive_file_id: driveFileId || undefined,
      tagged_user_id: taggedUserId || undefined,
    }),
  }), env as never)

  if (!stored.ok) return stored
  const photo = await stored.json() as { ok?: boolean; photo_id?: string; media_url?: string; archived?: boolean }
  if (!photo.photo_id) return json({ error: 'Fotka sa uložila, ale chybí jí záznam.' }, 500)

  await env.DB.batch([
    env.DB.prepare('UPDATE photos SET caption = ?1 WHERE id = ?2 AND author_user_id = ?3')
      .bind(FEED_ONLY_CAPTION, photo.photo_id, user.id),
    env.DB.prepare('INSERT INTO score_events (id, user_id, event_type, points, source_id) VALUES (?1, ?2, ?3, 1, ?4)')
      .bind(crypto.randomUUID(), user.id, 'free_moment', photo.photo_id),
  ])

  return json({ ...photo, ok: true, points: 1 }, 201)
}

async function myPhotosWithoutFeedOnly(request: Request, env: Env) {
  const response = await baseWorker.fetch(request, env as never)
  if (!response.ok) return response
  const payload = await response.json() as { photos?: PhotoRow[]; [key: string]: unknown }
  const hidden = await env.DB.prepare('SELECT id FROM photos WHERE caption = ?1')
    .bind(FEED_ONLY_CAPTION)
    .all<{ id: string }>()
  const hiddenIds = new Set((hidden.results ?? []).map((row) => row.id))
  return json({ ...payload, photos: (payload.photos ?? []).filter((photo) => !hiddenIds.has(photo.id)) }, response.status, response.headers)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    try {
      if (request.method === 'GET' && url.pathname === '/api/users') return randomizedUsers(request, env)
      if (request.method === 'POST' && url.pathname === '/api/v13/free-moment') return freeMoment(request, env)
      if (request.method === 'GET' && url.pathname === '/api/photos/mine') return myPhotosWithoutFeedOnly(request, env)
      return baseWorker.fetch(request, env as never)
    } catch (error) {
      console.error('v13_social_failed', error)
      return json({ error: error instanceof Error ? error.message : 'Nová hodová logika sa někde zamotala.' }, 500)
    }
  },
}
