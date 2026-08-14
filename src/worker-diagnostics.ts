import storageWorker from './worker-storage'
import { ensureArchiveFolder, type PhotoStorageEnv } from './photo-storage'

interface AssetsBinding {
  fetch(request: Request): Promise<Response>
}

interface Env extends PhotoStorageEnv {
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

async function storageHealth(env: Env) {
  let r2Ready = false
  let r2Reason: string | undefined
  try {
    await env.PHOTOS.list({ limit: 1 })
    r2Ready = true
  } catch {
    r2Reason = 'r2_binding_or_bucket_unavailable'
  }

  const missingSecrets = [
    ['GOOGLE_CLIENT_ID', env.GOOGLE_CLIENT_ID],
    ['GOOGLE_CLIENT_SECRET', env.GOOGLE_CLIENT_SECRET],
    ['GOOGLE_REFRESH_TOKEN', env.GOOGLE_REFRESH_TOKEN],
  ].filter(([, value]) => !value).map(([name]) => name)

  let driveReady = false
  let driveReason: string | undefined

  if (missingSecrets.length) {
    driveReason = `missing_secret:${missingSecrets.join(',')}`
  } else {
    try {
      const body = new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID!,
        client_secret: env.GOOGLE_CLIENT_SECRET!,
        refresh_token: env.GOOGLE_REFRESH_TOKEN!,
        grant_type: 'refresh_token',
      })
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
      })
      const tokenPayload = await tokenResponse.json() as {
        access_token?: string
        error?: string
      }

      if (!tokenResponse.ok || !tokenPayload.access_token) {
        driveReason = `oauth:${tokenPayload.error ?? `http_${tokenResponse.status}`}`
      } else {
        try {
          await ensureArchiveFolder(env)
          driveReady = true
        } catch (error) {
          driveReason = `drive:${error instanceof Error ? error.message : 'unknown_error'}`
        }
      }
    } catch {
      driveReason = 'oauth:request_failed'
    }
  }

  const ok = r2Ready && driveReady
  return json({
    ok,
    r2: r2Ready ? 'ready' : 'not_ready',
    drive: driveReady ? 'ready' : 'not_ready',
    ...(r2Reason ? { r2_reason: r2Reason } : {}),
    ...(driveReason ? { drive_reason: driveReason } : {}),
  }, ok ? 200 : 503)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === 'GET' && url.pathname === '/api/storage-health') {
      return storageHealth(env)
    }
    return storageWorker.fetch(request, env as never)
  },
}
