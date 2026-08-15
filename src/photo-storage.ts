export interface R2ObjectBodyLike {
  body: ReadableStream
  httpMetadata?: { contentType?: string }
}

export interface R2BucketLike {
  put(key: string, value: ArrayBuffer | ArrayBufferView | Blob | ReadableStream | string, options?: { httpMetadata?: { contentType?: string; cacheControl?: string } }): Promise<unknown>
  get(key: string): Promise<R2ObjectBodyLike | null>
  list(options?: { limit?: number }): Promise<unknown>
}

export interface PhotoStorageEnv {
  PHOTOS: R2BucketLike
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  GOOGLE_REFRESH_TOKEN?: string
}

export type DecodedImage = {
  bytes: Uint8Array
  contentType: string
  extension: string
}

export function decodeImageDataUrl(value: string): DecodedImage {
  const match = value.match(/^data:image\/(webp|jpeg|png);base64,(.+)$/i)
  if (!match) throw new Error('Neplatná webová fotka.')
  const format = match[1].toLowerCase()
  const binary = atob(match[2])
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  const contentType = format === 'jpeg' ? 'image/jpeg' : `image/${format}`
  const extension = format === 'jpeg' ? 'jpg' : format
  return { bytes, contentType, extension }
}

export async function putWebPhoto(env: PhotoStorageEnv, key: string, imageData: string) {
  const image = decodeImageDataUrl(imageData)
  await env.PHOTOS.put(key, image.bytes, {
    httpMetadata: {
      contentType: image.contentType,
      cacheControl: 'public, max-age=31536000, immutable',
    },
  })
  return image
}

export async function getWebPhoto(env: PhotoStorageEnv, key: string) {
  return env.PHOTOS.get(key)
}

function requireGoogleConfig(env: PhotoStorageEnv) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REFRESH_TOKEN) {
    throw new Error('Google Drive není připojený v Cloudflare Secrets.')
  }
  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    refreshToken: env.GOOGLE_REFRESH_TOKEN,
  }
}

export async function getGoogleAccessToken(env: PhotoStorageEnv) {
  const config = requireGoogleConfig(env)
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: config.refreshToken,
    grant_type: 'refresh_token',
  })

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  const payload = await response.json() as { access_token?: string; error?: string; error_description?: string }
  if (!response.ok || !payload.access_token) {
    console.error('google_token_failed', response.status, payload.error, payload.error_description)
    throw new Error('Google Drive odmítl obnovit přístup.')
  }
  return payload.access_token
}

function escapeDriveQuery(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

async function findDriveFolder(accessToken: string, name: string) {
  const q = `name='${escapeDriveQuery(name)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  const url = new URL('https://www.googleapis.com/drive/v3/files')
  url.searchParams.set('q', q)
  url.searchParams.set('spaces', 'drive')
  url.searchParams.set('fields', 'files(id,name)')
  url.searchParams.set('pageSize', '10')

  const response = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } })
  const payload = await response.json() as { files?: Array<{ id: string; name: string }>; error?: unknown }
  if (!response.ok) {
    console.error('drive_folder_search_failed', response.status, payload.error)
    throw new Error('Google Drive nejde prohledat.')
  }
  return payload.files?.[0]?.id ?? null
}

async function createDriveFolder(accessToken: string, name: string) {
  const response = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder' }),
  })
  const payload = await response.json() as { id?: string; error?: unknown }
  if (!response.ok || !payload.id) {
    console.error('drive_folder_create_failed', response.status, payload.error)
    throw new Error('Google Drive nevytvořil archivní složku.')
  }
  return payload.id
}

export async function ensureArchiveFolder(env: PhotoStorageEnv) {
  const accessToken = await getGoogleAccessToken(env)
  const folderName = 'Vranovické hody 2026'
  const existing = await findDriveFolder(accessToken, folderName)
  const folderId = existing ?? await createDriveFolder(accessToken, folderName)
  return { accessToken, folderId }
}

function safeFilename(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'fotka'
}

export async function uploadOriginalToDrive(
  env: PhotoStorageEnv,
  file: File,
  ownerName: string,
  purpose: 'moment' | 'profile',
) {
  const { accessToken, folderId } = await ensureArchiveFolder(env)
  const now = new Date()
  const extension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() : undefined
  const fallbackExtension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const suffix = extension && /^[a-z0-9]{2,5}$/.test(extension) ? extension : fallbackExtension
  const stamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
  const filename = `${stamp}_${safeFilename(ownerName)}_${purpose}_${crypto.randomUUID().slice(0, 8)}.${suffix}`
  const metadata = { name: filename, parents: [folderId] }
  const contentType = file.type || 'application/octet-stream'

  const startResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json; charset=utf-8',
      'x-upload-content-type': contentType,
      'x-upload-content-length': String(file.size),
    },
    body: JSON.stringify(metadata),
  })

  const uploadUrl = startResponse.headers.get('location')
  if (!startResponse.ok || !uploadUrl) {
    const detail = await startResponse.text().catch(() => '')
    console.error('drive_resumable_start_failed', startResponse.status, detail.slice(0, 500))
    throw new Error('Google Drive nechce začít archivovat originál.')
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': contentType },
    body: file,
  })
  const payload = await uploadResponse.json() as { id?: string; name?: string; mimeType?: string; size?: string; error?: unknown }
  if (!uploadResponse.ok || !payload.id) {
    console.error('drive_resumable_upload_failed', uploadResponse.status, payload.error)
    throw new Error('Originál sa nepodařilo uložit na Google Drive.')
  }

  return {
    driveFileId: payload.id,
    driveName: payload.name ?? filename,
  }
}

export async function checkPhotoStorage(env: PhotoStorageEnv) {
  const status = { r2: false, drive: false }
  try {
    await env.PHOTOS.list({ limit: 1 })
    status.r2 = true
  } catch (error) {
    console.error('r2_health_failed', error)
  }
  try {
    await ensureArchiveFolder(env)
    status.drive = true
  } catch (error) {
    console.error('drive_health_failed', error)
  }
  return status
}
