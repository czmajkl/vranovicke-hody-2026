import baseWorker from './worker-v7'
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

type SessionUser = {
  id: string
  display_name: string
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

async function currentUser(request: Request, env: Env): Promise<SessionUser | null> {
  const url = new URL(request.url)
  url.pathname = '/api/me'
  url.search = ''
  const response = await baseWorker.fetch(new Request(url, { method: 'GET', headers: request.headers }), env as never)
  if (!response.ok) return null
  const payload = await response.json() as { user?: SessionUser | null }
  return payload.user ?? null
}

async function donateWine(env: Env, user: SessionUser) {
  const id = crypto.randomUUID()
  await env.DB.prepare(`
    INSERT INTO wine_donations (id, user_id, bottles)
    VALUES (?1, ?2, 1)
  `).bind(id, user.id).run()

  return json({ ok: true, donation_id: id, bottles: 1 }, 201)
}

async function generosity(env: Env) {
  const result = await env.DB.prepare(`
    SELECT
      u.id,
      u.display_name,
      u.profile_photo_data,
      COALESCE((
        SELECT COUNT(*) FROM shots s WHERE s.giver_user_id = u.id
      ), 0) AS shot_count,
      COALESCE((
        SELECT SUM(w.bottles) FROM wine_donations w WHERE w.user_id = u.id
      ), 0) AS wine_count,
      COALESCE((
        SELECT COUNT(*) FROM shots s WHERE s.giver_user_id = u.id
      ), 0) + COALESCE((
        SELECT SUM(w.bottles) FROM wine_donations w WHERE w.user_id = u.id
      ), 0) AS generosity_count
    FROM users u
    WHERE EXISTS (SELECT 1 FROM shots s WHERE s.giver_user_id = u.id)
       OR EXISTS (SELECT 1 FROM wine_donations w WHERE w.user_id = u.id)
    ORDER BY generosity_count DESC, wine_count DESC, shot_count DESC, u.display_name COLLATE NOCASE ASC
    LIMIT 30
  `).all<Record<string, unknown>>()

  return json({ rows: result.results ?? [] })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/v8/wine-donations' || url.pathname === '/api/v8/generosity') {
      try {
        if (request.method === 'GET' && url.pathname === '/api/v8/generosity') {
          return generosity(env)
        }

        const user = await currentUser(request, env)
        if (!user) return json({ error: 'Nejsi přihlášený.' }, 401)

        if (request.method === 'POST' && url.pathname === '/api/v8/wine-donations') {
          return donateWine(env, user)
        }
      } catch (error) {
        console.error('v8_api_failed', error)
        return json({ error: error instanceof Error ? error.message : 'Šenkovní účetnica sa zamotala.' }, 500)
      }
    }

    return baseWorker.fetch(request, env as never)
  },
}
