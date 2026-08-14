import baseWorker from './worker-diagnostics'
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

type SessionUser = {
  id: string
  display_name: string
  profile_photo_data: string | null
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
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
  const authRequest = new Request(url, { method: 'GET', headers: request.headers })
  const response = await baseWorker.fetch(authRequest, env as never)
  if (!response.ok) return null
  const payload = await response.json() as { user?: SessionUser | null }
  return payload.user ?? null
}

async function createScoredInteraction(request: Request, env: Env, user: SessionUser) {
  const body = await parseJsonBody(request)
  const personId = typeof body?.person_id === 'string' ? body.person_id : ''
  const rawQuestions = Array.isArray(body?.questions) ? body.questions : []
  const questions = [...new Set(
    rawQuestions
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean),
  )].slice(0, 3)

  if (!personId || personId === user.id) return json({ error: 'Sám se sebú sa do Drbů fakt nepočítáš.' }, 400)
  if (!questions.length) return json({ error: 'Napřed odklikni aspoň jednu otázku.' }, 400)

  const person = await env.DB.prepare('SELECT id FROM users WHERE id = ?1 LIMIT 1')
    .bind(personId).first<{ id: string }>()
  if (!person) return json({ error: 'Toho člověka už tu nevidím.' }, 404)

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
    breakdown: {
      contact: contactPoints,
      questions: questionPoints,
    },
  }, 201)
}

async function enhancedPendingShots(env: Env, user: SessionUser) {
  const result = await env.DB.prepare(`
    SELECT
      s.id,
      COALESCE(st.created_at, s.created_at) AS created_at,
      giver.id AS giver_id,
      giver.display_name AS giver_name,
      giver.profile_photo_data AS giver_photo_data,
      forwarder.id AS forwarded_by_id,
      forwarder.display_name AS forwarded_by_name,
      forwarder.profile_photo_data AS forwarded_by_photo_data
    FROM shots s
    JOIN users giver ON giver.id = s.giver_user_id
    LEFT JOIN shot_transfers st ON st.id = (
      SELECT st2.id FROM shot_transfers st2
      WHERE st2.shot_id = s.id
      ORDER BY st2.created_at DESC
      LIMIT 1
    )
    LEFT JOIN users forwarder ON forwarder.id = st.from_user_id
    WHERE s.current_recipient_user_id = ?1 AND s.status = 'offered'
    ORDER BY COALESCE(st.created_at, s.created_at) DESC
  `).bind(user.id).all<Record<string, unknown>>()
  return json({ shots: result.results ?? [] })
}

async function enhancedChronicle(env: Env) {
  type Event = Record<string, unknown> & {
    type: 'join' | 'interaction' | 'photo' | 'shot' | 'shot_transfer'
    created_at: string
  }
  const events: Event[] = []

  const joins = await env.DB.prepare(`
    SELECT
      u.id,
      u.created_at,
      u.display_name AS joined_name,
      u.profile_photo_data AS joined_photo_data,
      inviter.display_name AS inviter_name
    FROM users u
    LEFT JOIN users inviter ON inviter.id = u.inviter_user_id
    ORDER BY u.created_at DESC
    LIMIT 120
  `).all<Record<string, unknown> & { created_at: string }>()
  for (const row of joins.results ?? []) events.push({ type: 'join', ...row })

  const interactions = await env.DB.prepare(`
    SELECT i.id, i.created_at, a.display_name AS from_name, b.display_name AS to_name,
           b.profile_photo_data AS to_photo_data
    FROM interactions i
    JOIN users a ON a.id = i.user_id
    JOIN users b ON b.id = i.person_id
    ORDER BY i.created_at DESC LIMIT 100
  `).all<Record<string, unknown> & { created_at: string }>()
  for (const row of interactions.results ?? []) events.push({ type: 'interaction', ...row })

  const photos = await env.DB.prepare(`
    SELECT p.id, p.created_at, p.web_photo_data, author.display_name AS author_name,
           tagged.display_name AS tagged_name
    FROM photos p
    JOIN users author ON author.id = p.author_user_id
    LEFT JOIN photo_tags pt ON pt.photo_id = p.id AND pt.user_id <> p.author_user_id
    LEFT JOIN users tagged ON tagged.id = pt.user_id
    WHERE p.photo_type = 'moment' AND p.published_at IS NOT NULL
    ORDER BY p.created_at DESC LIMIT 100
  `).all<Record<string, unknown> & { created_at: string }>()
  for (const row of photos.results ?? []) events.push({ type: 'photo', ...row })

  const shots = await env.DB.prepare(`
    SELECT s.id, s.created_at,
           giver.display_name AS giver_name,
           recipient.display_name AS recipient_name,
           recipient.profile_photo_data AS recipient_photo_data
    FROM shots s
    JOIN users giver ON giver.id = s.giver_user_id
    JOIN users recipient ON recipient.id = (
      CASE
        WHEN EXISTS (SELECT 1 FROM shot_transfers st WHERE st.shot_id = s.id)
        THEN (
          SELECT st0.to_user_id FROM shot_transfers st0
          WHERE st0.shot_id = s.id
          ORDER BY st0.created_at ASC LIMIT 1
        )
        ELSE s.current_recipient_user_id
      END
    )
    ORDER BY s.created_at DESC LIMIT 100
  `).all<Record<string, unknown> & { created_at: string }>()
  for (const row of shots.results ?? []) events.push({ type: 'shot', ...row })

  const transfers = await env.DB.prepare(`
    SELECT st.id, st.created_at,
           original_giver.display_name AS giver_name,
           sender.display_name AS from_name,
           recipient.display_name AS to_name,
           recipient.profile_photo_data AS to_photo_data
    FROM shot_transfers st
    JOIN shots s ON s.id = st.shot_id
    JOIN users original_giver ON original_giver.id = s.giver_user_id
    JOIN users sender ON sender.id = st.from_user_id
    JOIN users recipient ON recipient.id = st.to_user_id
    ORDER BY st.created_at DESC LIMIT 100
  `).all<Record<string, unknown> & { created_at: string }>()
  for (const row of transfers.results ?? []) events.push({ type: 'shot_transfer', ...row })

  events.sort((a, b) => b.created_at.localeCompare(a.created_at))
  return json({ events: events.slice(0, 180) })
}

