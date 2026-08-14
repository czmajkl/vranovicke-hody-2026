import gameWorker from './worker-game'
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
}

interface AssetsBinding {
  fetch(request: Request): Promise<Response>
}

interface Env extends PhotoStorageEnv {
  DB: D1Database
  ASSETS: AssetsBinding
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

async function drby(env: Env) {
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
    JOIN users recipient ON recipient.id = COALESCE(
      (
        SELECT first_transfer.from_user_id
        FROM shot_transfers first_transfer
        WHERE first_transfer.shot_id = s.id
        ORDER BY first_transfer.created_at ASC
        LIMIT 1
      ),
      s.current_recipient_user_id
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === 'GET' && url.pathname === '/api/chronicle') {
      try {
        return await drby(env)
      } catch (error) {
        console.error('drby_failed', error)
        return json({ error: 'Drby sa někde zamotaly.' }, 500)
      }
    }
    return gameWorker.fetch(request, env as never)
  },
}
