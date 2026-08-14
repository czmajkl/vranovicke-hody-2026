import {
  ArrowLeft,
  BookOpenCheck,
  Camera,
  Check,
  ChevronRight,
  CircleUserRound,
  Clock3,
  GlassWater,
  Home,
  Images,
  LoaderCircle,
  LockKeyhole,
  LogIn,
  MessageCircle,
  Moon,
  PartyPopper,
  Pencil,
  QrCode,
  Save,
  Search,
  Send,
  Share2,
  Shuffle,
  Sparkles,
  Trophy,
  UserPlus,
  UsersRound,
  Wine,
  type LucideIcon,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  acceptShot,
  buyShot,
  confirmInteraction,
  forwardShot,
  getChronicle,
  getInteractions,
  getMe,
  getMyPhotos,
  getPendingShots,
  getShotLeaderboard,
  getUsers,
  loginUser,
  logoutUser,
  registerUser,
  saveMomentPhoto,
  setAvailability,
  updateProfile,
  type ApiUser,
  type ChronicleEvent,
  type DanceLevel,
  type DrinkPreference,
  type Gender,
  type InteractionRecord,
  type MomentPhoto,
  type PendingShot,
  type ShotLeaderboardRow,
} from './api-next'
import { compressMomentPhoto, compressProfilePhoto } from './photo-next'
import './profile-facts.css'
import './hody-next.css'

const INVITE_BASE = 'https://vranovicke-hody-2026.michaelmilis98.workers.dev/'
const PERSON_SECONDS = 5 * 60

const QUESTION_SETS = [
  [
    'Co tě dokáže spolehlivě rozesmát?',
    'Co je něco, co o tobě lidi netipnou?',
    'Jakou úplně zbytečnou schopnost bys chtěl perfektně ovládat?',
  ],
  [
    'Kdybys mohl právě teď někam odjet, kam bys jel?',
    'Co ti poslední dobou udělalo fakt radost?',
    'Která úplně obyčejná věc ti dělá větší radost, než by měla?',
  ],
  [
    'Jaká věc ti jde překvapivě dobře?',
    'Co bys chtěl, aby o tobě lidi chápali lépe?',
    'Kdybys měl vlastní svátek, jak by se slavil?',
  ],
  [
    'Jaký malý moment si z poslední doby fakt pamatuješ?',
    'Který člověk tě v životě nejvíc ovlivnil?',
    'Kdybys mohl na týden umět jednu novou věc, co by to bylo?',
  ],
]

const GENDER_LABELS: Record<Gender, string> = {
  male: 'Šohaj',
  female: 'Děvčica',
}

const DANCE_LABELS: Record<DanceLevel, string> = {
  pro: 'Mazák od muziky',
  amateur: 'Dvě levé v čižmách',
  wild: 'Tož to nějak odskáču',
}

const DRINK_LABELS: Record<DrinkPreference, string> = {
  slivovica: 'Slivovicu, jak sa sluší',
  green: 'Zelenú nebo něco hodnějšího',
  dark: 'Fernet či rum, hlavně ať to kope',
  anything: 'Co naleješ, to vypiju',
  none: 'Nechcu, díky',
}

type Screen = 'home' | 'people' | 'chronicle' | 'interactions' | 'game' | 'profile'
type EntryMode = 'welcome' | 'register' | 'login' | 'app'

const navItems: { id: Exclude<Screen, 'interactions'>; label: string; Icon: LucideIcon }[] = [
  { id: 'home', label: 'Dom', Icon: Home },
  { id: 'people', label: 'Lidi', Icon: UsersRound },
  { id: 'chronicle', label: 'Kronika', Icon: Images },
  { id: 'game', label: 'Hra', Icon: Trophy },
  { id: 'profile', label: 'Já', Icon: CircleUserRound },
]

