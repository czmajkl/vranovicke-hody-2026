import baseWorker from './worker-next'
import {
  checkPhotoStorage,
  decodeImageDataUrl,
  getWebPhoto,
  putWebPhoto,
  uploadOriginalToDrive,
  type PhotoStorageEnv,
} from './photo-storage'

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

type SessionUser = {
  id: string
  display_name: string
  bio: string | null
  profile_photo_key: string | null
  profile_photo_data: string | null
  gender: 'male' | 'female' | null
  dance_level: 'pro' | 'amateur' | 'wild' | null
  drink_preference: 'slivovica' | 'green' | 'dark' | 'anything' | 'none' | null
  is_available: number
}

const MAX_ORIGINAL_BYTES = 15 * 1024 * 1024
const MAX_PROFILE_DATA_LENGTH = 900_000
const MAX_MOMENT_DATA_LENGTH = 1_400_000

function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  const responseHeaders = new Headers(headers)
  responseHeaders.set('content-type', 'application/json; charset=utf-8')
  responseHeaders.set('cache-control', 'no-store')
  return new Response(JSON.stringify(data), { status, headers: responseHeaders })
}

async function parseJsonBody(request: Request) {
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
  const authRequest = new Request(url, {
    method: 'GET',
    headers: request.headers,
  })
  const response = await baseWorker.fetch(authRequest, env as never)
  if (!response.ok) return null
  const payload = await response.json() as { user?: SessionUser | null }
  return payload.user ?? null
}

async function media(request: Request, env: Env) {
  const url = new URL(request.url)
  const rawKey = url.pathname.slice('/media/'.length)
  if (!rawKey) return new Response('Nenalezeno.', { status: 404 })
  let key: string
  try {
    key = decodeURIComponent(rawKey)
  } catch {
    return new Response('Neplatná cesta.', { status: 400 })
  }
  if (key.includes('..')) return new Response('Neplatná cesta.', { status: 400 })

  const object = await getWebPhoto(env, key)
  if (!object) return new Response('Fotka tu není.', { status: 404 })
  const headers = new Headers()
  headers.set('content-type', object.httpMetadata?.contentType ?? 'application/octet-stream')
  headers.set('cache-control', 'public, max-age=31536000, immutable')
  headers.set('x-content-type-options', 'nosniff')
  return new Response(object.body, { headers })
}

async function storageHealth(env: Env) {
  const status = await checkPhotoStorage(env)
  return json({
    ok: status.r2 && status.drive,
    r2: status.r2 ? 'ready' : 'not_ready',
    drive: status.drive ? 'ready' : 'not_ready',
  }, status.r2 && status.drive ? 200 : 503)
}

async function archiveOriginal(request: Request, env: Env, user: SessionUser) {
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('multipart/form-data')) return json({ error: 'Originál mosí přijet jako formulář s fotkú.' }, 400)

  const form = await request.formData()
  const file = form.get('file')
  const purposeValue = form.get('purpose')
  const purpose = purposeValue === 'profile' ? 'profile' : purposeValue === 'moment' ? 'moment' : null
  if (!(file instanceof File) || !purpose) return json({ error: 'Chybí fotka nebo účel fotky.' }, 400)
  if (!file.type.startsWith('image/')) return json({ error: 'Tohle nevypadá jak fotka.' }, 400)
  if (file.size <= 0 || file.size > MAX_ORIGINAL_BYTES) return json({ error: 'Originál je moc veliký. Limit je 15 MB.' }, 413)

  const result = await uploadOriginalToDrive(env, file, user.display_name, purpose)
  return json({ ok: true, drive_file_id: result.driveFileId, drive_name: result.driveName }, 201)
}

async function saveProfilePhoto(request: Request, env: Env, user: SessionUser) {
  const body = await parseJsonBody(request)
  const imageData = typeof body?.image_data === 'string' ? body.image_data : ''
  const driveFileId = typeof body?.drive_file_id === 'string' ? body.drive_file_id.slice(0, 200) : ''
  if (!imageData || imageData.length > MAX_PROFILE_DATA_LENGTH) return json({ error: 'Profilová fotka je moc veliká nebo chybí.' }, 400)

  let image
  try {
    image = decodeImageDataUrl(imageData)
  } catch {
    return json({ error: 'Profilová fotka má divný formát.' }, 400)
  }

  const photoId = crypto.randomUUID()
  const key = `profiles/${user.id}/${photoId}.${image.extension}`
  await putWebPhoto(env, key, imageData)
  const mediaPath = `/media/${key}`

  await env.DB.batch([
    env.DB.prepare('UPDATE users SET profile_photo_key = ?1, profile_photo_data = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?3')
      .bind(key, mediaPath, user.id),
    env.DB.prepare(`
      INSERT INTO photos (
        id, author_user_id, r2_key, drive_file_id, web_photo_data, photo_type,
        original_archived_at, published_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, 'profile', ?6, CURRENT_TIMESTAMP)
    `).bind(photoId, user.id, key, driveFileId || null, mediaPath, driveFileId ? new Date().toISOString() : null),
  ])

  return json({
    user: {
      ...user,
      profile_photo_key: key,
      profile_photo_data: mediaPath,
    },
  })
}

