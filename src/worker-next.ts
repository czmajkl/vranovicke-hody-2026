const SESSION_COOKIE = 'hody_session'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30
const PBKDF2_ITERATIONS = 10_000
const PASSWORD_MIN_LENGTH = 4
const PASSWORD_MAX_LENGTH = 128
const MAX_PROFILE_PHOTO_LENGTH = 900_000
const MAX_MOMENT_PHOTO_LENGTH = 1_400_000

const VALID_GENDERS = new Set(['male', 'female'])
const VALID_DANCE_LEVELS = new Set(['pro', 'amateur', 'wild'])
const VALID_DRINKS = new Set(['slivovica', 'green', 'dark', 'anything', 'none'])

type Gender = 'male' | 'female'
type DanceLevel = 'pro' | 'amateur' | 'wild'
type DrinkPreference = 'slivovica' | 'green' | 'dark' | 'anything' | 'none'

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

interface Env {
  DB: D1Database
  ASSETS: AssetsBinding
}

type PublicUser = {
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

type UserWithPassword = PublicUser & {
  username_norm: string
  password_hash: string
}

type SessionUser = PublicUser & {
  session_id: string
}

type InviteRow = {
  id: string
  inviter_user_id: string
}

type ShotRow = {
  id: string
  giver_user_id: string
  current_recipient_user_id: string
  status: 'offered' | 'accepted'
}

const encoder = new TextEncoder()

function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  const responseHeaders = new Headers(headers)
  responseHeaders.set('content-type', 'application/json; charset=utf-8')
  responseHeaders.set('cache-control', 'no-store')
  return new Response(JSON.stringify(data), { status, headers: responseHeaders })
}

function normalizeName(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()
}

