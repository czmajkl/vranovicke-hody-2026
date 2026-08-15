import baseWorker from './worker-v13'
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

const PBKDF2_ITERATIONS = 10_000
const encoder = new TextEncoder()

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

async function parseBody(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) return null
  try {
    return await request.json() as Record<string, unknown>
  } catch {
    return null
  }
}

function normalizeName(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()
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

function jsonRequest(request: Request, body: Record<string, unknown>) {
  const headers = new Headers(request.headers)
  headers.set('content-type', 'application/json')
  headers.delete('content-length')
  return new Request(request.url, {
    method: request.method,
    headers,
    body: JSON.stringify(body),
  })
}

async function registrationWithoutRecoveryPin(request: Request, env: Env) {
  const body = await parseBody(request)
  if (!body) return baseWorker.fetch(request, env as never)

  // V12 still expects a four-digit recovery PIN internally. It is no longer part
  // of the product, so give the legacy layer a harmless placeholder.
  return baseWorker.fetch(jsonRequest(request, { ...body, recovery_pin: '0000' }), env as never)
}

async function openPasswordReset(request: Request, env: Env) {
  const body = await parseBody(request)
  const english = body?.language === 'en'
  const name = typeof body?.name === 'string' ? body.name : ''
  const password = typeof body?.new_password === 'string' ? body.new_password : ''

  if (!name || password.length < 4 || password.length > 128) {
    return json({ error: english ? 'Choose an account and enter a new password with at least 4 characters.' : 'Vyber účet a zadej nové heslo aspoň na 4 znaky.' }, 400)
  }

  const user = await env.DB.prepare('SELECT id FROM users WHERE username_norm = ?1 LIMIT 1')
    .bind(normalizeName(name))
    .first<{ id: string }>()

  if (!user) {
    return json({ error: english ? 'That account no longer exists.' : 'Ten účet už tu není.' }, 404)
  }

  const passwordHash = await hashPassword(password)
  await env.DB.prepare('UPDATE users SET password_hash = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2')
    .bind(passwordHash, user.id)
    .run()

  return json({ ok: true })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    try {
      if (request.method === 'POST' && url.pathname === '/api/register') {
        return registrationWithoutRecoveryPin(request, env)
      }
      if (request.method === 'POST' && url.pathname === '/api/v14/password-reset-open') {
        return openPasswordReset(request, env)
      }
      return baseWorker.fetch(request, env as never)
    } catch (error) {
      console.error('v14_password_failed', error)
      return json({ error: 'Heslo sa někde zamotalo.' }, 500)
    }
  },
}