async function gameOverview(env: Env, user: SessionUser) {
  const leaderboard = await env.DB.prepare(`
    SELECT
      u.id,
      u.display_name,
      u.profile_photo_data,
      COALESCE(SUM(se.points), 0) AS points
    FROM users u
    LEFT JOIN score_events se ON se.user_id = u.id
    GROUP BY u.id, u.display_name, u.profile_photo_data
    ORDER BY points DESC, u.display_name COLLATE NOCASE ASC
    LIMIT 30
  `).all<Record<string, unknown>>()

  const scoreRow = await env.DB.prepare(`
    SELECT COALESCE(SUM(points), 0) AS points
    FROM score_events WHERE user_id = ?1
  `).bind(user.id).first<{ points: number }>()

  const peopleRow = await env.DB.prepare(`
    SELECT COUNT(DISTINCT CASE WHEN user_id = ?1 THEN person_id ELSE user_id END) AS count
    FROM interactions
    WHERE user_id = ?1 OR person_id = ?1
  `).bind(user.id).first<{ count: number }>()

  const questionsRow = await env.DB.prepare(`
    SELECT COUNT(*) AS count
    FROM interaction_questions iq
    JOIN interactions i ON i.id = iq.interaction_id
    WHERE i.user_id = ?1 OR i.person_id = ?1
  `).bind(user.id).first<{ count: number }>()

  const points = Number(scoreRow?.points ?? 0)
  const uniquePeople = Number(peopleRow?.count ?? 0)
  const questions = Number(questionsRow?.count ?? 0)
  const earned = points >= 30 && uniquePeople >= 5 && questions >= 8

  await env.DB.prepare(`
    INSERT OR IGNORE INTO achievements (id, name, description, icon, sort_order)
    VALUES ('hodova-zruda', 'Hodová zrůda', '30 bodů, 5 různých lidí a 8 potvrzených otázek.', 'sparkles', 90)
  `).run()

  if (earned) {
    await env.DB.prepare(`
      INSERT OR IGNORE INTO user_achievements (user_id, achievement_id)
      VALUES (?1, 'hodova-zruda')
    `).bind(user.id).run()
  }

  return json({
    leaderboard: leaderboard.results ?? [],
    me: {
      points,
      unique_people: uniquePeople,
      questions,
    },
    hodova_zruda: {
      earned,
      requirements: {
        points: 30,
        unique_people: 5,
        questions: 8,
      },
    },
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'GET' && url.pathname === '/api/chronicle') {
      return enhancedChronicle(env)
    }

    if (
      (request.method === 'POST' && url.pathname === '/api/interactions') ||
      (request.method === 'GET' && url.pathname === '/api/shots/mine') ||
      (request.method === 'GET' && url.pathname === '/api/game/overview')
    ) {
      const user = await currentUser(request, env)
      if (!user) return json({ error: 'Nejsi přihlášený.' }, 401)

      if (request.method === 'POST' && url.pathname === '/api/interactions') {
        return createScoredInteraction(request, env, user)
      }
      if (request.method === 'GET' && url.pathname === '/api/shots/mine') {
        return enhancedPendingShots(env, user)
      }
      if (request.method === 'GET' && url.pathname === '/api/game/overview') {
        return gameOverview(env, user)
      }
    }

    return baseWorker.fetch(request, env as never)
  },
}
