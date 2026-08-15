import baseWorker from './worker-v10'
import type { PhotoStorageEnv } from './photo-storage'
import questionsCs from './data/questions.json'
import questionsEn from './data/questions.en.json'
import spicyCs from './data/spicy-questions.json'
import spicyEn from './data/spicy-questions.en.json'
import extraCs from './data/extra-spicy-questions.json'
import extraEn from './data/extra-spicy-questions.en.json'

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

type Language = 'cs' | 'en'
type SessionUser = { id: string }
type TextItem = { id: string; text: string }

const PBKDF2_ITERATIONS = 10_000
const encoder = new TextEncoder()

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

function normalizeName(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()
}

function validLanguage(value: unknown): value is Language {
  return value === 'cs' || value === 'en'
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
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function hashCredential(value: string) {
  const salt = randomBytes(16)
  const key = await crypto.subtle.importKey('raw', encoder.encode(value), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },
    key,
    256,
  )
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${bytesToBase64Url(salt)}$${bytesToBase64Url(new Uint8Array(bits))}`
}

async function verifyCredential(value: string, stored: string) {
  const [algorithm, iterationText, saltText, hashText] = stored.split('$')
  const iterations = Number(iterationText)
  if (algorithm !== 'pbkdf2-sha256' || !Number.isSafeInteger(iterations) || iterations < 1 || !saltText || !hashText) return false
  const salt = base64UrlToBytes(saltText)
  const expected = base64UrlToBytes(hashText)
  const key = await crypto.subtle.importKey('raw', encoder.encode(value), 'PBKDF2', false, ['deriveBits'])
  const actual = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    expected.byteLength * 8,
  ))
  if (actual.byteLength !== expected.byteLength) return false
  let difference = 0
  for (let index = 0; index < actual.byteLength; index += 1) difference |= actual[index] ^ expected[index]
  return difference === 0
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

async function languageFor(env: Env, userId: string): Promise<Language> {
  const row = await env.DB.prepare('SELECT preferred_language FROM users WHERE id = ?1 LIMIT 1')
    .bind(userId)
    .first<{ preferred_language: string | null }>()
  return validLanguage(row?.preferred_language) ? row.preferred_language : 'cs'
}

async function augmentSingleUser(request: Request, env: Env) {
  const response = await baseWorker.fetch(request, env as never)
  if (!response.ok) return response
  const payload = await response.clone().json() as { user?: (Record<string, unknown> & { id?: string }) | null }
  if (!payload.user?.id) return json(payload, response.status, response.headers)
  const preferredLanguage = await languageFor(env, payload.user.id)
  return json({ ...payload, user: { ...payload.user, preferred_language: preferredLanguage } }, response.status, response.headers)
}

async function augmentUsers(request: Request, env: Env) {
  const response = await baseWorker.fetch(request, env as never)
  if (!response.ok) return response
  const payload = await response.clone().json() as { users?: Array<Record<string, unknown> & { id?: string }> }
  const rows = await env.DB.prepare('SELECT id, preferred_language FROM users')
    .all<{ id: string; preferred_language: string | null }>()
  const languages = new Map((rows.results ?? []).map((row) => [row.id, validLanguage(row.preferred_language) ? row.preferred_language : 'cs']))
  return json({
    ...payload,
    users: (payload.users ?? []).map((user) => ({
      ...user,
      preferred_language: user.id ? languages.get(user.id) ?? 'cs' : 'cs',
    })),
  }, response.status, response.headers)
}

async function register(request: Request, env: Env) {
  const body = await parseBody(request)
  if (!body) return json({ error: 'Registraci sa nepodařilo přečíst.' }, 400)
  if (!validLanguage(body.preferred_language)) return json({ error: 'Vyber jazyk aplikace.' }, 400)
  const pin = typeof body.recovery_pin === 'string' ? body.recovery_pin.trim() : ''
  if (!/^\d{4}$/.test(pin)) return json({ error: 'Obnovovací PIN mosí mět přesně 4 čísla.' }, 400)

  const response = await baseWorker.fetch(request, env as never)
  if (!response.ok) return response
  const payload = await response.clone().json() as { user?: (Record<string, unknown> & { id?: string }) }
  if (!payload.user?.id) return response

  try {
    const pinHash = await hashCredential(pin)
    await env.DB.prepare(`
      UPDATE users
      SET preferred_language = ?1, recovery_pin_hash = ?2, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?3
    `).bind(body.preferred_language, pinHash, payload.user.id).run()
  } catch (error) {
    console.error('registration_recovery_setup_failed', error)
    await env.DB.prepare('DELETE FROM users WHERE id = ?1').bind(payload.user.id).run()
    return json({ error: 'Účet sa nepodařilo dokončit. Zkus registraci znova.' }, 500)
  }

  return json({
    ...payload,
    user: { ...payload.user, preferred_language: body.preferred_language },
  }, response.status, response.headers)
}

async function updateLanguage(request: Request, env: Env) {
  const user = await currentUser(request, env)
  if (!user) return json({ error: 'Nejsi přihlášený.' }, 401)
  const body = await parseBody(request)
  if (!validLanguage(body?.preferred_language)) return json({ error: 'Takový jazyk tu nemáme.' }, 400)
  await env.DB.prepare('UPDATE users SET preferred_language = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2')
    .bind(body.preferred_language, user.id)
    .run()
  return json({ ok: true, preferred_language: body.preferred_language })
}

async function resetPassword(request: Request, env: Env) {
  const body = await parseBody(request)
  const name = typeof body?.name === 'string' ? body.name : ''
  const pin = typeof body?.recovery_pin === 'string' ? body.recovery_pin.trim() : ''
  const password = typeof body?.new_password === 'string' ? body.new_password : ''

  if (!name || !/^\d{4}$/.test(pin) || password.length < 4 || password.length > 128) {
    return json({ error: 'Vyplň účet, 4místný PIN a nové heslo aspoň na 4 znaky.' }, 400)
  }

  const user = await env.DB.prepare(`
    SELECT id, recovery_pin_hash
    FROM users WHERE username_norm = ?1 LIMIT 1
  `).bind(normalizeName(name)).first<{ id: string; recovery_pin_hash: string | null }>()

  if (!user) return json({ error: 'Méno nebo obnovovací PIN nesedí.' }, 401)
  if (!user.recovery_pin_hash) return json({ error: 'Tenhle starší účet ještě nemá obnovovací PIN.' }, 409)
  if (!(await verifyCredential(pin, user.recovery_pin_hash))) return json({ error: 'Méno nebo obnovovací PIN nesedí.' }, 401)

  const passwordHash = await hashCredential(password)
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET password_hash = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2')
      .bind(passwordHash, user.id),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?1').bind(user.id),
  ])

  return json({ ok: true })
}

function translationPairs(cs: TextItem[], en: TextItem[]) {
  const csById = new Map(cs.map((item) => [item.id, item.text]))
  return en.flatMap((item) => {
    const canonical = csById.get(item.id)
    return canonical ? [[item.text, canonical] as const] : []
  })
}

const TO_CANONICAL = new Map<string, string>([
  ...translationPairs(questionsCs.questions as TextItem[], questionsEn.questions as TextItem[]),
  ...translationPairs(spicyCs.spicy_questions as TextItem[], spicyEn.spicy_questions as TextItem[]),
  ...translationPairs(extraCs.extra_spicy_questions as TextItem[], extraEn.extra_spicy_questions as TextItem[]),
])

function canonicalQuestion(value: unknown) {
  return typeof value === 'string' ? TO_CANONICAL.get(value) ?? value : value
}

async function canonicalizeInteraction(request: Request, env: Env) {
  const body = await parseBody(request)
  if (!body) return baseWorker.fetch(request, env as never)
  if (Array.isArray(body.questions)) body.questions = body.questions.map(canonicalQuestion)
  if (typeof body.spicy_question === 'string') body.spicy_question = canonicalQuestion(body.spicy_question)
  if (typeof body.extra_spicy_question === 'string') body.extra_spicy_question = canonicalQuestion(body.extra_spicy_question)
  return baseWorker.fetch(jsonRequest(request, body), env as never)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    try {
      if (request.method === 'POST' && url.pathname === '/api/register') return register(request, env)
      if (request.method === 'POST' && url.pathname === '/api/login') return augmentSingleUser(request, env)
      if (request.method === 'GET' && url.pathname === '/api/me') return augmentSingleUser(request, env)
      if (request.method === 'GET' && url.pathname === '/api/users') return augmentUsers(request, env)
      if (request.method === 'POST' && url.pathname === '/api/v12/language') return updateLanguage(request, env)
      if (request.method === 'POST' && url.pathname === '/api/v12/password-reset') return resetPassword(request, env)
      if (request.method === 'POST' && url.pathname === '/api/interactions') return canonicalizeInteraction(request, env)
      return baseWorker.fetch(request, env as never)
    } catch (error) {
      console.error('v12_account_failed', error)
      return json({ error: error instanceof Error ? error.message : 'Účet sa někde zamotal.' }, 500)
    }
  },
}
