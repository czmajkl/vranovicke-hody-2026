export type Gender = 'male' | 'female'
export type DanceLevel = 'pro' | 'amateur' | 'wild'
export type DrinkPreference = 'slivovica' | 'green' | 'dark' | 'anything' | 'none'

export type ApiUser = {
  id: string
  display_name: string
  bio: string | null
  profile_photo_key: string | null
  profile_photo_data: string | null
  gender: Gender | null
  dance_level: DanceLevel | null
  drink_preference: DrinkPreference | null
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
  | {
      type: 'photo'
      id: string
      created_at: string
      author_name: string
      tagged_name: string | null
      web_photo_data: string
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

export type MomentPhoto = {
  id: string
  created_at: string
  web_photo_data: string
  author_user_id: string
  author_name: string
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

export function getMe() {
  return request<{ user: ApiUser | null }>('/api/me')
}

export function getUsers() {
  return request<{ users: ApiUser[] }>('/api/users')
}

export function registerUser(input: {
  name: string
  password: string
  bio?: string
  profile_photo_data: string
  gender: Gender
  dance_level: DanceLevel
  drink_preference: DrinkPreference
  ref?: string
}) {
  return request<{ user: ApiUser }>('/api/register', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function loginUser(input: { name: string; password: string }) {
  return request<{ user: ApiUser }>('/api/login', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function logoutUser() {
  return request<{ ok: true }>('/api/logout', { method: 'POST', body: '{}' })
}

export function setAvailability(available: boolean) {
  return request<{ ok: true; is_available: number }>('/api/me/availability', {
    method: 'PATCH',
    body: JSON.stringify({ available }),
  })
}

export function updateProfile(input: { bio: string; gender: Gender; dance_level: DanceLevel; drink_preference: DrinkPreference }) {
  return request<{ user: ApiUser }>('/api/me/profile', {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function confirmInteraction(personId: string, questions: string[]) {
  return request<{ ok: true; interaction_id: string; points: number }>('/api/interactions', {
    method: 'POST',
    body: JSON.stringify({ person_id: personId, questions }),
  })
}

export function getInteractions() {
  return request<{ interactions: InteractionRecord[] }>('/api/interactions')
}

export function getChronicle() {
  return request<{ events: ChronicleEvent[] }>('/api/chronicle')
}

export function saveMomentPhoto(input: { image_data: string; tagged_user_id?: string; interaction_id?: string }) {
  return request<{ ok: true; photo_id: string }>('/api/photos', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function getMyPhotos() {
  return request<{ photos: MomentPhoto[] }>('/api/photos/mine')
}

export function buyShot(recipientUserId: string) {
  return request<{ ok: true; shot_id: string }>('/api/shots', {
    method: 'POST',
    body: JSON.stringify({ recipient_user_id: recipientUserId }),
  })
}

export function getPendingShots() {
  return request<{ shots: PendingShot[] }>('/api/shots/mine')
}

export function acceptShot(shotId: string) {
  return request<{ ok: true }>(`/api/shots/${encodeURIComponent(shotId)}/accept`, {
    method: 'POST',
    body: '{}',
  })
}

export function forwardShot(shotId: string, recipientUserId: string) {
  return request<{ ok: true }>(`/api/shots/${encodeURIComponent(shotId)}/forward`, {
    method: 'POST',
    body: JSON.stringify({ recipient_user_id: recipientUserId }),
  })
}

export function getShotLeaderboard() {
  return request<{ generous: ShotLeaderboardRow[]; received: ShotLeaderboardRow[] }>('/api/shots/leaderboard')
}
