import baseWorker from './worker-drby'
import { PHOTO_CHALLENGES, PHOTO_CHALLENGE_ACHIEVEMENT } from './challenges'
import { SHOT_KINDS, type ShotKind } from './shot-kinds'
import { uploadOriginalToDrive, type PhotoStorageEnv } from './photo-storage'

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
}

type DrinkPreference = 'slivovica' | 'green' | 'dark' | 'anything' | 'none' | null

const MAX_ORIGINAL_BYTES = 30 * 1024 * 1024
const VALID_SHOT_KINDS = new Set<string>(SHOT_KINDS.map((item) => item.id))

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

function hashText(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

async function archiveOriginal(request: Request, env: Env, user: SessionUser) {
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    return json({ error: 'Originál mosí přijet jako formulář s fotkú.' }, 400)
  }

  const declaredLength = Number(request.headers.get('content-length') ?? '0')
  if (declaredLength > MAX_ORIGINAL_BYTES + 1024 * 1024) {
    return json({ error: 'Ta fotka je fakt macek. Originál může mět nejvýš 30 MB.' }, 413)
  }

  const form = await request.formData()
  const file = form.get('file')
  const purposeValue = form.get('purpose')
  const purpose = purposeValue === 'profile' ? 'profile' : purposeValue === 'moment' ? 'moment' : null

  if (!(file instanceof File) || !purpose) return json({ error: 'Chybí fotka nebo účel fotky.' }, 400)
  if (!file.type.startsWith('image/')) return json({ error: 'Tohle nevypadá jak fotka.' }, 400)
  if (file.size <= 0 || file.size > MAX_ORIGINAL_BYTES) {
    return json({ error: 'Ta fotka je fakt macek. Originál může mět nejvýš 30 MB.' }, 413)
  }

  const result = await uploadOriginalToDrive(env, file, user.display_name, purpose)
  return json({ ok: true, drive_file_id: result.driveFileId, drive_name: result.driveName }, 201)
}

async function createShot(request: Request, env: Env, user: SessionUser) {
  const body = await parseJsonBody(request)
  const recipientId = typeof body?.recipient_user_id === 'string' ? body.recipient_user_id : ''
  const shotKind = typeof body?.shot_kind === 'string' ? body.shot_kind : 'slivovica'

  if (!recipientId || recipientId === user.id) return json({ error: 'Sobě panáka přes appku kupovat nemusíš.' }, 400)
  if (!VALID_SHOT_KINDS.has(shotKind)) return json({ error: 'Takový panák v našem šenku nevedeme.' }, 400)

  const recipient = await env.DB.prepare('SELECT id, drink_preference FROM users WHERE id = ?1 LIMIT 1')
    .bind(recipientId)
    .first<{ id: string; drink_preference: DrinkPreference }>()

  if (!recipient) return json({ error: 'Ten člověk sa někam ztratil.' }, 404)
  if (recipient.drink_preference === 'none') return json({ error: 'Tenhle člověk má „Nechcu, díky“. Panáka mu neposílej.' }, 409)

  const shotId = crypto.randomUUID()
  await env.DB.prepare(`
    INSERT INTO shots (id, giver_user_id, current_recipient_user_id, shot_kind)
    VALUES (?1, ?2, ?3, ?4)
  `).bind(shotId, user.id, recipientId, shotKind).run()

  return json({ ok: true, shot_id: shotId, shot_kind: shotKind as ShotKind }, 201)
}

