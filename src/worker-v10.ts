import baseWorker from './worker-v9'
import type { PhotoStorageEnv } from './photo-storage'
import spicyData from './data/spicy-questions.json'
import extraSpicyData from './data/extra-spicy-questions.json'

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

type RelationshipStatus = 'looking' | 'fate' | 'third' | 'not_looking' | 'taken'
type SessionUser = { id: string; display_name?: string }
type PairUser = {
  id: string
  gender: 'male' | 'female' | null
  relationship_status: string | null
}

const VALID_RELATIONSHIP = new Set<RelationshipStatus>(['looking', 'fate', 'third', 'not_looking', 'taken'])
const SPICY_SET = new Set<string>(spicyData.spicy_questions.map((item) => item.text))
const EXTRA_SPICY_SET = new Set<string>(extraSpicyData.extra_spicy_questions.map((item) => item.text))

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

async function currentUser(request: Request, env: Env): Promise<SessionUser | null> {
  const url = new URL(request.url)
  url.pathname = '/api/me'
  url.search = ''
  const response = await baseWorker.fetch(new Request(url, { method: 'GET', headers: request.headers }), env as never)
  if (!response.ok) return null
  const payload = await response.json() as { user?: SessionUser | null }
  return payload.user ?? null
}

function normalizeRelationship(value: unknown): RelationshipStatus {
  return typeof value === 'string' && VALID_RELATIONSHIP.has(value as RelationshipStatus)
    ? value as RelationshipStatus
    : 'not_looking'
}

function interestedIn(user: PairUser, otherGender: 'male' | 'female') {
  const status = normalizeRelationship(user.relationship_status)
  if (!user.gender || status === 'taken' || status === 'not_looking') return false
  if (status === 'third') return otherGender === 'female'
  if (user.gender === 'male') return otherGender === 'female'
  return otherGender === 'male' || otherGender === 'female'
}

function spiceAllowed(a: PairUser | undefined, b: PairUser | undefined) {
  if (!a || !b || !a.gender || !b.gender) return false
  return interestedIn(a, b.gender) && interestedIn(b, a.gender)
}

function canonicalPair(a: string, b: string) {
  return a < b ? [a, b] as const : [b, a] as const
}

async function pairUsers(env: Env, a: string, b: string) {
  const result = await env.DB.prepare(`
    SELECT id, gender, relationship_status
    FROM users
    WHERE id = ?1 OR id = ?2
  `).bind(a, b).all<PairUser>()
  const rows = result.results ?? []
  return {
    a: rows.find((row) => row.id === a),
    b: rows.find((row) => row.id === b),
  }
}

async function pairSpicyCount(env: Env, a: string, b: string) {
  const [userA, userB] = canonicalPair(a, b)
  const row = await env.DB.prepare(`
    SELECT COUNT(*) AS count
    FROM pair_spice_events
    WHERE user_a_id = ?1 AND user_b_id = ?2 AND level = 'spicy'
  `).bind(userA, userB).first<{ count: number }>()
  return Number(row?.count ?? 0)
}

async function pairSpiceStatus(request: Request, env: Env, user: SessionUser) {
  const personId = new URL(request.url).searchParams.get('person_id')?.trim() ?? ''
  if (!personId || personId === user.id) return json({ allowed: false, spicy_count: 0, extra_allowed: false })

  const pair = await pairUsers(env, user.id, personId)
  if (!pair.b) return json({ allowed: false, spicy_count: 0, extra_allowed: false }, 404)
  const allowed = spiceAllowed(pair.a, pair.b)
  const spicyCount = allowed ? await pairSpicyCount(env, user.id, personId) : 0
  return json({ allowed, spicy_count: spicyCount, extra_allowed: allowed && spicyCount >= 2 })
}

async function owedShots(env: Env, user: SessionUser) {
  const result = await env.DB.prepare(`
    SELECT
      s.id,
      s.shot_kind,
      s.accepted_at,
      recipient.id AS recipient_id,
      recipient.display_name AS recipient_name,
      recipient.profile_photo_data AS recipient_photo_data
    FROM shots s
    JOIN users recipient ON recipient.id = s.accepted_by_user_id
    WHERE s.giver_user_id = ?1
      AND s.status = 'accepted'
      AND s.accepted_by_user_id IS NOT NULL
      AND s.delivered_at IS NULL
    ORDER BY s.accepted_at DESC, s.created_at DESC
  `).bind(user.id).all<Record<string, unknown>>()
  return json({ shots: result.results ?? [] })
}

async function markShotDelivered(env: Env, user: SessionUser, shotId: string) {
  const shot = await env.DB.prepare(`
    SELECT id, giver_user_id, status, accepted_by_user_id, delivered_at
    FROM shots WHERE id = ?1 LIMIT 1
  `).bind(shotId).first<{
    id: string
    giver_user_id: string
    status: string
    accepted_by_user_id: string | null
    delivered_at: string | null
  }>()

  if (!shot || shot.giver_user_id !== user.id) return json({ error: 'Tenhle panák není na tvojem účtu.' }, 404)
  if (shot.status !== 'accepted' || !shot.accepted_by_user_id) return json({ error: 'Ten panák ještě nikdo nepřijal.' }, 409)
  if (shot.delivered_at) return json({ ok: true, already_delivered: true })

  await env.DB.prepare(`
    UPDATE shots
    SET delivered_at = CURRENT_TIMESTAMP, delivered_by_user_id = ?1
    WHERE id = ?2 AND giver_user_id = ?1 AND delivered_at IS NULL
  `).bind(user.id, shotId).run()

  return json({ ok: true, delivered: true })
}