async function saveMoment(request: Request, env: Env, user: SessionUser) {
  const body = await parseJsonBody(request)
  const imageData = typeof body?.image_data === 'string' ? body.image_data : ''
  const taggedUserId = typeof body?.tagged_user_id === 'string' ? body.tagged_user_id : ''
  const interactionId = typeof body?.interaction_id === 'string' ? body.interaction_id : ''
  const driveFileId = typeof body?.drive_file_id === 'string' ? body.drive_file_id.slice(0, 200) : ''
  if (!imageData || imageData.length > MAX_MOMENT_DATA_LENGTH) return json({ error: 'Momentka je moc veliká nebo chybí.' }, 400)
  if (taggedUserId === user.id) return json({ error: 'Sám sebe tagovat nemusíš.' }, 400)

  let image
  try {
    image = decodeImageDataUrl(imageData)
  } catch {
    return json({ error: 'Momentka má divný formát.' }, 400)
  }

  if (taggedUserId) {
    const tagged = await env.DB.prepare('SELECT id FROM users WHERE id = ?1 LIMIT 1').bind(taggedUserId).first<{ id: string }>()
    if (!tagged) return json({ error: 'Označeného člověka už tu nevidím.' }, 404)
  }
  if (interactionId) {
    const interaction = await env.DB.prepare('SELECT id FROM interactions WHERE id = ?1 LIMIT 1').bind(interactionId).first<{ id: string }>()
    if (!interaction) return json({ error: 'Ten hovor už v kronice není.' }, 404)
  }

  const photoId = crypto.randomUUID()
  const day = new Date().toISOString().slice(0, 10)
  const key = `moments/${day}/${photoId}.${image.extension}`
  await putWebPhoto(env, key, imageData)
  const mediaPath = `/media/${key}`

  const statements: D1PreparedStatement[] = [
    env.DB.prepare(`
      INSERT INTO photos (
        id, author_user_id, r2_key, drive_file_id, web_photo_data, interaction_id,
        photo_type, original_archived_at, published_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'moment', ?7, CURRENT_TIMESTAMP)
    `).bind(
      photoId,
      user.id,
      key,
      driveFileId || null,
      mediaPath,
      interactionId || null,
      driveFileId ? new Date().toISOString() : null,
    ),
    env.DB.prepare('INSERT INTO photo_tags (photo_id, user_id) VALUES (?1, ?2)').bind(photoId, user.id),
  ]
  if (taggedUserId) statements.push(env.DB.prepare('INSERT INTO photo_tags (photo_id, user_id) VALUES (?1, ?2)').bind(photoId, taggedUserId))

  try {
    await env.DB.batch(statements)
  } catch (error) {
    await env.PHOTOS.put(`orphaned/${key}.txt`, `D1 insert failed for ${key}`)
    console.error('photo_metadata_failed', error)
    return json({ error: 'Fotka je v R2, ale kronikář ji nezvládl zapsat. Zkus to znova.' }, 500)
  }

  return json({ ok: true, photo_id: photoId, media_url: mediaPath, archived: Boolean(driveFileId) }, 201)
}

async function handleStorageApi(request: Request, env: Env) {
  const url = new URL(request.url)
  if (request.method === 'GET' && url.pathname === '/api/storage-health') return storageHealth(env)

  const user = await currentUser(request, env)
  if (!user) return json({ error: 'Nejsi přihlášený.' }, 401)

  if (request.method === 'POST' && url.pathname === '/api/photos/original') return archiveOriginal(request, env, user)
  if (request.method === 'POST' && url.pathname === '/api/me/profile-photo') return saveProfilePhoto(request, env, user)
  if (request.method === 'POST' && url.pathname === '/api/photos') return saveMoment(request, env, user)
  return null
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/media/')) {
      try {
        return await media(request, env)
      } catch (error) {
        console.error('media_failed', error)
        return new Response('Fotka sa nepodařila načíst.', { status: 500 })
      }
    }

    if (url.pathname === '/api/storage-health' || url.pathname === '/api/photos/original' || url.pathname === '/api/me/profile-photo' || (url.pathname === '/api/photos' && request.method === 'POST')) {
      try {
        const response = await handleStorageApi(request, env)
        if (response) return response
      } catch (error) {
        console.error('storage_api_failed', error)
        return json({ error: error instanceof Error ? error.message : 'Fotkový backend sa někde zamotal.' }, 500)
      }
    }

    return baseWorker.fetch(request, env as never)
  },
}
