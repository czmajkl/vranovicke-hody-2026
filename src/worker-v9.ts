import baseWorker from './worker-v8'
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

type RelationshipStatus = 'looking' | 'not_looking' | 'taken'
type SessionUser = { id: string; display_name?: string }
type PairUser = { id: string; gender: 'male' | 'female' | null; relationship_status: string | null }
const VALID_RELATIONSHIP = new Set<RelationshipStatus>(['looking', 'not_looking', 'taken'])

function json(data: unknown, status = 200, headers?: HeadersInit) {
  const next = new Headers(headers)
  next.delete('content-length')
  next.set('content-type', 'application/json; charset=utf-8')
  next.set('cache-control', 'no-store')
  return new Response(JSON.stringify(data), { status, headers: next })
}

function normalizeRelationship(value: unknown): RelationshipStatus {
  return typeof value === 'string' && VALID_RELATIONSHIP.has(value as RelationshipStatus)
    ? value as RelationshipStatus
    : 'not_looking'
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

async function currentUser(request: Request, env: Env): Promise<SessionUser | null> {
  const url = new URL(request.url)
  url.pathname = '/api/me'
  url.search = ''
  const response = await baseWorker.fetch(new Request(url, { method: 'GET', headers: request.headers }), env as never)
  if (!response.ok) return null
  const payload = await response.json() as { user?: SessionUser | null }
  return payload.user ?? null
}

async function relationshipFor(env: Env, userId: string) {
  const row = await env.DB.prepare('SELECT relationship_status FROM users WHERE id = ?1 LIMIT 1')
    .bind(userId)
    .first<{ relationship_status: string | null }>()
  return normalizeRelationship(row?.relationship_status)
}

async function augmentMe(request: Request, env: Env) {
  const response = await baseWorker.fetch(request, env as never)
  if (!response.ok) return response
  const payload = await response.json() as { user?: (Record<string, unknown> & { id?: string }) | null }
  if (!payload.user?.id) return json(payload, response.status, response.headers)
  const relationshipStatus = await relationshipFor(env, payload.user.id)
  return json({ ...payload, user: { ...payload.user, relationship_status: relationshipStatus } }, response.status, response.headers)
}

async function augmentUsers(request: Request, env: Env) {
  const response = await baseWorker.fetch(request, env as never)
  if (!response.ok) return response
  const payload = await response.json() as { users?: Array<Record<string, unknown> & { id?: string }> }
  const rows = await env.DB.prepare('SELECT id, relationship_status FROM users')
    .all<{ id: string; relationship_status: string | null }>()
  const statuses = new Map((rows.results ?? []).map((row) => [row.id, normalizeRelationship(row.relationship_status)]))
  return json({
    ...payload,
    users: (payload.users ?? []).map((user) => ({
      ...user,
      relationship_status: user.id ? statuses.get(user.id) ?? 'not_looking' : 'not_looking',
    })),
  }, response.status, response.headers)
}

async function register(request: Request, env: Env) {
  const body = await parseBody(request)
  if (!body) return baseWorker.fetch(request, env as never)
  const relationshipStatus = normalizeRelationship(body.relationship_status)
  const { relationship_status: _ignored, ...baseBody } = body
  const response = await baseWorker.fetch(jsonRequest(request, baseBody), env as never)
  if (!response.ok) return response

  try {
    const payload = await response.clone().json() as { user?: { id?: string } }
    if (payload.user?.id) {
      await env.DB.prepare('UPDATE users SET relationship_status = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2')
        .bind(relationshipStatus, payload.user.id)
        .run()
    }
  } catch (error) {
    console.error('relationship_register_update_failed', error)
  }
  return response
}

async function updateProfile(request: Request, env: Env) {
  const body = await parseBody(request)
  if (!body) return baseWorker.fetch(request, env as never)
  const relationshipStatus = normalizeRelationship(body.relationship_status)
  const user = await currentUser(request, env)
  const { relationship_status: _ignored, ...baseBody } = body
  const response = await baseWorker.fetch(jsonRequest(request, baseBody), env as never)
  if (response.ok && user?.id) {
    try {
      await env.DB.prepare('UPDATE users SET relationship_status = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2')
        .bind(relationshipStatus, user.id)
        .run()
    } catch (error) {
      console.error('relationship_profile_update_failed', error)
    }
  }
  return response
}

function spicyAllowed(a: PairUser | undefined, b: PairUser | undefined) {
  if (!a || !b) return false
  if (normalizeRelationship(a.relationship_status) !== 'looking' || normalizeRelationship(b.relationship_status) !== 'looking') return false
  if (!a.gender || !b.gender) return false
  return !(a.gender === 'male' && b.gender === 'male')
}

async function createScoredInteraction(request: Request, env: Env, user: SessionUser) {
  const body = await parseBody(request)
  const personId = typeof body?.person_id === 'string' ? body.person_id : ''
  const rawQuestions = Array.isArray(body?.questions) ? body.questions : []
  let questions = [...new Set(
    rawQuestions
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean),
  )].slice(0, 4)

  if (!personId || personId === user.id) return json({ error: 'Sám se sebú sa do Drbů fakt nepočítáš.' }, 400)
  if (!questions.length) return json({ error: 'Napřed odklikni aspoň jednu otázku.' }, 400)

  const pairRows = await env.DB.prepare(`
    SELECT id, gender, relationship_status
    FROM users
    WHERE id = ?1 OR id = ?2
  `).bind(user.id, personId).all<PairUser>()
  const pair = pairRows.results ?? []
  const meRow = pair.find((row) => row.id === user.id)
  const personRow = pair.find((row) => row.id === personId)
  if (!personRow) return json({ error: 'Toho člověka už tu nevidím.' }, 404)

  if (questions.length > 3 && !spicyAllowed(meRow, personRow)) questions = questions.slice(0, 3)

  const previous = await env.DB.prepare(`
    SELECT COUNT(*) AS count FROM interactions
    WHERE (user_id = ?1 AND person_id = ?2) OR (user_id = ?2 AND person_id = ?1)
  `).bind(user.id, personId).first<{ count: number }>()

  const firstMeeting = Number(previous?.count ?? 0) === 0
  const contactPoints = firstMeeting ? 5 : 2
  const questionPoints = questions.length
  const points = contactPoints + questionPoints
  const interactionId = crypto.randomUUID()

  const statements: D1PreparedStatement[] = [
    env.DB.prepare('INSERT INTO interactions (id, user_id, person_id, points_awarded) VALUES (?1, ?2, ?3, ?4)')
      .bind(interactionId, user.id, personId, points),
    env.DB.prepare('INSERT INTO score_events (id, user_id, event_type, points, source_id) VALUES (?1, ?2, ?3, ?4, ?5)')
      .bind(crypto.randomUUID(), user.id, firstMeeting ? 'interaction_first' : 'interaction_repeat', points, interactionId),
    ...questions.map((question) => env.DB.prepare(
      'INSERT INTO interaction_questions (interaction_id, question_text) VALUES (?1, ?2)',
    ).bind(interactionId, question)),
  ]

  await env.DB.batch(statements)
  return json({
    ok: true,
    interaction_id: interactionId,
    points,
    breakdown: { contact: contactPoints, questions: questionPoints },
  }, 201)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    try {
      if (request.method === 'GET' && url.pathname === '/api/me') return augmentMe(request, env)
      if (request.method === 'GET' && url.pathname === '/api/users') return augmentUsers(request, env)
      if (request.method === 'POST' && url.pathname === '/api/register') return register(request, env)
      if (request.method === 'PATCH' && url.pathname === '/api/me/profile') return updateProfile(request, env)
      if (request.method === 'POST' && url.pathname === '/api/interactions') {
        const user = await currentUser(request, env)
        if (!user) return json({ error: 'Nejsi přihlášený.' }, 401)
        return createScoredInteraction(request, env, user)
      }
      return baseWorker.fetch(request, env as never)
    } catch (error) {
      console.error('v9_relationship_failed', error)
      return json({ error: error instanceof Error ? error.message : 'Seznamovací údaje sa někde zamotaly.' }, 500)
    }
  },
}
