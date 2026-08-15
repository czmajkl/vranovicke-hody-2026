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
}

interface AssetsBinding {
  fetch(request: Request): Promise<Response>
}

interface Env extends PhotoStorageEnv {
  DB: D1Database
  ASSETS: AssetsBinding
}

type RelationshipStatus = 'looking' | 'not_looking' | 'taken'
const VALID_RELATIONSHIP = new Set<RelationshipStatus>(['looking', 'not_looking', 'taken'])

function json(data: unknown, status = 200, headers?: HeadersInit) {
  const next = new Headers(headers)
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
  const meUrl = new URL(request.url)
  meUrl.pathname = '/api/me'
  meUrl.search = ''
  const meResponse = await baseWorker.fetch(new Request(meUrl, { method: 'GET', headers: request.headers }), env as never)
  const mePayload = meResponse.ok ? await meResponse.json() as { user?: { id?: string } | null } : null

  const { relationship_status: _ignored, ...baseBody } = body
  const response = await baseWorker.fetch(jsonRequest(request, baseBody), env as never)
  if (response.ok && mePayload?.user?.id) {
    try {
      await env.DB.prepare('UPDATE users SET relationship_status = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2')
        .bind(relationshipStatus, mePayload.user.id)
        .run()
    } catch (error) {
      console.error('relationship_profile_update_failed', error)
    }
  }
  return response
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    try {
      if (request.method === 'GET' && url.pathname === '/api/me') return augmentMe(request, env)
      if (request.method === 'GET' && url.pathname === '/api/users') return augmentUsers(request, env)
      if (request.method === 'POST' && url.pathname === '/api/register') return register(request, env)
      if (request.method === 'PATCH' && url.pathname === '/api/me/profile') return updateProfile(request, env)
      return baseWorker.fetch(request, env as never)
    } catch (error) {
      console.error('v9_relationship_failed', error)
      return json({ error: error instanceof Error ? error.message : 'Seznamovací údaje sa někde zamotaly.' }, 500)
    }
  },
}