function questionSetFor(user: ApiUser) {
  const seed = [...user.id].reduce((sum, character) => sum + character.charCodeAt(0), 0)
  return QUESTION_SETS[seed % QUESTION_SETS.length]
}

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}:${rest.toString().padStart(2, '0')}`
}

function formatStamp(value: string) {
  const parsed = new Date(`${value.replace(' ', 'T')}Z`)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }).format(parsed)
}

function genderLabel(user: ApiUser) {
  return user.gender ? GENDER_LABELS[user.gender] : 'Zatím tají'
}

function danceLabel(user: ApiUser) {
  return user.dance_level ? DANCE_LABELS[user.dance_level] : 'Taneční pověst neznámá'
}

function drinkLabel(user: ApiUser) {
  return user.drink_preference ? DRINK_LABELS[user.drink_preference] : 'Pitný režim nevyplněný'
}

function canReceiveShot(user: ApiUser) {
  return user.drink_preference !== 'none'
}

function Avatar({ user, size = 'normal' }: { user: Pick<ApiUser, 'display_name' | 'profile_photo_data'>; size?: 'small' | 'normal' | 'hero' }) {
  return (
    <div className={`v2-avatar v2-avatar-${size}`}>
      {user.profile_photo_data
        ? <img src={user.profile_photo_data} alt={`Fotka ${user.display_name}`} />
        : <span>{user.display_name.slice(0, 1).toUpperCase()}</span>}
    </div>
  )
}

function FolkRosette() {
  return <span className="folk-rosette" aria-hidden="true" />
}

function PageHeader({ eyebrow, title, copy }: { eyebrow: string; title: string; copy?: string }) {
  return (
    <header className="page-header v2-page-header">
      <div className="page-header-ornament" aria-hidden="true" />
      <div className="page-header-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {copy && <p className="page-subtitle">{copy}</p>}
      </div>
      <FolkRosette />
    </header>
  )
}

function ProfileFacts({ user, compact = false }: { user: ApiUser; compact?: boolean }) {
  return (
    <div className={`v3-profile-facts v4-profile-facts${compact ? ' compact' : ''}`}>
      <span><strong>{genderLabel(user)}</strong><small>co seš zač</small></span>
      <span><strong>{danceLabel(user)}</strong><small>jak sa vrtíš</small></span>
      <span className={user.drink_preference === 'none' ? 'no-shot' : ''}><strong>{drinkLabel(user)}</strong><small>co ti nalét</small></span>
    </div>
  )
}

function WelcomeScreen({ inviter, onRegister, onLogin }: { inviter: string; onRegister: () => void; onLogin: () => void }) {
  return (
    <section className="entry-screen v2-entry">
      <div className="entry-poster">
        <div className="entry-pattern" aria-hidden="true" />
        <div className="entry-corner entry-corner-a" aria-hidden="true" />
        <div className="entry-corner entry-corner-b" aria-hidden="true" />
        <div className="entry-rosette"><FolkRosette /></div>
        <p className="entry-kicker">Vranovické hody · 2026</p>
        <h1>Vitaj na hodech!</h1>
        <p className="entry-lead">Najdi člověka, odklikni otázku, pobav sa a telefon zase strč do kapsy. Žádná NASA.</p>
        {inviter && <p className="invite-note"><Sparkles size={15} /> Do placu tě dotáhl {inviter}.</p>}
        <div className="entry-ribbons" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      </div>
      <div className="entry-actions">
        <button className="entry-primary" type="button" onClick={onRegister}><UserPlus size={20} /> Založit sa do hry</button>
        <button className="entry-secondary" type="button" onClick={onLogin}><LogIn size={20} /> Už su tu</button>
      </div>
      <p className="prototype-warning">Hraje sa mezi lidma. Mobil je enom tahák, ne druhý život.</p>
    </section>
  )
}

function RegisterScreen({ inviter, onBack, onDone }: { inviter: string; onBack: () => void; onDone: (user: ApiUser) => void }) {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [bio, setBio] = useState('')
  const [gender, setGender] = useState<Gender | ''>('')
  const [danceLevel, setDanceLevel] = useState<DanceLevel | ''>('')
  const [drinkPreference, setDrinkPreference] = useState<DrinkPreference | ''>('')
  const [photo, setPhoto] = useState('')
  const [photoBusy, setPhotoBusy] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const pickPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setPhotoBusy(true)
    setError('')
    try {
      setPhoto(await compressProfilePhoto(file))
    } catch (reason) {
      setPhoto('')
      setError(reason instanceof Error ? reason.message : 'Fotka sa nepodařila nachystat.')
    } finally {
      setPhotoBusy(false)
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || photoBusy || name.trim().length < 2 || password.length < 4 || !photo || !gender || !danceLevel || !drinkPreference) return
    setBusy(true)
    setError('')
    try {
      const result = await registerUser({
        name: name.trim(),
        password,
        bio: bio.trim(),
        profile_photo_data: photo,
        gender,
        dance_level: danceLevel,
        drink_preference: drinkPreference,
        ref: inviter || undefined,
      })
      onDone(result.user)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Profil sa nepodařilo založit.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="entry-screen form-entry v2-entry">
      <button className="entry-back" type="button" onClick={onBack}><ArrowLeft size={18} /> Zpátky na náves</button>
      <div className="entry-form-card">
        <div className="form-ornament" aria-hidden="true" />
        <FolkRosette />
        <p className="eyebrow">Nový kus do party</p>
        <h1>Hoď sa mezi nás.</h1>
        <p className="form-intro">Méno, fotka a tři zásadní diagnózy: kdo seš, co provádíš na parketu a co ti případně nalét.</p>
        <form onSubmit={submit} className="entry-form">
          <label><span>Jak ti máme říkat</span><input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={40} placeholder="Třeba Martin" required /></label>
          <label><span>Heslo · minimálně 4 znaky</span><div className="input-with-icon"><LockKeyhole size={17} /><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={4} maxLength={128} placeholder="1234 klidně stačí" required /></div></label>

          <div className="v3-registration-facts v4-registration-facts">
            <label>
              <span>Co seš zač</span>
              <select value={gender} onChange={(event) => setGender(event.target.value as Gender | '')} required>
                <option value="">Vyber sa</option>
                <option value="male">Šohaj</option>
                <option value="female">Děvčica</option>
              </select>
            </label>
            <label>
              <span>Jak seš na tom s tancem</span>
              <select value={danceLevel} onChange={(event) => setDanceLevel(event.target.value as DanceLevel | '')} required>
                <option value="">Přiznaj barvu</option>
                <option value="pro">Mazák od muziky</option>
                <option value="amateur">Dvě levé v čižmách</option>
                <option value="wild">Tož to nějak odskáču</option>
              </select>
            </label>
            <label className="v4-drink-select">
              <span>Co ti može kdo nalét</span>
              <select value={drinkPreference} onChange={(event) => setDrinkPreference(event.target.value as DrinkPreference | '')} required>
                <option value="">Vyber pitný režim</option>
                <option value="slivovica">Slivovicu, jak sa sluší</option>
                <option value="green">Zelenú nebo něco hodnějšího</option>
                <option value="dark">Fernet či rum, hlavně ať to kope</option>
                <option value="anything">Co naleješ, to vypiju</option>
                <option value="none">Nechcu, díky</option>
              </select>
            </label>
          </div>
          {drinkPreference === 'none' && <p className="v4-no-shot-note"><Wine size={16} /> Dobrá. Tlačítko na panáka u tebe ostatní vůbec neuvidí.</p>}

          <label><span>Co o tobě vědět <em>nemusíš nic</em></span><textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={120} placeholder="Když mě nenajdeš, su asi..." /></label>
          <label className={`v2-photo-required${photo ? ' ready' : ''}`}>
            {photo ? <img src={photo} alt="Náhled profilové fotky" /> : <Camera size={28} />}
            <div><strong>{photo ? 'Fotka sedí' : 'Nahraj svoju fotku'}</strong><span>{photoBusy ? 'Štelujem ju do rozumné velikosti…' : 'povinné · foťák nebo galerie'}</span></div>
            <input type="file" accept="image/*" capture="user" onChange={pickPhoto} required={!photo} />
          </label>
          {inviter && <p className="v2-inline-note"><UserPlus size={16} /> Pozvánka je od: <strong>{inviter}</strong></p>}
          {error && <p className="entry-error" role="alert">{error}</p>}
          <button className="entry-primary" type="submit" disabled={busy || photoBusy || !photo || !gender || !danceLevel || !drinkPreference}><PartyPopper size={20} /> {busy ? 'Zapisuju tě do kroniky…' : 'Tož su na hodech!'}</button>
        </form>
      </div>
    </section>
  )
}

function LoginScreen({ onBack, onDone }: { onBack: () => void; onDone: (user: ApiUser) => void }) {
  const [users, setUsers] = useState<ApiUser[]>([])
  const [selected, setSelected] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getUsers()
      .then(({ users: next }) => {
        setUsers(next)
        setSelected(next[0]?.display_name ?? '')
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Lidi sa nepodařilo načíst.'))
      .finally(() => setLoading(false))
  }, [])

  const chosen = users.find((user) => user.display_name === selected)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!selected || password.length < 4 || busy) return
    setBusy(true)
    setError('')
    try {
      const result = await loginUser({ name: selected, password })
      onDone(result.user)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Dovnitř tě to nepustilo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="entry-screen form-entry v2-entry">
      <button className="entry-back" type="button" onClick={onBack}><ArrowLeft size={18} /> Zpátky na náves</button>
      <div className="entry-form-card login-card">
        <div className="form-ornament" aria-hidden="true" />
        <FolkRosette />
        <p className="eyebrow">Už tě známe</p>
        <h1>Který ty seš?</h1>
        <p className="form-intro">Najdi sa, napiš heslo a val dovnitř. E-mail necháme internetovým obchodům.</p>
        <form onSubmit={submit} className="entry-form">
          {loading ? <p className="login-empty"><LoaderCircle className="v2-spin" size={18} /> Lovím lidi z databázy…</p> : users.length ? (
            <>
              <label><span>Vyber svoje méno</span><select value={selected} onChange={(event) => setSelected(event.target.value)}>{users.map((user) => <option key={user.id}>{user.display_name}</option>)}</select></label>
              {chosen && <div className="v2-login-person"><Avatar user={chosen} /><div><strong>{chosen.display_name}</strong><p>{chosen.bio || 'O sobě zatím drží bobříka mlčení.'}</p><ProfileFacts user={chosen} compact /></div></div>}
              <label><span>Heslo</span><div className="input-with-icon"><LockKeyhole size={17} /><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={4} maxLength={128} placeholder="Aspoň 4 znaky" required /></div></label>
            </>
          ) : <p className="login-empty">Nikdo tu eště není. Tož budeš první.</p>}
          {error && <p className="entry-error" role="alert">{error}</p>}
          <button className="entry-primary" type="submit" disabled={busy || loading || !selected}><LogIn size={20} /> {busy ? 'Otvírám vrata…' : 'Valím dovnitř'}</button>
        </form>
      </div>
    </section>
  )
}

function HomeScreen({ me, people, preferredTargetId, onPickTarget }: { me: ApiUser; people: ApiUser[]; preferredTargetId: string; onPickTarget: (id: string) => void }) {
  const eligible = useMemo(() => people.filter((user) => user.id !== me.id && user.is_available === 1), [people, me.id])
  const preferredIndex = Math.max(0, eligible.findIndex((user) => user.id === preferredTargetId))
  const [index, setIndex] = useState(preferredIndex)
  const [round, setRound] = useState(0)
  const person = eligible[index % Math.max(eligible.length, 1)]
  const [seconds, setSeconds] = useState(PERSON_SECONDS)
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const [points, setPoints] = useState(0)
  const [interactionId, setInteractionId] = useState('')
  const [busy, setBusy] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [momentPhoto, setMomentPhoto] = useState('')
  const cameraInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!person) return
    setSeconds(PERSON_SECONDS)
    setSelectedQuestions([])
    setDone(false)
    setPoints(0)
    setInteractionId('')
    setStatus('')
    setMomentPhoto('')
    const timer = window.setInterval(() => setSeconds((current) => Math.max(0, current - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [person?.id, round])

  useEffect(() => {
    if (!preferredTargetId) return
    const nextIndex = eligible.findIndex((user) => user.id === preferredTargetId)
    if (nextIndex >= 0) setIndex(nextIndex)
  }, [preferredTargetId, eligible])

  if (!person) {
    return (
      <section className="screen screen-home">
        <PageHeader eyebrow="Na place je zatím ticho" title="Nikoho ti nemám koho hodit." copy="Až sa přidá další člověk, tady sa objeví. Zatím možeš verbovat přes svoje QR." />
      </section>
    )
  }

  const questions = questionSetFor(person)
  const shotAllowed = canReceiveShot(person)

  const toggleQuestion = (question: string) => {
    if (done) return
    setSelectedQuestions((current) => current.includes(question) ? current.filter((item) => item !== question) : [...current, question])
  }

  const finishConversation = async () => {
    if (!selectedQuestions.length || busy) return
    setBusy(true)
    setStatus('')
    try {
      const result = await confirmInteraction(person.id, selectedQuestions)
      setDone(true)
      setPoints(result.points)
      setInteractionId(result.interaction_id)
      setStatus(`Zapsané. +${result.points} bodů a teď už telefon neřeš.`)
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : 'Hovor sa nepodařilo zapsat.')
    } finally {
      setBusy(false)
    }
  }

  const nextPerson = () => {
    const next = eligible.length > 1 ? (index + 1) % eligible.length : index
    setIndex(next)
    setRound((value) => value + 1)
    onPickTarget(eligible[next]?.id ?? '')
  }

  const buyPanak = async () => {
    if (!shotAllowed) return
    setStatus('')
    try {
      await buyShot(person.id)
      setStatus(`Panák pro ${person.display_name} je na cestě. Teď už enom najít někoho, kdo ho fakt donese.`)
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : 'Panák sa nepodařilo poslat.')
    }
  }

  const pickMoment = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setPhotoBusy(true)
    setStatus('')
    try {
      const imageData = await compressMomentPhoto(file)
      await saveMomentPhoto({ image_data: imageData, tagged_user_id: person.id, interaction_id: interactionId || undefined })
      setMomentPhoto(imageData)
      setStatus(`Momentka s ${person.display_name} je v Kronice. Tentokrát fakt aj po reloadu.`)
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : 'Momentka sa nepodařila uložit.')
    } finally {
      setPhotoBusy(false)
    }
  }

  return (
    <section className="screen screen-home">
      <div className="festival-banner v2-festival-banner">
        <div className="festival-banner-pattern" aria-hidden="true" />
        <div className="festival-banner-copy"><span className="banner-kicker">Vranovice</span><p>Hody 2026</p><strong>Tož běž za lidma.</strong></div>
        <FolkRosette />
      </div>

      <div className="v2-timer-row">
        <span><Clock3 size={18} /> Na {person.display_name}: <strong>{formatCountdown(seconds)}</strong></span>
        {seconds === 0 && <em>Čas vyfučel. Kecat možeš dál.</em>}
      </div>

      <article className="person-card v2-person-card">
        <div className="card-ribbon"><span>TEĎ TI PADL</span><span>HODY 2026</span></div>
        <div className="v2-hero-photo"><Avatar user={person} size="hero" /></div>
        <div className="person-copy">
          <p className="eyebrow">Tož sa seznam</p>
          <h2>{person.display_name}</h2>
          <p className="person-note">{person.bio || 'O sobě zatím nic nevyklopil.'}</p>
          <ProfileFacts user={person} compact />
        </div>

        {!done ? (
          <div className="v2-question-zone">
            <div className="v2-section-heading"><div><span>Napřed něco odklikni</span><strong>Bez otázky není „Bavili sme sa“.</strong></div><BookOpenCheck size={24} /></div>
            {questions.map((question, questionIndex) => {
              const checked = selectedQuestions.includes(question)
              return (
                <article className={`v2-question${checked ? ' checked' : ''}`} key={question}>
                  <span className="v2-question-number">{questionIndex + 1}</span>
                  <p>{question}</p>
                  <button type="button" onClick={() => toggleQuestion(question)}>{checked ? <><Check size={17} /> Tož jo</> : 'Tuhle sme dali'}</button>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="v2-free-mode">
            <Sparkles size={25} />
            <div><strong>Volná zábava.</strong><p>Máte odpracované. Teď už si povídejte bez elektronického dohledu.</p></div>
            {points > 0 && <span>+{points} b.</span>}
          </div>
        )}

        <div className="actions v2-actions">
          {!done && <button className="primary-button" type="button" onClick={finishConversation} disabled={!selectedQuestions.length || busy}><MessageCircle size={19} /> {busy ? 'Zapisuju…' : 'Bavili sme sa'}</button>}
          <button className="secondary-button v2-photo-button" type="button" disabled={photoBusy} onClick={() => cameraInput.current?.click()}><Camera size={19} /> {photoBusy ? 'Štelujem fotku…' : 'Cvaknút si fotku'}</button>
          <input ref={cameraInput} className="v2-hidden-input" type="file" accept="image/*" capture="environment" onChange={pickMoment} />
          {shotAllowed
            ? <button className="secondary-button v2-shot-button" type="button" onClick={buyPanak}><GlassWater size={19} /> Kup mu panáka</button>
            : <div className="v4-shot-blocked"><Wine size={18} /><span>{person.display_name} má napsané „Nechcu, díky“. Tož respekt.</span></div>}
          <button className="text-button" type="button" onClick={nextPerson}><Shuffle size={18} /> Hoď někoho jiného <ChevronRight size={17} /></button>
        </div>

        {momentPhoto && <div className="v2-moment-preview v4-moment-preview"><img src={momentPhoto} alt="Čerstvá momentka" /><span>Uložené v Hodové kronice.</span></div>}
        {status && <p className="v2-status" role="status">{status}</p>}
      </article>
    </section>
  )
}

function PeopleScreen({ me, people, onPick }: { me: ApiUser; people: ApiUser[]; onPick: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const filtered = people.filter((user) => user.id !== me.id && user.display_name.toLowerCase().includes(query.toLowerCase()))

  const sendShot = async (user: ApiUser) => {
    if (!canReceiveShot(user)) return
    try {
      await buyShot(user.id)
      setStatus(`Panák pro ${user.display_name} poslaný. Teď sa ukaž, hrdino.`)
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : 'Panák sa neposlal.')
    }
  }

  return (
    <section className="screen">
      <PageHeader eyebrow="Kdo je na place" title="Naši lidi" copy="Najdi si člověka ručně, nebo nech Domovku losovat za tebe." />
      <label className="search-box"><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Koho hledáš?" /></label>
      {status && <p className="v2-status">{status}</p>}
      <div className="people-grid">
        {filtered.map((user) => (
          <article className="person-tile v2-person-tile" key={user.id}>
            <div className="v2-tile-photo"><Avatar user={user} size="hero" /></div>
            <div className="person-tile-body">
              <div className="person-title-row"><h2>{user.display_name}</h2><span className={`v2-availability ${user.is_available ? '' : 'quiet'}`}>{user.is_available ? 'na place' : 'Neotravuj'}</span></div>
              <p>{user.bio || 'Nic na sebe zatím nepráskl.'}</p>
              <ProfileFacts user={user} compact />
              <div className="v2-tile-actions">
                <button className="mini-button" type="button" onClick={() => onPick(user.id)}>Nahodit otázky <ChevronRight size={15} /></button>
                {canReceiveShot(user)
                  ? <button className="mini-button" type="button" onClick={() => sendShot(user)}><GlassWater size={15} /> Panák</button>
                  : <span className="v4-no-panak-chip"><Wine size={14} /> panáky nechce</span>}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function ChronicleScreen({ onOpenInteractions }: { onOpenInteractions: () => void }) {
  const [events, setEvents] = useState<ChronicleEvent[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    getChronicle().then((result) => setEvents(result.events)).catch((reason) => setError(reason instanceof Error ? reason.message : 'Kronika sa někde zatoulala.'))
  }, [])

  return (
    <section className="screen">
      <PageHeader eyebrow="Hodová kronika" title="Co sa tu semlelo" copy="Pozvánky, hovory a momentky. Tolik důkazního materiálu snad postačí." />
      <button className="v2-log-button" type="button" onClick={onOpenInteractions}><BookOpenCheck size={20} /><span><strong>Všecky hovory</strong><small>Kdo s kým a které otázky odklikl</small></span><ChevronRight size={18} /></button>
      {error && <p className="entry-error">{error}</p>}
      <div className="v2-chronicle-list">
        {events.length === 0 && !error && <div className="v2-empty"><Images size={28} /><strong>Zatím tu fučí větr.</strong><p>Až sa něco semele, Kronika to práskne.</p></div>}
        {events.map((event) => {
          if (event.type === 'invite') {
            return (
              <article className="v2-chronicle-event invite-event" key={`invite-${event.id}`}>
                <Avatar user={{ display_name: event.joined_name, profile_photo_data: event.joined_photo_data }} />
                <div><span>{formatStamp(event.created_at)}</span><h2>{event.inviter_name} dotáhl {event.joined_name} na hody!</h2><p>Nová tvář v placu. Tož sa s ní někdo běžte pobavit.</p></div>
                <UserPlus size={23} />
              </article>
            )
          }
          if (event.type === 'photo') {
            return (
              <article className="v4-chronicle-photo" key={`photo-${event.id}`}>
                <img src={event.web_photo_data} alt={`Momentka od ${event.author_name}`} />
                <div><span>{formatStamp(event.created_at)}</span><h2>{event.author_name}{event.tagged_name ? ` + ${event.tagged_name}` : ''}</h2><p>Cvakli momentku a nechali ju v kronice.</p></div>
              </article>
            )
          }
          return (
            <article className="v2-chronicle-event talk-event" key={`talk-${event.id}`}>
              <Avatar user={{ display_name: event.to_name, profile_photo_data: event.to_photo_data }} />
              <div><span>{formatStamp(event.created_at)}</span><h2>{event.from_name} sa bavil s {event.to_name}.</h2><p>Otázky sú ve výpisu hovorů, ať z Kroniky není účetní kniha.</p></div>
              <MessageCircle size={23} />
            </article>
          )
        })}
      </div>
    </section>
  )
}

function InteractionsScreen({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<InteractionRecord[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    getInteractions().then((result) => setItems(result.interactions)).catch((reason) => setError(reason instanceof Error ? reason.message : 'Hovory sa nepodařilo vytáhnút.'))
  }, [])

  return (
    <section className="screen">
      <button className="entry-back v2-page-back" type="button" onClick={onBack}><ArrowLeft size={18} /> Zpátky do Kroniky</button>
      <PageHeader eyebrow="Kontrolní lejstro" title="Všecky hovory" copy="Enom verifikace. Kdo, s kým, kdy a co odklikl před „Bavili sme sa“." />
      {error && <p className="entry-error">{error}</p>}
      <div className="v2-interaction-list">
        {items.map((item) => (
          <article className="v2-interaction-record" key={item.id}>
            <div className="v2-interaction-people"><strong>{item.from_name}</strong><MessageCircle size={16} /><strong>{item.to_name}</strong><span>{formatStamp(item.created_at)}</span></div>
            <div className="v2-confirmed-questions">{item.questions.map((question) => <p key={question}><Check size={15} /> {question}</p>)}</div>
            <small>Potvrzené před zápisem hovoru · +{item.points_awarded} b.</small>
          </article>
        ))}
        {!items.length && !error && <div className="v2-empty"><MessageCircle size={27} /><strong>Zatím ani slovo.</strong></div>}
      </div>
    </section>
  )
}

function Leaderboard({ title, rows }: { title: string; rows: ShotLeaderboardRow[] }) {
  return (
    <div className="v2-shot-board">
      <h3>{title}</h3>
      {rows.length ? rows.map((row, index) => (
        <div className="v2-shot-rank" key={row.id}><span>{index + 1}.</span><Avatar user={{ display_name: row.display_name, profile_photo_data: row.profile_photo_data }} size="small" /><strong>{row.display_name}</strong><em>{row.count}×</em></div>
      )) : <p className="v2-board-empty">Zatím nula. Hostinec by zaplakal.</p>}
    </div>
  )
}

function GameScreen({ me, people }: { me: ApiUser; people: ApiUser[] }) {
  const [pending, setPending] = useState<PendingShot[]>([])
  const [generous, setGenerous] = useState<ShotLeaderboardRow[]>([])
  const [received, setReceived] = useState<ShotLeaderboardRow[]>([])
  const [forwardTo, setForwardTo] = useState<Record<string, string>>({})
  const [status, setStatus] = useState('')
  const forwardCandidates = people.filter((person) => person.id !== me.id && canReceiveShot(person))

  const load = async () => {
    try {
      const [shotsResult, board] = await Promise.all([getPendingShots(), getShotLeaderboard()])
      setPending(shotsResult.shots)
      setGenerous(board.generous)
      setReceived(board.received)
      setForwardTo((current) => {
        const next = { ...current }
        for (const shot of shotsResult.shots) if (!next[shot.id]) next[shot.id] = forwardCandidates[0]?.id ?? ''
        return next
      })
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : 'Panáková účetnica zdechla.')
    }
  }

  useEffect(() => { void load() }, [])

  const accept = async (shot: PendingShot) => {
    try {
      await acceptShot(shot.id)
      setStatus(`Panák od ${shot.giver_name} přijatý. Teď už je to mezi tebú a realitú.`)
      await load()
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : 'Panák sa nepodařilo přijmút.')
    }
  }

  const passOn = async (shot: PendingShot) => {
    const target = forwardTo[shot.id]
    if (!target) return
    try {
      await forwardShot(shot.id, target)
      const targetName = people.find((person) => person.id === target)?.display_name ?? 'další člověk'
      setStatus(`Panák poslaný dál na ${targetName}. Tak sa buduje folklórní ekonomika.`)
      await load()
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : 'Panák sa zasekl na cestě.')
    }
  }

  return (
    <section className="screen">
      <PageHeader eyebrow="Panáková burza" title="Kdo komu nalévá" copy="Panák možeš přijmút, nebo ho poslat dál. Komu je v profilu „Nechcu“, toho burza nechá na pokoji." />
      {status && <p className="v2-status">{status}</p>}
      <h2 className="section-title">Na tebe čeká</h2>
      <div className="v2-pending-shots">
        {pending.length ? pending.map((shot) => (
          <article className="v2-shot-card" key={shot.id}>
            <Avatar user={{ display_name: shot.giver_name, profile_photo_data: shot.giver_photo_data }} />
            <div className="v2-shot-copy"><span>{formatStamp(shot.created_at)}</span><h3>{shot.giver_name} ti kupuje panáka.</h3><p>Možeš ho vzít, nebo delegovat zodpovědnost.</p></div>
            <div className="v2-shot-actions">
              <button className="primary-button" type="button" onClick={() => accept(shot)}><GlassWater size={17} /> Beru ho</button>
              {forwardCandidates.length ? <div className="v2-forward-row"><select value={forwardTo[shot.id] ?? ''} onChange={(event) => setForwardTo((current) => ({ ...current, [shot.id]: event.target.value }))}>{forwardCandidates.map((person) => <option key={person.id} value={person.id}>{person.display_name}</option>)}</select><button type="button" onClick={() => passOn(shot)}><Send size={17} /> Pošli dál</button></div> : <small>Není komu bezpečně přeposlat. Všeci buď zmizeli, nebo nechcú.</small>}
            </div>
          </article>
        )) : <div className="v2-empty"><GlassWater size={27} /><strong>Žádný panák na obzoru.</strong><p>Buď sú všeci lakomí, nebo respektujú pitný režim.</p></div>}
      </div>
      <div className="v2-leaderboards"><Leaderboard title="Nejvíc přijatých panáků" rows={received} /><Leaderboard title="Nejštědřejší duše" rows={generous} /></div>
    </section>
  )
}

function ProfileScreen({ me, onMeChanged, onLogout }: { me: ApiUser; onMeChanged: (user: ApiUser) => void; onLogout: () => void }) {
  const [shareStatus, setShareStatus] = useState('')
  const [editing, setEditing] = useState(false)
  const [bio, setBio] = useState(me.bio ?? '')
  const [gender, setGender] = useState<Gender>(me.gender ?? 'male')
  const [danceLevel, setDanceLevel] = useState<DanceLevel>(me.dance_level ?? 'wild')
  const [drinkPreference, setDrinkPreference] = useState<DrinkPreference>(me.drink_preference ?? 'none')
  const [photos, setPhotos] = useState<MomentPhoto[]>([])
  const [saving, setSaving] = useState(false)
  const inviteUrl = `${INVITE_BASE}?ref=${encodeURIComponent(me.display_name)}`
  const quiet = me.is_available === 0

  useEffect(() => {
    getMyPhotos().then((result) => setPhotos(result.photos)).catch(() => undefined)
  }, [])

  const toggleQuiet = async () => {
    try {
      const result = await setAvailability(quiet)
      onMeChanged({ ...me, is_available: result.is_available })
    } catch (reason) {
      setShareStatus(reason instanceof Error ? reason.message : 'Stav sa nepodařilo přehodit.')
    }
  }

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setShareStatus('')
    try {
      const result = await updateProfile({ bio, gender, dance_level: danceLevel, drink_preference: drinkPreference })
      onMeChanged(result.user)
      setEditing(false)
      setShareStatus('Profil je přepsaný. Kronikář může zase spát.')
    } catch (reason) {
      setShareStatus(reason instanceof Error ? reason.message : 'Profil sa nepodařilo uložit.')
    } finally {
      setSaving(false)
    }
  }

  const shareInvite = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Vranovické hody 2026', text: `${me.display_name} tě tahá na hody.`, url: inviteUrl })
        setShareStatus('Pozvánka letěla do světa.')
      } else {
        await navigator.clipboard.writeText(inviteUrl)
        setShareStatus('Odkaz je v schránce. Tož ho někam pošli.')
      }
    } catch {
      setShareStatus('Sdílení sa zrušilo. Nic sa neděje.')
    }
  }

  return (
    <section className="screen">
      <PageHeader eyebrow="Tvoje místo" title="Ty sám" copy="Fotka, taneční pověst, pitný režim, stav a verbovací QR. Administrativa jak na obecním, ale aspoň barevná." />
      <article className="profile-card v2-profile-card"><Avatar user={me} size="hero" /><div className="profile-copy"><p className="eyebrow">Som na hodech</p><h2>{me.display_name}</h2><p>{me.bio || 'O sobě zatím nic nepráskls.'}</p><ProfileFacts user={me} /><button className="mini-button" type="button" onClick={() => setEditing((value) => !value)}><Pencil size={15} /> {editing ? 'Nech to tak' : 'Poštelovat profil'}</button></div></article>

      {editing && <form className="v4-profile-editor" onSubmit={saveProfile}>
        <h2>Pošteluj údaje</h2>
        <label><span>Co o tobě vědět</span><textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={120} /></label>
        <div className="v4-editor-grid">
          <label><span>Co seš zač</span><select value={gender} onChange={(event) => setGender(event.target.value as Gender)}><option value="male">Šohaj</option><option value="female">Děvčica</option></select></label>
          <label><span>Jak sa vrtíš</span><select value={danceLevel} onChange={(event) => setDanceLevel(event.target.value as DanceLevel)}><option value="pro">Mazák od muziky</option><option value="amateur">Dvě levé v čižmách</option><option value="wild">Tož to nějak odskáču</option></select></label>
          <label><span>Co ti nalét</span><select value={drinkPreference} onChange={(event) => setDrinkPreference(event.target.value as DrinkPreference)}><option value="slivovica">Slivovicu, jak sa sluší</option><option value="green">Zelenú nebo něco hodnějšího</option><option value="dark">Fernet či rum, hlavně ať to kope</option><option value="anything">Co naleješ, to vypiju</option><option value="none">Nechcu, díky</option></select></label>
        </div>
        <button className="primary-button" type="submit" disabled={saving}><Save size={17} /> {saving ? 'Zapisuju…' : 'Uložit to'}</button>
      </form>}

      <button className={`quiet-card${quiet ? ' quiet-on' : ''}`} type="button" onClick={toggleQuiet}><span className="quiet-icon">{quiet ? <Moon size={22} /> : <PartyPopper size={22} />}</span><div><strong>{quiet ? 'Neotravuj' : 'Som ve hře'}</strong><p>{quiet ? 'Náhodně tě teď ostatním neházíme.' : 'Možeš padnút komukoli na hlavní obrazovce.'}</p></div><span className="toggle"><i /></span></button>

      <article className="v2-qr-card">
        <div><p className="eyebrow">Dotáhni dalšího</p><h2>Tvoje verbovací cedula</h2><p>Kdo načte tenhle QR, přistane na registraci s tvým ménem v odkazu. Když sa fakt přidá, Kronika tě práskne.</p><button className="primary-button" type="button" onClick={shareInvite}><Share2 size={18} /> Poslat pozvánku</button></div>
        <div className="v2-qr"><QRCodeSVG value={inviteUrl} size={168} level="M" marginSize={2} /><span><QrCode size={14} /> {me.display_name}</span></div>
      </article>
      <p className="v2-invite-url">{inviteUrl}</p>

      <section className="v4-profile-gallery">
        <div className="v4-gallery-heading"><div><p className="eyebrow">Tvoje stopa</p><h2>Momentky</h2></div><Images size={25} /></div>
        {photos.length ? <div className="v4-gallery-grid">{photos.map((photo) => <figure key={photo.id}><img src={photo.web_photo_data} alt={`Momentka od ${photo.author_name}`} /><figcaption>{formatStamp(photo.created_at)}</figcaption></figure>)}</div> : <div className="v2-empty"><Camera size={26} /><strong>Zatím žádná momentka.</strong><p>To je na hodech stav dočasný.</p></div>}
      </section>

      {shareStatus && <p className="v2-status">{shareStatus}</p>}
      <button className="prototype-reset" type="button" onClick={onLogout}>Odhlásit sa a jít na vzduch</button>
    </section>
  )
}

export default function HodyAppNext() {
  const inviter = useMemo(() => new URLSearchParams(window.location.search).get('ref')?.trim() ?? '', [])
  const [entryMode, setEntryMode] = useState<EntryMode>('welcome')
  const [checking, setChecking] = useState(true)
  const [me, setMe] = useState<ApiUser | null>(null)
  const [people, setPeople] = useState<ApiUser[]>([])
  const [screen, setScreen] = useState<Screen>('home')
  const [targetId, setTargetId] = useState('')

  const refreshUsers = async () => {
    const result = await getUsers()
    setPeople(result.users)
  }

  useEffect(() => {
    getMe()
      .then(async ({ user }) => {
        if (user) {
          setMe(user)
          setEntryMode('app')
          await refreshUsers()
        }
      })
      .catch(() => undefined)
      .finally(() => setChecking(false))
  }, [])

  const enter = async (user: ApiUser) => {
    setMe(user)
    setEntryMode('app')
    setScreen('home')
    await refreshUsers()
  }

  const pickPerson = (id: string) => {
    setTargetId(id)
    setScreen('home')
  }

  const replaceMe = (user: ApiUser) => {
    setMe(user)
    setPeople((current) => current.map((item) => item.id === user.id ? user : item))
  }

  const logout = async () => {
    try { await logoutUser() } catch { /* local logout wins */ }
    setMe(null)
    setPeople([])
    setEntryMode('welcome')
    setScreen('home')
  }

  if (checking) return <main className="app-shell entry-shell"><div className="folk-background" aria-hidden="true"><span /><span /></div><div className="app-loading"><FolkRosette /><strong>Vranovické hody</strong><span>Šacuju, jestli už tě znám…</span></div></main>
  if (entryMode === 'welcome') return <main className="app-shell entry-shell"><div className="folk-background" aria-hidden="true"><span /><span /></div><WelcomeScreen inviter={inviter} onRegister={() => setEntryMode('register')} onLogin={() => setEntryMode('login')} /></main>
  if (entryMode === 'register') return <main className="app-shell entry-shell"><div className="folk-background" aria-hidden="true"><span /><span /></div><RegisterScreen inviter={inviter} onBack={() => setEntryMode('welcome')} onDone={enter} /></main>
  if (entryMode === 'login') return <main className="app-shell entry-shell"><div className="folk-background" aria-hidden="true"><span /><span /></div><LoginScreen onBack={() => setEntryMode('welcome')} onDone={enter} /></main>
  if (!me) return null

  return (
    <main className="app-shell v2-shell">
      <div className="folk-background" aria-hidden="true"><span /><span /></div>
      {screen === 'home' && <HomeScreen me={me} people={people} preferredTargetId={targetId} onPickTarget={setTargetId} />}
      {screen === 'people' && <PeopleScreen me={me} people={people} onPick={pickPerson} />}
      {screen === 'chronicle' && <ChronicleScreen onOpenInteractions={() => setScreen('interactions')} />}
      {screen === 'interactions' && <InteractionsScreen onBack={() => setScreen('chronicle')} />}
      {screen === 'game' && <GameScreen me={me} people={people} />}
      {screen === 'profile' && <ProfileScreen me={me} onMeChanged={replaceMe} onLogout={logout} />}
      {screen !== 'interactions' && <nav className="bottom-nav" aria-label="Hlavní navigace">{navItems.map((item) => <button className={screen === item.id ? 'active' : ''} key={item.id} type="button" onClick={() => setScreen(item.id)}><item.Icon size={19} strokeWidth={2.15} /><span>{item.label}</span></button>)}</nav>}
    </main>
  )
}
