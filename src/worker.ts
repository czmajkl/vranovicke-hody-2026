const SESSION_COOKIE = 'hody_session'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30
const PBKDF2_ITERATIONS = 600_000

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

interface Env {
  DB: D1Database
  ASSETS: AssetsBinding
}

type PublicUser = {
  id: string
  display_name: string
  bio: string | null
  profile_photo_key: string | null
  is_available: number
}

type UserWithPassword = PublicUser & {
  username_norm: string
  password_hash: string
}

type SessionUser = PublicUser & {
  session_id: string
}

type InviteRow = {
  id: string
  inviter_user_id: string
}

const encoder = new TextEncoder()

function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  const responseHeaders = new Headers(headers)
  responseHeaders.set('content-type', 'application/json; charset=utf-8')
  responseHeaders.set('cache-control', 'no-store')
  return new Response(JSON.stringify(data), { status, headers: responseHeaders })
}

function normalizeName(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('cs-CZ')
}

function sqlDate(date: Date) {
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

function randomBytes(length: number) {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return bytesToBase64Url(new Uint8Array(digest))
}

async function hashPassword(password: string) {
  const salt = randomBytes(16)
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },
    key,
    256,
  )
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${bytesToBase64Url(salt)}$${bytesToBase64Url(new Uint8Array(bits))}`
}

async function verifyPassword(password: string, stored: string) {
  const [algorithm, iterationText, saltText, hashText] = stored.split('$')
  const iterations = Number(iterationText)
  if (algorithm !== 'pbkdf2-sha256' || !Number.isSafeInteger(iterations) || iterations < 1 || !saltText || !hashText) return false

  const salt = base64UrlToBytes(saltText)
  const expected = base64UrlToBytes(hashText)
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    expected.byteLength * 8,
  ))

  if (bits.byteLength !== expected.byteLength) return false
  let difference = 0
  for (let index = 0; index < bits.byteLength; index += 1) difference |= bits[index] ^ expected[index]
  return difference === 0
}

function parseCookies(request: Request) {
  const cookies = new Map<string, string>()
  const header = request.headers.get('cookie') ?? ''
  for (const part of header.split(';')) {
    const separator = part.indexOf('=')
    if (separator === -1) continue
    cookies.set(part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1).trim()))
  }
  return cookies
}

function sessionCookie(token: string, maxAge = SESSION_TTL_SECONDS) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
}

async function createSession(db: D1Database, userId: string) {
  const token = bytesToBase64Url(randomBytes(32))
  const tokenHash = await sha256(token)
  const sessionId = crypto.randomUUID()
  const expiresAt = sqlDate(new Date(Date.now() + SESSION_TTL_SECONDS * 1000))

  await db.prepare(
    'INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?1, ?2, ?3, ?4)',
  ).bind(sessionId, userId, tokenHash, expiresAt).run()

  return token
}

async function getSessionUser(request: Request, db: D1Database) {
  const token = parseCookies(request).get(SESSION_COOKIE)
  if (!token) return null
  const tokenHash = await sha256(token)
  return db.prepare(`
    SELECT s.id AS session_id, u.id, u.display_name, u.bio, u.profile_photo_key, u.is_available
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?1 AND s.expires_at > CURRENT_TIMESTAMP
    LIMIT 1
  `).bind(tokenHash).first<SessionUser>()
}

async function parseJsonBody(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) return null
  try {
    return await request.json() as Record<string, unknown>
  } catch {
    return null
  }
}

async function register(request: Request, env: Env) {
  const body = await parseJsonBody(request)
  if (!body) return json({ error: 'Neplatná data.' }, 400)

  const displayName = typeof body.name === 'string' ? body.name.normalize('NFKC').trim().replace(/\s+/g, ' ') : ''
  const usernameNorm = normalizeName(displayName)
  const password = typeof body.password === 'string' ? body.password : ''
  const bio = typeof body.bio === 'string' ? body.bio.normalize('NFKC').trim().slice(0, 120) : ''
  const ref = typeof body.ref === 'string' ? body.ref.trim().slice(0, 100) : ''

  if (displayName.length < 2 || displayName.length > 40) return json({ error: 'Jméno musí mít 2 až 40 znaků.' }, 400)
  if (password.length < 10 || password.length > 128) return json({ error: 'Heslo musí mít 10 až 128 znaků.' }, 400)

  const existing = await env.DB.prepare('SELECT id FROM users WHERE username_norm = ?1 LIMIT 1').bind(usernameNorm).first<{ id: string }>()
  if (existing) return json({ error: 'Tohle jméno už ve hře je.' }, 409)

  let inviterUserId: string | null = null
  let invite: InviteRow | null = null
  if (ref) {
    invite = await env.DB.prepare('SELECT id, inviter_user_id FROM invites WHERE code = ?1 AND claimed_by_user_id IS NULL LIMIT 1').bind(ref).first<InviteRow>()
    if (invite) {
      inviterUserId = invite.inviter_user_id
    } else {
      const inviter = await env.DB.prepare('SELECT id FROM users WHERE username_norm = ?1 LIMIT 1').bind(normalizeName(ref)).first<{ id: string }>()
      inviterUserId = inviter?.id ?? null
    }
  }

  const userId = crypto.randomUUID()
  const passwordHash = await hashPassword(password)
  const token = bytesToBase64Url(randomBytes(32))
  const tokenHash = await sha256(token)
  const sessionId = crypto.randomUUID()
  const expiresAt = sqlDate(new Date(Date.now() + SESSION_TTL_SECONDS * 1000))

  const statements = [
    env.DB.prepare(`
      INSERT INTO users (id, display_name, username_norm, password_hash, bio, inviter_user_id)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6)
    `).bind(userId, displayName, usernameNorm, passwordHash, bio || null, inviterUserId),
    env.DB.prepare('INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?1, ?2, ?3, ?4)')
      .bind(sessionId, userId, tokenHash, expiresAt),
  ]

  if (invite) {
    statements.push(
      env.DB.prepare('UPDATE invites SET claimed_by_user_id = ?1, claimed_at = CURRENT_TIMESTAMP WHERE id = ?2 AND claimed_by_user_id IS NULL')
        .bind(userId, invite.id),
    )
  }

  try {
    await env.DB.batch(statements)
  } catch (error) {
    console.error('register_failed', error)
    return json({ error: 'Profil se nepodařilo vytvořit.' }, 500)
  }

  return json(
    { user: { id: userId, display_name: displayName, bio: bio || null, profile_photo_key: null, is_available: 1 } },
    201,
    { 'set-cookie': sessionCookie(token) },
  )
}

async function login(request: Request, env: Env) {
  const body = await parseJsonBody(request)
  if (!body) return json({ error: 'Neplatná data.' }, 400)

  const name = typeof body.name === 'string' ? body.name : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!name || !password || password.length > 128) return json({ error: 'Jméno nebo heslo nesedí.' }, 401)

  const user = await env.DB.prepare(`
    SELECT id, display_name, username_norm, password_hash, bio, profile_photo_key, is_available
    FROM users WHERE username_norm = ?1 LIMIT 1
  `).bind(normalizeName(name)).first<UserWithPassword>()

  if (!user || !(await verifyPassword(password, user.password_hash))) return json({ error: 'Jméno nebo heslo nesedí.' }, 401)

  await env.DB.prepare('DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP').run()
  const token = await createSession(env.DB, user.id)

  return json(
    { user: { id: user.id, display_name: user.display_name, bio: user.bio, profile_photo_key: user.profile_photo_key, is_available: user.is_available } },
    200,
    { 'set-cookie': sessionCookie(token) },
  )
}

async function logout(request: Request, env: Env) {
  const token = parseCookies(request).get(SESSION_COOKIE)
  if (token) {
    const tokenHash = await sha256(token)
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?1').bind(tokenHash).run()
  }
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0) })
}

async function listUsers(env: Env) {
  const result = await env.DB.prepare(`
    SELECT id, display_name, bio, profile_photo_key, is_available
    FROM users
    ORDER BY display_name COLLATE NOCASE ASC
  `).all<PublicUser>()
  return json({ users: result.results ?? [] })
}

async function handleApi(request: Request, env: Env) {
  const url = new URL(request.url)

  if (request.method === 'GET' && url.pathname === '/api/health') {
    return json({ ok: true, database: 'connected' })
  }

  if (request.method === 'GET' && url.pathname === '/api/users') return listUsers(env)
  if (request.method === 'POST' && url.pathname === '/api/register') return register(request, env)
  if (request.method === 'POST' && url.pathname === '/api/login') return login(request, env)
  if (request.method === 'POST' && url.pathname === '/api/logout') return logout(request, env)

  if (request.method === 'GET' && url.pathname === '/api/me') {
    const user = await getSessionUser(request, env.DB)
    if (!user) return json({ user: null }, 401)
    return json({ user: { id: user.id, display_name: user.display_name, bio: user.bio, profile_photo_key: user.profile_photo_key, is_available: user.is_available } })
  }

  return json({ error: 'Nenalezeno.' }, 404)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/')) return handleApi(request, env)
    return env.ASSETS.fetch(request)
  },
}