function sqlDate(date: Date) {
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

function randomBytes(length: number) {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return bytesToBase64Url(new Uint8Array(digest))
}

async function hashPassword(password: string) {
  const salt = randomBytes(16)
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },
    key,
    256,
  )
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${bytesToBase64Url(salt)}$${bytesToBase64Url(new Uint8Array(bits))}`
}

async function verifyPassword(password: string, stored: string) {
  const [algorithm, iterationText, saltText, hashText] = stored.split('$')
  const iterations = Number(iterationText)
  if (algorithm !== 'pbkdf2-sha256' || !Number.isSafeInteger(iterations) || iterations < 1 || !saltText || !hashText) return false
  const salt = base64UrlToBytes(saltText)
  const expected = base64UrlToBytes(hashText)
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    expected.byteLength * 8,
  ))
  if (bits.byteLength !== expected.byteLength) return false
  let difference = 0
  for (let index = 0; index < bits.byteLength; index += 1) difference |= bits[index] ^ expected[index]
  return difference === 0
}

function parseCookies(request: Request) {
  const cookies = new Map<string, string>()
  const header = request.headers.get('cookie') ?? ''
  for (const part of header.split(';')) {
    const separator = part.indexOf('=')
    if (separator === -1) continue
    cookies.set(part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1).trim()))
  }
  return cookies
}

function sessionCookie(token: string, maxAge = SESSION_TTL_SECONDS) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
}

async function createSession(db: D1Database, userId: string) {
  const token = bytesToBase64Url(randomBytes(32))
  const tokenHash = await sha256(token)
  const sessionId = crypto.randomUUID()
  const expiresAt = sqlDate(new Date(Date.now() + SESSION_TTL_SECONDS * 1000))
  await db.prepare('INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?1, ?2, ?3, ?4)')
    .bind(sessionId, userId, tokenHash, expiresAt)
    .run()
  return token
}

async function getSessionUser(request: Request, db: D1Database) {
  const token = parseCookies(request).get(SESSION_COOKIE)
  if (!token) return null
  const tokenHash = await sha256(token)
  return db.prepare(`
    SELECT s.id AS session_id, u.id, u.display_name, u.bio, u.profile_photo_key,
           u.profile_photo_data, u.gender, u.dance_level, u.drink_preference, u.is_available
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?1 AND s.expires_at > CURRENT_TIMESTAMP
    LIMIT 1
  `).bind(tokenHash).first<SessionUser>()
}

async function parseJsonBody(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) return null
  try {
    return await request.json() as Record<string, unknown>
  } catch {
    return null
  }
}

function publicUser(user: PublicUser) {
  return {
    id: user.id,
    display_name: user.display_name,
    bio: user.bio,
    profile_photo_key: user.profile_photo_key,
    profile_photo_data: user.profile_photo_data,
    gender: user.gender,
    dance_level: user.dance_level,
    drink_preference: user.drink_preference,
    is_available: user.is_available,
  }
}

function validImageData(value: string, maxLength: number) {
  return /^data:image\/(?:webp|jpeg|png);base64,/i.test(value) && value.length <= maxLength
}

async function databaseReady(env: Env) {
  try {
    await env.DB.prepare('SELECT id, drink_preference FROM users LIMIT 1').first()
    await env.DB.prepare('SELECT id FROM shots LIMIT 1').first()
    await env.DB.prepare('SELECT id, web_photo_data FROM photos LIMIT 1').first()
    return true
  } catch (error) {
    console.error('database_not_ready', error)
    return false
  }
}

async function register(request: Request, env: Env) {
  const body = await parseJsonBody(request)
  if (!body) return json({ error: 'Cos tam poslal za guláš? Formulář nejde přečíst.' }, 400)

  const displayName = typeof body.name === 'string' ? body.name.normalize('NFKC').trim().replace(/\s+/g, ' ') : ''
  const usernameNorm = normalizeName(displayName)
  const password = typeof body.password === 'string' ? body.password : ''
  const bio = typeof body.bio === 'string' ? body.bio.normalize('NFKC').trim().slice(0, 120) : ''
  const ref = typeof body.ref === 'string' ? body.ref.trim().slice(0, 100) : ''
  const profilePhotoData = typeof body.profile_photo_data === 'string' ? body.profile_photo_data : ''
  const gender = typeof body.gender === 'string' ? body.gender : ''
  const danceLevel = typeof body.dance_level === 'string' ? body.dance_level : ''
  const drinkPreference = typeof body.drink_preference === 'string' ? body.drink_preference : ''

  if (displayName.length < 2 || displayName.length > 40) return json({ error: 'Méno mosí mět 2 až 40 znaků.' }, 400)
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) return json({ error: 'Heslo mosí mět aspoň 4 znaky.' }, 400)
  if (!validImageData(profilePhotoData, MAX_PROFILE_PHOTO_LENGTH)) return json({ error: 'Bez fotky tě do placu nepustíme. Nahraj ju znova.' }, 400)
  if (!VALID_GENDERS.has(gender)) return json({ error: 'Vyber, jestli seš šohaj nebo děvčica.' }, 400)
  if (!VALID_DANCE_LEVELS.has(danceLevel)) return json({ error: 'Přiznaj, jak seš na tom s tancem.' }, 400)
  if (!VALID_DRINKS.has(drinkPreference)) return json({ error: 'Vyber, co ti može kdo nabídnút.' }, 400)

  const existing = await env.DB.prepare('SELECT id FROM users WHERE username_norm = ?1 LIMIT 1').bind(usernameNorm).first<{ id: string }>()
  if (existing) return json({ error: 'Takové méno už tu máme. Vymysli si druhé.' }, 409)

  let inviterUserId: string | null = null
  let invite: InviteRow | null = null
  if (ref) {
    invite = await env.DB.prepare('SELECT id, inviter_user_id FROM invites WHERE code = ?1 AND claimed_by_user_id IS NULL LIMIT 1').bind(ref).first<InviteRow>()
    if (invite) inviterUserId = invite.inviter_user_id
    else {
      const inviter = await env.DB.prepare('SELECT id FROM users WHERE username_norm = ?1 LIMIT 1').bind(normalizeName(ref)).first<{ id: string }>()
      inviterUserId = inviter?.id ?? null
    }
  }

  const userId = crypto.randomUUID()
  const passwordHash = await hashPassword(password)
  const token = bytesToBase64Url(randomBytes(32))
  const tokenHash = await sha256(token)
  const sessionId = crypto.randomUUID()
  const expiresAt = sqlDate(new Date(Date.now() + SESSION_TTL_SECONDS * 1000))

  const statements: D1PreparedStatement[] = [
    env.DB.prepare(`
      INSERT INTO users (
        id, display_name, username_norm, password_hash, bio, profile_photo_data,
        gender, dance_level, drink_preference, inviter_user_id
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
    `).bind(
      userId, displayName, usernameNorm, passwordHash, bio || null, profilePhotoData,
      gender, danceLevel, drinkPreference, inviterUserId,
    ),
    env.DB.prepare('INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?1, ?2, ?3, ?4)')
      .bind(sessionId, userId, tokenHash, expiresAt),
  ]

  if (inviterUserId) {
    statements.push(env.DB.prepare('INSERT INTO score_events (id, user_id, event_type, points, source_id) VALUES (?1, ?2, ?3, ?4, ?5)')
      .bind(crypto.randomUUID(), inviterUserId, 'invite_joined', 3, userId))
  }
  if (invite) {
    statements.push(env.DB.prepare('UPDATE invites SET claimed_by_user_id = ?1, claimed_at = CURRENT_TIMESTAMP WHERE id = ?2 AND claimed_by_user_id IS NULL')
      .bind(userId, invite.id))
  }

  await env.DB.batch(statements)
  return json({ user: publicUser({
    id: userId,
    display_name: displayName,
    bio: bio || null,
    profile_photo_key: null,
    profile_photo_data: profilePhotoData,
    gender: gender as Gender,
    dance_level: danceLevel as DanceLevel,
    drink_preference: drinkPreference as DrinkPreference,
    is_available: 1,
  }) }, 201, { 'set-cookie': sessionCookie(token) })
}

async function login(request: Request, env: Env) {
  const body = await parseJsonBody(request)
  const name = typeof body?.name === 'string' ? body.name : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!name || password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) return json({ error: 'Méno nebo heslo nesedí.' }, 401)

  const user = await env.DB.prepare(`
    SELECT id, display_name, username_norm, password_hash, bio, profile_photo_key,
           profile_photo_data, gender, dance_level, drink_preference, is_available
    FROM users WHERE username_norm = ?1 LIMIT 1
  `).bind(normalizeName(name)).first<UserWithPassword>()
  if (!user || !(await verifyPassword(password, user.password_hash))) return json({ error: 'Méno nebo heslo nesedí.' }, 401)

  await env.DB.prepare('DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP').run()
  const token = await createSession(env.DB, user.id)
  return json({ user: publicUser(user) }, 200, { 'set-cookie': sessionCookie(token) })
}

async function logout(request: Request, env: Env) {
  const token = parseCookies(request).get(SESSION_COOKIE)
  if (token) {
    const tokenHash = await sha256(token)
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?1').bind(tokenHash).run()
  }
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0) })
}

async function listUsers(env: Env) {
  const result = await env.DB.prepare(`
    SELECT id, display_name, bio, profile_photo_key, profile_photo_data,
           gender, dance_level, drink_preference, is_available
    FROM users ORDER BY display_name COLLATE NOCASE ASC
  `).all<PublicUser>()
  return json({ users: result.results ?? [] })
}

async function setAvailability(request: Request, env: Env, user: SessionUser) {
  const body = await parseJsonBody(request)
  const available = body?.available === true ? 1 : body?.available === false ? 0 : null
  if (available === null) return json({ error: 'Stav sem nepochopil.' }, 400)
  await env.DB.prepare('UPDATE users SET is_available = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2').bind(available, user.id).run()
  return json({ ok: true, is_available: available })
}

async function updateProfile(request: Request, env: Env, user: SessionUser) {
  const body = await parseJsonBody(request)
  if (!body) return json({ error: 'Profil sa nepodařilo přečíst.' }, 400)
  const bio = typeof body.bio === 'string' ? body.bio.normalize('NFKC').trim().slice(0, 120) : user.bio ?? ''
  const gender = typeof body.gender === 'string' ? body.gender : user.gender
  const danceLevel = typeof body.dance_level === 'string' ? body.dance_level : user.dance_level
  const drinkPreference = typeof body.drink_preference === 'string' ? body.drink_preference : user.drink_preference
  if (!gender || !VALID_GENDERS.has(gender)) return json({ error: 'Vyber šohaja nebo děvčicu.' }, 400)
  if (!danceLevel || !VALID_DANCE_LEVELS.has(danceLevel)) return json({ error: 'Taneční pověst je povinná.' }, 400)
  if (!drinkPreference || !VALID_DRINKS.has(drinkPreference)) return json({ error: 'Pitný režim je povinný.' }, 400)
  await env.DB.prepare(`
    UPDATE users SET bio = ?1, gender = ?2, dance_level = ?3, drink_preference = ?4, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?5
  `).bind(bio || null, gender, danceLevel, drinkPreference, user.id).run()
  return json({ user: publicUser({ ...user, bio: bio || null, gender: gender as Gender, dance_level: danceLevel as DanceLevel, drink_preference: drinkPreference as DrinkPreference }) })
}

async function createInteraction(request: Request, env: Env, user: SessionUser) {
  const body = await parseJsonBody(request)
  const personId = typeof body?.person_id === 'string' ? body.person_id : ''
  const rawQuestions = Array.isArray(body?.questions) ? body.questions : []
  const questions = [...new Set(rawQuestions.filter((value): value is string => typeof value === 'string').map((value) => value.trim()).filter(Boolean))].slice(0, 3)
  if (!personId || personId === user.id) return json({ error: 'Sám se sebú sa do kroniky fakt nepočítáš.' }, 400)
  if (!questions.length) return json({ error: 'Napřed odklikni aspoň jednu otázku.' }, 400)

  const person = await env.DB.prepare('SELECT id FROM users WHERE id = ?1 LIMIT 1').bind(personId).first<{ id: string }>()
  if (!person) return json({ error: 'Toho člověka už tu nevidím.' }, 404)

  const previous = await env.DB.prepare(`
    SELECT COUNT(*) AS count FROM interactions
    WHERE (user_id = ?1 AND person_id = ?2) OR (user_id = ?2 AND person_id = ?1)
  `).bind(user.id, personId).first<{ count: number }>()
  const points = Number(previous?.count ?? 0) > 0 ? 2 : 5
  const interactionId = crypto.randomUUID()
  const statements: D1PreparedStatement[] = [
    env.DB.prepare('INSERT INTO interactions (id, user_id, person_id, points_awarded) VALUES (?1, ?2, ?3, ?4)').bind(interactionId, user.id, personId, points),
    env.DB.prepare('INSERT INTO score_events (id, user_id, event_type, points, source_id) VALUES (?1, ?2, ?3, ?4, ?5)')
      .bind(crypto.randomUUID(), user.id, Number(previous?.count ?? 0) > 0 ? 'interaction_repeat' : 'interaction_first', points, interactionId),
    ...questions.map((question) => env.DB.prepare('INSERT INTO interaction_questions (interaction_id, question_text) VALUES (?1, ?2)').bind(interactionId, question)),
  ]
  await env.DB.batch(statements)
  return json({ ok: true, interaction_id: interactionId, points })
}

async function listInteractions(env: Env) {
  const interactions = await env.DB.prepare(`
    SELECT i.id, i.created_at, a.display_name AS from_name, b.display_name AS to_name,
           a.profile_photo_data AS from_photo_data, b.profile_photo_data AS to_photo_data,
           i.points_awarded
    FROM interactions i
    JOIN users a ON a.id = i.user_id
    JOIN users b ON b.id = i.person_id
    ORDER BY i.created_at DESC LIMIT 200
  `).all<Record<string, unknown>>()

  const results: Record<string, unknown>[] = []
  for (const row of interactions.results ?? []) {
    const questions = await env.DB.prepare('SELECT question_text FROM interaction_questions WHERE interaction_id = ?1 ORDER BY created_at ASC')
      .bind(row.id)
      .all<{ question_text: string }>()
    results.push({ ...row, questions: (questions.results ?? []).map((item) => item.question_text) })
  }
  return json({ interactions: results })
}

async function createPhoto(request: Request, env: Env, user: SessionUser) {
  const body = await parseJsonBody(request)
  const imageData = typeof body?.image_data === 'string' ? body.image_data : ''
  const taggedUserId = typeof body?.tagged_user_id === 'string' ? body.tagged_user_id : ''
  const interactionId = typeof body?.interaction_id === 'string' ? body.interaction_id : ''
  if (!validImageData(imageData, MAX_MOMENT_PHOTO_LENGTH)) return json({ error: 'Fotka je moc velká nebo sa pokazila po cestě.' }, 400)
  if (taggedUserId === user.id) return json({ error: 'Sám sebe tagovat nemusíš.' }, 400)
  if (taggedUserId) {
    const tagged = await env.DB.prepare('SELECT id FROM users WHERE id = ?1 LIMIT 1').bind(taggedUserId).first<{ id: string }>()
    if (!tagged) return json({ error: 'Označeného člověka už tu nevidím.' }, 404)
  }
  if (interactionId) {
    const interaction = await env.DB.prepare('SELECT id FROM interactions WHERE id = ?1 LIMIT 1').bind(interactionId).first<{ id: string }>()
    if (!interaction) return json({ error: 'Ten hovor už v kronice není.' }, 404)
  }

  const photoId = crypto.randomUUID()
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(`
      INSERT INTO photos (id, author_user_id, r2_key, web_photo_data, interaction_id, photo_type, published_at)
      VALUES (?1, ?2, ?3, ?4, ?5, 'moment', CURRENT_TIMESTAMP)
    `).bind(photoId, user.id, `d1-preview/${photoId}.webp`, imageData, interactionId || null),
    env.DB.prepare('INSERT INTO photo_tags (photo_id, user_id) VALUES (?1, ?2)').bind(photoId, user.id),
  ]
  if (taggedUserId) statements.push(env.DB.prepare('INSERT INTO photo_tags (photo_id, user_id) VALUES (?1, ?2)').bind(photoId, taggedUserId))
  await env.DB.batch(statements)
  return json({ ok: true, photo_id: photoId }, 201)
}

async function listMyPhotos(env: Env, user: SessionUser) {
  const result = await env.DB.prepare(`
    SELECT DISTINCT p.id, p.created_at, p.web_photo_data, p.author_user_id,
           author.display_name AS author_name
    FROM photos p
    JOIN users author ON author.id = p.author_user_id
    LEFT JOIN photo_tags t ON t.photo_id = p.id
    WHERE p.author_user_id = ?1 OR t.user_id = ?1
    ORDER BY p.created_at DESC LIMIT 60
  `).bind(user.id).all<Record<string, unknown>>()
  return json({ photos: result.results ?? [] })
}

async function chronicle(env: Env) {
  type Event = Record<string, unknown> & { type: 'invite' | 'interaction' | 'photo'; created_at: string }
  const events: Event[] = []

  const invites = await env.DB.prepare(`
    SELECT u.id, u.created_at, inviter.display_name AS inviter_name, u.display_name AS joined_name,
           u.profile_photo_data AS joined_photo_data
    FROM users u JOIN users inviter ON inviter.id = u.inviter_user_id
    ORDER BY u.created_at DESC LIMIT 80
  `).all<Record<string, unknown> & { created_at: string }>()
  for (const row of invites.results ?? []) events.push({ type: 'invite', ...row })

  const interactions = await env.DB.prepare(`
    SELECT i.id, i.created_at, a.display_name AS from_name, b.display_name AS to_name,
           b.profile_photo_data AS to_photo_data
    FROM interactions i
    JOIN users a ON a.id = i.user_id
    JOIN users b ON b.id = i.person_id
    ORDER BY i.created_at DESC LIMIT 80
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
    ORDER BY p.created_at DESC LIMIT 80
  `).all<Record<string, unknown> & { created_at: string }>()
  for (const row of photos.results ?? []) events.push({ type: 'photo', ...row })

  events.sort((a, b) => b.created_at.localeCompare(a.created_at))
  return json({ events: events.slice(0, 120) })
}

async function createShot(request: Request, env: Env, user: SessionUser) {
  const body = await parseJsonBody(request)
  const recipientId = typeof body?.recipient_user_id === 'string' ? body.recipient_user_id : ''
  if (!recipientId || recipientId === user.id) return json({ error: 'Sobě panáka přes appku kupovat nemusíš.' }, 400)
  const recipient = await env.DB.prepare('SELECT id, drink_preference FROM users WHERE id = ?1 LIMIT 1')
    .bind(recipientId).first<{ id: string; drink_preference: DrinkPreference | null }>()
  if (!recipient) return json({ error: 'Ten člověk sa někam ztratil.' }, 404)
  if (recipient.drink_preference === 'none') return json({ error: 'Tenhle člověk má „Nechcu, díky“. Panáka mu neposílej.' }, 409)
  const shotId = crypto.randomUUID()
  await env.DB.prepare('INSERT INTO shots (id, giver_user_id, current_recipient_user_id) VALUES (?1, ?2, ?3)')
    .bind(shotId, user.id, recipientId).run()
  return json({ ok: true, shot_id: shotId }, 201)
}

async function pendingShots(env: Env, user: SessionUser) {
  const result = await env.DB.prepare(`
    SELECT s.id, s.created_at, giver.id AS giver_id, giver.display_name AS giver_name,
           giver.profile_photo_data AS giver_photo_data
    FROM shots s JOIN users giver ON giver.id = s.giver_user_id
    WHERE s.current_recipient_user_id = ?1 AND s.status = 'offered'
    ORDER BY s.created_at DESC
  `).bind(user.id).all<Record<string, unknown>>()
  return json({ shots: result.results ?? [] })
}

async function acceptShot(env: Env, user: SessionUser, shotId: string) {
  const shot = await env.DB.prepare('SELECT id, giver_user_id, current_recipient_user_id, status FROM shots WHERE id = ?1 LIMIT 1')
    .bind(shotId).first<ShotRow>()
  if (!shot || shot.status !== 'offered' || shot.current_recipient_user_id !== user.id) return json({ error: 'Ten panák už není na tvojem stole.' }, 409)
  await env.DB.prepare("UPDATE shots SET status = 'accepted', accepted_by_user_id = ?1, accepted_at = CURRENT_TIMESTAMP WHERE id = ?2")
    .bind(user.id, shotId).run()
  return json({ ok: true })
}

async function forwardShot(request: Request, env: Env, user: SessionUser, shotId: string) {
  const body = await parseJsonBody(request)
  const recipientId = typeof body?.recipient_user_id === 'string' ? body.recipient_user_id : ''
  if (!recipientId || recipientId === user.id) return json({ error: 'Pošli ho někomu jinému, ne zase sobě.' }, 400)
  const shot = await env.DB.prepare('SELECT id, giver_user_id, current_recipient_user_id, status FROM shots WHERE id = ?1 LIMIT 1')
    .bind(shotId).first<ShotRow>()
  if (!shot || shot.status !== 'offered' || shot.current_recipient_user_id !== user.id) return json({ error: 'Ten panák už nemáš co přeposílat.' }, 409)
  const recipient = await env.DB.prepare('SELECT id, drink_preference FROM users WHERE id = ?1 LIMIT 1')
    .bind(recipientId).first<{ id: string; drink_preference: DrinkPreference | null }>()
  if (!recipient) return json({ error: 'Takový člověk tu není.' }, 404)
  if (recipient.drink_preference === 'none') return json({ error: 'Tomuhle to neposílej. Panáky nechce.' }, 409)
  await env.DB.batch([
    env.DB.prepare('UPDATE shots SET current_recipient_user_id = ?1 WHERE id = ?2 AND status = ?3').bind(recipientId, shotId, 'offered'),
    env.DB.prepare('INSERT INTO shot_transfers (id, shot_id, from_user_id, to_user_id) VALUES (?1, ?2, ?3, ?4)')
      .bind(crypto.randomUUID(), shotId, user.id, recipientId),
  ])
  return json({ ok: true })
}

async function shotLeaderboard(env: Env) {
  const generous = await env.DB.prepare(`
    SELECT u.id, u.display_name, u.profile_photo_data, COUNT(s.id) AS count
    FROM users u JOIN shots s ON s.giver_user_id = u.id
    GROUP BY u.id, u.display_name, u.profile_photo_data
    ORDER BY count DESC, u.display_name COLLATE NOCASE ASC LIMIT 10
  `).all<Record<string, unknown>>()
  const received = await env.DB.prepare(`
    SELECT u.id, u.display_name, u.profile_photo_data, COUNT(s.id) AS count
    FROM users u JOIN shots s ON s.accepted_by_user_id = u.id AND s.status = 'accepted'
    GROUP BY u.id, u.display_name, u.profile_photo_data
    ORDER BY count DESC, u.display_name COLLATE NOCASE ASC LIMIT 10
  `).all<Record<string, unknown>>()
  return json({ generous: generous.results ?? [], received: received.results ?? [] })
}

async function handleApi(request: Request, env: Env) {
  const url = new URL(request.url)
  const ready = await databaseReady(env)
  if (request.method === 'GET' && url.pathname === '/api/health') {
    return ready ? json({ ok: true, database: 'ready' }) : json({ ok: false, database: 'not_ready', error: 'Databáza ještě nemá všecky tabulky.' }, 503)
  }
  if (!ready) return json({ error: 'Databáza sa ještě šteluje. Po deployi to zkus znova.' }, 503)

  if (request.method === 'GET' && url.pathname === '/api/users') return listUsers(env)
  if (request.method === 'POST' && url.pathname === '/api/register') return register(request, env)
  if (request.method === 'POST' && url.pathname === '/api/login') return login(request, env)
  if (request.method === 'POST' && url.pathname === '/api/logout') return logout(request, env)
  if (request.method === 'GET' && url.pathname === '/api/chronicle') return chronicle(env)
  if (request.method === 'GET' && url.pathname === '/api/interactions') return listInteractions(env)
  if (request.method === 'GET' && url.pathname === '/api/shots/leaderboard') return shotLeaderboard(env)

  if (request.method === 'GET' && url.pathname === '/api/me') {
    const user = await getSessionUser(request, env.DB)
    return user ? json({ user: publicUser(user) }) : json({ user: null }, 401)
  }

  const user = await getSessionUser(request, env.DB)
  if (!user) return json({ error: 'Nejsi přihlášený.' }, 401)

  if (request.method === 'PATCH' && url.pathname === '/api/me/availability') return setAvailability(request, env, user)
  if (request.method === 'PATCH' && url.pathname === '/api/me/profile') return updateProfile(request, env, user)
  if (request.method === 'POST' && url.pathname === '/api/interactions') return createInteraction(request, env, user)
  if (request.method === 'POST' && url.pathname === '/api/photos') return createPhoto(request, env, user)
  if (request.method === 'GET' && url.pathname === '/api/photos/mine') return listMyPhotos(env, user)
  if (request.method === 'POST' && url.pathname === '/api/shots') return createShot(request, env, user)
  if (request.method === 'GET' && url.pathname === '/api/shots/mine') return pendingShots(env, user)

  const acceptMatch = url.pathname.match(/^\/api\/shots\/([^/]+)\/accept$/)
  if (request.method === 'POST' && acceptMatch) return acceptShot(env, user, decodeURIComponent(acceptMatch[1]))
  const forwardMatch = url.pathname.match(/^\/api\/shots\/([^/]+)\/forward$/)
  if (request.method === 'POST' && forwardMatch) return forwardShot(request, env, user, decodeURIComponent(forwardMatch[1]))

  return json({ error: 'Tudy cesta nevede.' }, 404)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env)
      } catch (error) {
        console.error('api_failed', error)
        return json({ error: 'Backend sa někde zamotal. Pošli přesnú hlášku a spravíme ho.' }, 500)
      }
    }
    return env.ASSETS.fetch(request)
  },
}
