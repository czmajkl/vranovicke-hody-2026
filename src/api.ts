export type ApiUser = {
  id: string
  display_name: string
  bio: string | null
  profile_photo_key: string | null
  is_available: number
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

  if (!response.ok) {
    throw new Error(body?.error || `Server vrátil chybu ${response.status}.`)
  }

  if (!body) throw new Error('Server poslal nečitelnou odpověď.')
  return body
}

export async function getMe() {
  return request<{ user: ApiUser | null }>('/api/me')
}

export async function getUsers() {
  return request<{ users: ApiUser[] }>('/api/users')
}

export async function registerUser(input: { name: string; password: string; bio?: string }) {
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
  return request<{ ok: true }>('/api/logout', {
    method: 'POST',
    body: '{}',
  })
}