async function pendingShots(env: Env, user: SessionUser) {
  const result = await env.DB.prepare(`
    SELECT
      s.id,
      COALESCE(st.created_at, s.created_at) AS created_at,
      s.shot_kind,
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

async function scoreOverview(env: Env, user: SessionUser) {
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

  const scoreRow = await env.DB.prepare('SELECT COALESCE(SUM(points), 0) AS points FROM score_events WHERE user_id = ?1')
    .bind(user.id).first<{ points: number }>()
  const peopleRow = await env.DB.prepare(`
    SELECT COUNT(DISTINCT CASE WHEN user_id = ?1 THEN person_id ELSE user_id END) AS count
    FROM interactions WHERE user_id = ?1 OR person_id = ?1
  `).bind(user.id).first<{ count: number }>()
  const questionsRow = await env.DB.prepare(`
    SELECT COUNT(*) AS count
    FROM interaction_questions iq
    JOIN interactions i ON i.id = iq.interaction_id
    WHERE i.user_id = ?1 OR i.person_id = ?1
  `).bind(user.id).first<{ count: number }>()

  return json({
    leaderboard: leaderboard.results ?? [],
    me: {
      points: Number(scoreRow?.points ?? 0),
      unique_people: Number(peopleRow?.count ?? 0),
      questions: Number(questionsRow?.count ?? 0),
    },
    hodova_zruda: {
      earned: false,
      requirements: { points: 999999, unique_people: 999999, questions: 999999 },
    },
  })
}

async function challengeStatus(env: Env, user: SessionUser) {
  const completedResult = await env.DB.prepare(`
    SELECT challenge_id FROM photo_challenge_completions WHERE user_id = ?1
  `).bind(user.id).all<{ challenge_id: string }>()
  const completedIds = new Set((completedResult.results ?? []).map((row) => row.challenge_id))
  const remaining = PHOTO_CHALLENGES.filter((challenge) => !completedIds.has(challenge.id))
  const pool = remaining.length ? remaining : PHOTO_CHALLENGES
  const minute = Math.floor(Date.now() / 60_000)
  const selected = pool[hashText(`${user.id}:${minute}`) % pool.length]
  const completed = completedIds.size
  const earned = completed >= PHOTO_CHALLENGE_ACHIEVEMENT.needed
  const secondsUntilChange = 60 - (Math.floor(Date.now() / 1000) % 60)

  return json({
    challenge: selected,
    completed,
    total: PHOTO_CHALLENGES.length,
    needed: PHOTO_CHALLENGE_ACHIEVEMENT.needed,
    achievement: {
      id: PHOTO_CHALLENGE_ACHIEVEMENT.id,
      name: PHOTO_CHALLENGE_ACHIEVEMENT.name,
      earned,
    },
    seconds_until_change: secondsUntilChange,
  })
}

async function completeChallenge(request: Request, env: Env, user: SessionUser) {
  const body = await parseJsonBody(request)
  const challengeId = typeof body?.challenge_id === 'string' ? body.challenge_id : ''
  const photoId = typeof body?.photo_id === 'string' ? body.photo_id : ''
  const challenge = PHOTO_CHALLENGES.find((item) => item.id === challengeId)
  if (!challenge || !photoId) return json({ error: 'Výzva nebo fotka chybí.' }, 400)

  const photo = await env.DB.prepare(`
    SELECT id FROM photos WHERE id = ?1 AND author_user_id = ?2 AND photo_type = 'moment' LIMIT 1
  `).bind(photoId, user.id).first<{ id: string }>()
  if (!photo) return json({ error: 'Tahle fotka k tobě nesedí.' }, 404)

  await env.DB.prepare(`
    INSERT OR IGNORE INTO photo_challenge_completions (user_id, challenge_id, photo_id)
    VALUES (?1, ?2, ?3)
  `).bind(user.id, challenge.id, photoId).run()

  const countRow = await env.DB.prepare(`
    SELECT COUNT(*) AS count FROM photo_challenge_completions WHERE user_id = ?1
  `).bind(user.id).first<{ count: number }>()
  const completed = Number(countRow?.count ?? 0)
  const earned = completed >= PHOTO_CHALLENGE_ACHIEVEMENT.needed

  await env.DB.prepare(`
    INSERT OR IGNORE INTO achievements (id, name, description, icon, sort_order)
    VALUES (?1, ?2, ?3, 'camera', 90)
  `).bind(
    PHOTO_CHALLENGE_ACHIEVEMENT.id,
    PHOTO_CHALLENGE_ACHIEVEMENT.name,
    PHOTO_CHALLENGE_ACHIEVEMENT.description,
  ).run()

  if (earned) {
    await env.DB.prepare(`
      INSERT OR IGNORE INTO user_achievements (user_id, achievement_id)
      VALUES (?1, ?2)
    `).bind(user.id, PHOTO_CHALLENGE_ACHIEVEMENT.id).run()
  }

  return json({
    ok: true,
    completed,
    total: PHOTO_CHALLENGES.length,
    needed: PHOTO_CHALLENGE_ACHIEVEMENT.needed,
    achievement_earned: earned,
  }, 201)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (
      url.pathname === '/api/photos/original' ||
      url.pathname === '/api/v7/shots' ||
      url.pathname === '/api/v7/shots/mine' ||
      url.pathname === '/api/v7/photo-challenge' ||
      url.pathname === '/api/v7/photo-challenge/complete' ||
      url.pathname === '/api/game/overview'
    ) {
      try {
        const user = await currentUser(request, env)
        if (!user) return json({ error: 'Nejsi přihlášený.' }, 401)

        if (request.method === 'POST' && url.pathname === '/api/photos/original') return archiveOriginal(request, env, user)
        if (request.method === 'POST' && url.pathname === '/api/v7/shots') return createShot(request, env, user)
        if (request.method === 'GET' && url.pathname === '/api/v7/shots/mine') return pendingShots(env, user)
        if (request.method === 'GET' && url.pathname === '/api/v7/photo-challenge') return challengeStatus(env, user)
        if (request.method === 'POST' && url.pathname === '/api/v7/photo-challenge/complete') return completeChallenge(request, env, user)
        if (request.method === 'GET' && url.pathname === '/api/game/overview') return scoreOverview(env, user)
      } catch (error) {
        console.error('v7_api_failed', error)
        return json({ error: error instanceof Error ? error.message : 'Backend sa někde zamotal.' }, 500)
      }
    }

    return baseWorker.fetch(request, env as never)
  },
}
