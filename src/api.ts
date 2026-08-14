export type Gender = 'male' | 'female'
export type DanceLevel = 'pro' | 'amateur' | 'wild'

export type ApiUser = {
  id: string
  display_name: string
  bio: string | null
  profile_photo_key: string | null
  profile_photo_data: string | null
  gender: Gender | null
  dance_level: DanceLevel | null
  is_available: number
}

export type InteractionRecord = {
  id: string
  created_at: string
  from_name: string
  to_name: string
  from_photo_data: string | null
  to_photo_data: string | null
  points_awarded: number
  questions: string[]
}

export type ChronicleEvent =
  | {
      type: 'invite'
      id: string
      created_at: string
      inviter_name: string
      joined_name: string
      joined_photo_data: string | null
    }
  | {
      type: 'interaction'
      id: string
      created_at: string
      from_name: string
      to_name: string
      to_photo_data: string | null
    }

export type PendingShot = {
  id: string
  created_at: string
  giver_id: string
  giver_name: string
  giver_photo_data: string | null
}

export type ShotLeaderboardRow = {
  id: string
  display_name: string
  profile_photo_data: string | null
  count: number
}

type ApiError = { error?: string }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  const text = await response.text()
  let body: (T & ApiError) | null = null
  if (text) {
    try {
      body = JSON.parse(text) as T & ApiError
    } catch {
      body = null
    }
  }

  if (!response.ok) throw new Error(body?.error || `Server vrátil chybu ${response.status}.`)
  if (!body) throw new Error('Server poslal nečitelnú odpověď.')
  return body
}

export async function getMe() {
  return request<{ user: ApiUser | null }>('/api/me')
}

export async function getUsers() {
  return request<{ users: ApiUser[] }>('/api/users')
}

export async function registerUser(input: {
  name: string
  password: string
  bio?: string
  profile_photo_data: string
  gender: Gender
  dance_level: DanceLevel
  ref?: string
}) {
  return request<{ user: ApiUser }>('/api/register', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function loginUser(input: { name: string; password: string }) {
  return request<{ user: ApiUser }>('/api/login', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function logoutUser() {
  return request<{ ok: true }>('/api/logout', { method: 'POST', body: '{}' })
}

export async function setAvailability(available: boolean) {
  return request<{ ok: true; is_available: number }>('/api/me/availability', {
    method: 'PATCH',
    body: JSON.stringify({ available }),
  })
}

export async function confirmInteraction(personId: string, questions: string[]) {
  return request<{ ok: true; interaction_id: string; points: number }>('/api/interactions', {
    method: 'POST',
    body: JSON.stringify({ person_id: personId, questions }),
  })
}

export async function getInteractions() {
  return request<{ interactions: InteractionRecord[] }>('/api/interactions')
}

export async function getChronicle() {
  return request<{ events: ChronicleEvent[] }>('/api/chronicle')
}

export async function buyShot(recipientUserId: string) {
  return request<{ ok: true; shot_id: string }>('/api/shots', {
    method: 'POST',
    body: JSON.stringify({ recipient_user_id: recipientUserId }),
  })
}

export async function getPendingShots() {
  return request<{ shots: PendingShot[] }>('/api/shots/mine')
}

export async function acceptShot(shotId: string) {
  return request<{ ok: true }>(`/api/shots/${encodeURIComponent(shotId)}/accept`, {
    method: 'POST',
    body: '{}',
  })
}

export async function forwardShot(shotId: string, recipientUserId: string) {
  return request<{ ok: true }>(`/api/shots/${encodeURIComponent(shotId)}/forward`, {
    method: 'POST',
    body: JSON.stringify({ recipient_user_id: recipientUserId }),
  })
}

export async function getShotLeaderboard() {
  return request<{ generous: ShotLeaderboardRow[]; received: ShotLeaderboardRow[] }>('/api/shots/leaderboard')
}