async function createInteraction(request: Request, env: Env, user: SessionUser) {
  const body = await parseBody(request)
  const personId = typeof body?.person_id === 'string' ? body.person_id : ''
  const rawQuestions = Array.isArray(body?.questions)
    ? body.questions.filter((value): value is string => typeof value === 'string').map((value) => value.trim()).filter(Boolean)
    : []

  if (!personId || personId === user.id) return json({ error: 'Sám se sebú sa do Drbů fakt nepočítáš.' }, 400)

  const pair = await pairUsers(env, user.id, personId)
  if (!pair.b) return json({ error: 'Toho člověka už tu nevidím.' }, 404)
  const allowed = spiceAllowed(pair.a, pair.b)
  const previousSpicy = allowed ? await pairSpicyCount(env, user.id, personId) : 0

  const spicyCandidate = typeof body?.spicy_question === 'string' && SPICY_SET.has(body.spicy_question)
    ? body.spicy_question
    : null
  const extraCandidate = typeof body?.extra_spicy_question === 'string' && EXTRA_SPICY_SET.has(body.extra_spicy_question)
    ? body.extra_spicy_question
    : null

  const regular = [...new Set(rawQuestions.filter((question) => !SPICY_SET.has(question) && !EXTRA_SPICY_SET.has(question)))].slice(0, 3)
  const selectedSpicy = allowed && spicyCandidate && rawQuestions.includes(spicyCandidate) ? spicyCandidate : null
  const selectedExtra = allowed && previousSpicy >= 2 && extraCandidate && rawQuestions.includes(extraCandidate) ? extraCandidate : null
  const questions = [...regular, ...(selectedSpicy ? [selectedSpicy] : []), ...(selectedExtra ? [selectedExtra] : [])]

  if (!questions.length) return json({ error: 'Napřed odklikni aspoň jednu otázku.' }, 400)

  const previous = await env.DB.prepare(`
    SELECT COUNT(*) AS count FROM interactions
    WHERE (user_id = ?1 AND person_id = ?2) OR (user_id = ?2 AND person_id = ?1)
  `).bind(user.id, personId).first<{ count: number }>()

  const firstMeeting = Number(previous?.count ?? 0) === 0
  const contactPoints = firstMeeting ? 5 : 2
  const questionPoints = questions.length
  const points = contactPoints + questionPoints
  const interactionId = crypto.randomUUID()
  const [userA, userB] = canonicalPair(user.id, personId)

  const statements: D1PreparedStatement[] = [
    env.DB.prepare('INSERT INTO interactions (id, user_id, person_id, points_awarded) VALUES (?1, ?2, ?3, ?4)')
      .bind(interactionId, user.id, personId, points),
    env.DB.prepare('INSERT INTO score_events (id, user_id, event_type, points, source_id) VALUES (?1, ?2, ?3, ?4, ?5)')
      .bind(crypto.randomUUID(), user.id, firstMeeting ? 'interaction_first' : 'interaction_repeat', points, interactionId),
    ...questions.map((question) => env.DB.prepare(
      'INSERT INTO interaction_questions (interaction_id, question_text) VALUES (?1, ?2)',
    ).bind(interactionId, question)),
  ]

  if (selectedSpicy) {
    statements.push(env.DB.prepare(`
      INSERT INTO pair_spice_events (id, interaction_id, user_a_id, user_b_id, level)
      VALUES (?1, ?2, ?3, ?4, 'spicy')
    `).bind(crypto.randomUUID(), interactionId, userA, userB))
  }
  if (selectedExtra) {
    statements.push(env.DB.prepare(`
      INSERT INTO pair_spice_events (id, interaction_id, user_a_id, user_b_id, level)
      VALUES (?1, ?2, ?3, ?4, 'extra')
    `).bind(crypto.randomUUID(), interactionId, userA, userB))
  }

  await env.DB.batch(statements)
  return json({
    ok: true,
    interaction_id: interactionId,
    points,
    breakdown: { contact: contactPoints, questions: questionPoints },
    spicy_count: previousSpicy + (selectedSpicy ? 1 : 0),
    extra_spicy_recorded: Boolean(selectedExtra),
  }, 201)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    try {
      if (request.method === 'GET' && url.pathname === '/api/v10/shots/owed') {
        const user = await currentUser(request, env)
        if (!user) return json({ error: 'Nejsi přihlášený.' }, 401)
        return owedShots(env, user)
      }

      const deliveredMatch = url.pathname.match(/^\/api\/v10\/shots\/([^/]+)\/delivered$/)
      if (request.method === 'POST' && deliveredMatch) {
        const user = await currentUser(request, env)
        if (!user) return json({ error: 'Nejsi přihlášený.' }, 401)
        return markShotDelivered(env, user, decodeURIComponent(deliveredMatch[1]))
      }

      if (request.method === 'GET' && url.pathname === '/api/v10/pair-spice') {
        const user = await currentUser(request, env)
        if (!user) return json({ error: 'Nejsi přihlášený.' }, 401)
        return pairSpiceStatus(request, env, user)
      }

      if (request.method === 'POST' && url.pathname === '/api/interactions') {
        const user = await currentUser(request, env)
        if (!user) return json({ error: 'Nejsi přihlášený.' }, 401)
        return createInteraction(request, env, user)
      }

      return baseWorker.fetch(request, env as never)
    } catch (error) {
      console.error('v10_api_failed', error)
      return json({ error: error instanceof Error ? error.message : 'Hodová účetnica sa někde zamotala.' }, 500)
    }
  },
}
