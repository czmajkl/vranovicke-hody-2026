export {
  acceptShot,
  buyShot,
  confirmInteraction,
  forwardShot,
  getInteractions,
  getMe,
  getMyPhotos,
  getShotLeaderboard,
  getUsers,
  loginUser,
  logoutUser,
  registerUser,
  saveMomentPhoto,
  setAvailability,
  updateProfile,
} from './api-next'

export type {
  ApiUser,
  DanceLevel,
  DrinkPreference,
  Gender,
  InteractionRecord,
  MomentPhoto,
  ShotLeaderboardRow,
} from './api-next'

export type PendingShot = {
  id: string
  created_at: string
  giver_id: string
  giver_name: string
  giver_photo_data: string | null
  forwarded_by_id: string | null
  forwarded_by_name: string | null
  forwarded_by_photo_data: string | null
}

export type ChronicleEvent =
  | {
      type: 'join'
      id: string
      created_at: string
      joined_name: string
      joined_photo_data: string | null
      inviter_name: string | null
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
  | {
      type: 'shot'
      id: string
      created_at: string
      giver_name: string
      recipient_name: string
      recipient_photo_data: string | null
    }
  | {
      type: 'shot_transfer'
      id: string
      created_at: string
      giver_name: string
      from_name: string
      to_name: string
      to_photo_data: string | null
    }

export type PointLeaderboardRow = {
  id: string
  display_name: string
  profile_photo_data: string | null
  points: number
}

export type GameOverview = {
  leaderboard: PointLeaderboardRow[]
  me: {
    points: number
    unique_people: number
    questions: number
  }
  hodova_zruda: {
    earned: boolean
    requirements: {
      points: number
      unique_people: number
      questions: number
    }
  }
}

type ApiError = { error?: string }

async function request<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: 'same-origin' })
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

export function getChronicle() {
  return request<{ events: ChronicleEvent[] }>('/api/chronicle')
}

export function getPendingShots() {
  return request<{ shots: PendingShot[] }>('/api/shots/mine')
}

export function getGameOverview() {
  return request<GameOverview>('/api/game/overview')
}
