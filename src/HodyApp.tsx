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
  QrCode,
  Search,
  Send,
  Share2,
  Shuffle,
  Sparkles,
  Trophy,
  UserPlus,
  UsersRound,
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
  getPendingShots,
  getShotLeaderboard,
  getUsers,
  loginUser,
  logoutUser,
  registerUser,
  setAvailability,
  type ApiUser,
  type ChronicleEvent,
  type InteractionRecord,
  type PendingShot,
  type ShotLeaderboardRow,
} from './api'
import { compressProfilePhoto } from './photo'

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
    if (busy || photoBusy || name.trim().length < 2 || password.length < 4 || !photo) return
    setBusy(true)
    setError('')
    try {
      const result = await registerUser({
        name: name.trim(),
        password,
        bio: bio.trim(),
        profile_photo_data: photo,
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
        <p className="form-intro">Méno, heslo aspoň na čtyři znaky a fotka. Bez fotky by pak půl kroniky vypadalo jak evidence svědků.</p>
        <form onSubmit={submit} className="entry-form">
          <label><span>Jak ti máme říkat</span><input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={40} placeholder="Třeba Martin" required /></label>
          <label><span>Heslo · minimálně 4 znaky</span><div className="input-with-icon"><LockKeyhole size={17} /><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={4} maxLength={128} placeholder="1234 klidně stačí" required /></div></label>
          <label><span>Co o tobě vědět <em>nemusíš nic</em></span><textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={120} placeholder="Když mě nenajdeš, su asi..." /></label>
          <label className={`v2-photo-required${photo ? ' ready' : ''}`}>
            {photo ? <img src={photo} alt="Náhled profilové fotky" /> : <Camera size={28} />}
            <div><strong>{photo ? 'Fotka sedí' : 'Nahraj svoju fotku'}</strong><span>{photoBusy ? 'Štelujem ju do rozumné velikosti…' : 'povinné · foťák nebo galerie'}</span></div>
            <input type="file" accept="image/*" capture="user" onChange={pickPhoto} required={!photo} />
          </label>
          {inviter && <p className="v2-inline-note"><UserPlus size={16} /> Pozvánka je od: <strong>{inviter}</strong></p>}
          {error && <p className="entry-error" role="alert">{error}</p>}
          <button className="entry-primary" type="submit" disabled={busy || photoBusy || !photo}><PartyPopper size={20} /> {busy ? 'Zapisuju tě do kroniky…' : 'Tož su na hodech!'}</button>
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
              {chosen && <div className="v2-login-person"><Avatar user={chosen} /><div><strong>{chosen.display_name}</strong><p>{chosen.bio || 'O sobě zatím drží bobříka mlčení.'}</p></div></div>}
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
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [momentPhoto, setMomentPhoto] = useState('')
  const cameraInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!person) return
    setSeconds(PERSON_SECONDS)
    setSelectedQuestions([])
    setDone(false)
    setPoints(0)
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
        <PageHeader eyebrow="Na place je zatím ticho" title="Nikoho ti nemám koho hodit." copy="Až sa přidá další člověk, tady sa objeví. Zatím můžeš ukazovat svůj QR kód jak legitimní podomní verbíř." />
      </section>
    )
  }

  const questions = questionSetFor(person)

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
    setStatus('')
    try {
      await buyShot(person.id)
      setStatus(`Panák pro ${person.display_name} je na cestě. Teoreticky. Prakticky ho eště někdo mosí donést.`)
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : 'Panák sa nepodařilo poslat.')
    }
  }

  const pickMoment = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setMomentPhoto(typeof reader.result === 'string' ? reader.result : '')
    reader.readAsDataURL(file)
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
        <div className="person-copy"><p className="eyebrow">Tož sa seznam</p><h2>{person.display_name}</h2><p className="person-note">{person.bio || 'O sobě zatím nic nevyklopil.'}</p></div>

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
          <button className="secondary-button v2-photo-button" type="button" onClick={() => cameraInput.current?.click()}><Camera size={19} /> Cvaknút si fotku</button>
          <input ref={cameraInput} className="v2-hidden-input" type="file" accept="image/*" capture="environment" onChange={pickMoment} />
          <button className="secondary-button v2-shot-button" type="button" onClick={buyPanak}><GlassWater size={19} /> Kup mu panáka</button>
          <button className="text-button" type="button" onClick={nextPerson}><Shuffle size={18} /> Hoď někoho jiného <ChevronRight size={17} /></button>
        </div>

        {momentPhoto && <div className="v2-moment-preview"><img src={momentPhoto} alt="Čerstvá momentka" /><span>Momentka je cvaknutá. Uložení do Kroniky zapojíme přes R2.</span></div>}
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
              <div className="v2-tile-actions">
                <button className="mini-button" type="button" onClick={() => onPick(user.id)}>Nahodit otázky <ChevronRight size={15} /></button>
                <button className="mini-button" type="button" onClick={() => sendShot(user)}><GlassWater size={15} /> Panák</button>
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
      <PageHeader eyebrow="Hodová kronika" title="Co sa tu semlelo" copy="Pozvánky, nové tváře a trochu důkazního materiálu, že ste fakt mluvili s lidma." />
      <button className="v2-log-button" type="button" onClick={onOpenInteractions}><BookOpenCheck size={20} /><span><strong>Všecky hovory</strong><small>Kdo s kým a které otázky odklikl</small></span><ChevronRight size={18} /></button>
      {error && <p className="entry-error">{error}</p>}
      <div className="v2-chronicle-list">
        {events.length === 0 && !error && <div className="v2-empty"><Images size={28} /><strong>Zatím tu fučí větr.</strong><p>Až někdo někoho pozve nebo sa dá do řeči, kronika to práskne.</p></div>}
        {events.map((event) => event.type === 'invite' ? (
          <article className="v2-chronicle-event invite-event" key={`invite-${event.id}`}>
            <Avatar user={{ display_name: event.joined_name, profile_photo_data: event.joined_photo_data }} size="normal" />
            <div><span>{formatStamp(event.created_at)}</span><h2>{event.inviter_name} dotáhl {event.joined_name} na hody!</h2><p>Nová tvář v placu. Tož sa s ní někdo běžte pobavit.</p></div>
            <UserPlus size={23} />
          </article>
        ) : (
          <article className="v2-chronicle-event talk-event" key={`talk-${event.id}`}>
            <Avatar user={{ display_name: event.to_name, profile_photo_data: event.to_photo_data }} size="normal" />
            <div><span>{formatStamp(event.created_at)}</span><h2>{event.from_name} sa bavil s {event.to_name}.</h2><p>Otázky sú schované ve výpisu hovorů, ať z Kroniky není účetní kniha.</p></div>
            <MessageCircle size={23} />
          </article>
        ))}
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
      <PageHeader eyebrow="Kontrolní lejstro" title="Všecky hovory" copy="Enom verifikace. Kdo, s kým, kdy a co odklikl před „Bavili sme sa“. Žádný tajný chat tu nevedeme." />
      {error && <p className="entry-error">{error}</p>}
      <div className="v2-interaction-list">
        {items.map((item) => (
          <article className="v2-interaction-record" key={item.id}>
            <div className="v2-interaction-people"><strong>{item.from_name}</strong><MessageCircle size={16} /><strong>{item.to_name}</strong><span>{formatStamp(item.created_at)}</span></div>
            <div className="v2-confirmed-questions">
              {item.questions.map((question) => <p key={question}><Check size={15} /> {question}</p>)}
            </div>
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

  const load = async () => {
    try {
      const [shotsResult, board] = await Promise.all([getPendingShots(), getShotLeaderboard()])
      setPending(shotsResult.shots)
      setGenerous(board.generous)
      setReceived(board.received)
      setForwardTo((current) => {
        const next = { ...current }
        for (const shot of shotsResult.shots) {
          if (!next[shot.id]) next[shot.id] = people.find((person) => person.id !== me.id)?.id ?? ''
        }
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
      <PageHeader eyebrow="Panáková burza" title="Kdo komu nalévá" copy="Panák možeš přijmút, nebo ho s čistým svědomím poslat dál. Dárce zostává dárcom, chaos zostává chaosem." />
      {status && <p className="v2-status">{status}</p>}
      <h2 className="section-title">Na tebe čeká</h2>
      <div className="v2-pending-shots">
        {pending.length ? pending.map((shot) => (
          <article className="v2-shot-card" key={shot.id}>
            <Avatar user={{ display_name: shot.giver_name, profile_photo_data: shot.giver_photo_data }} />
            <div className="v2-shot-copy"><span>{formatStamp(shot.created_at)}</span><h3>{shot.giver_name} ti kupuje panáka.</h3><p>Možeš ho vzít, nebo delegovat zodpovědnost.</p></div>
            <div className="v2-shot-actions">
              <button className="primary-button" type="button" onClick={() => accept(shot)}><GlassWater size={17} /> Beru ho</button>
              <div className="v2-forward-row"><select value={forwardTo[shot.id] ?? ''} onChange={(event) => setForwardTo((current) => ({ ...current, [shot.id]: event.target.value }))}>{people.filter((person) => person.id !== me.id).map((person) => <option key={person.id} value={person.id}>{person.display_name}</option>)}</select><button type="button" onClick={() => passOn(shot)}><Send size={17} /> Pošli dál</button></div>
            </div>
          </article>
        )) : <div className="v2-empty"><GlassWater size={27} /><strong>Žádný panák na obzoru.</strong><p>Buď sú všeci lakomí, nebo si eště nevšimli tlačítka.</p></div>}
      </div>
      <div className="v2-leaderboards">
        <Leaderboard title="Nejvíc přijatých panáků" rows={received} />
        <Leaderboard title="Nejštědřejší duše" rows={generous} />
      </div>
    </section>
  )
}

function ProfileScreen({ me, onMeChanged, onLogout }: { me: ApiUser; onMeChanged: (user: ApiUser) => void; onLogout: () => void }) {
  const [shareStatus, setShareStatus] = useState('')
  const inviteUrl = `${INVITE_BASE}?ref=${encodeURIComponent(me.display_name)}`
  const quiet = me.is_available === 0

  const toggleQuiet = async () => {
    try {
      const result = await setAvailability(quiet)
      onMeChanged({ ...me, is_available: result.is_available })
    } catch (reason) {
      setShareStatus(reason instanceof Error ? reason.message : 'Stav sa nepodařilo přehodit.')
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
      <PageHeader eyebrow="Tvoje místo" title="Ty sám" copy="Fotka, stav a verbovací QR. Nic víc člověk k důstojnému životu údajně nepotřebuje." />
      <article className="profile-card v2-profile-card"><Avatar user={me} size="hero" /><div className="profile-copy"><p className="eyebrow">Som na hodech</p><h2>{me.display_name}</h2><p>{me.bio || 'O sobě zatím nic nepráskls.'}</p></div></article>
      <button className={`quiet-card${quiet ? ' quiet-on' : ''}`} type="button" onClick={toggleQuiet}><span className="quiet-icon">{quiet ? <Moon size={22} /> : <PartyPopper size={22} />}</span><div><strong>{quiet ? 'Neotravuj' : 'Som ve hře'}</strong><p>{quiet ? 'Náhodně tě teď ostatním neházíme.' : 'Možeš padnút komukoli na hlavní obrazovce.'}</p></div><span className="toggle"><i /></span></button>
      <article className="v2-qr-card">
        <div><p className="eyebrow">Dotáhni dalšího</p><h2>Tvoje verbovací cedula</h2><p>Kdo načte tenhle QR, přistane na normální registraci s tvým ménem v odkazu. Když sa fakt přidá, Kronika tě práskne.</p><button className="primary-button" type="button" onClick={shareInvite}><Share2 size={18} /> Poslat pozvánku</button></div>
        <div className="v2-qr"><QRCodeSVG value={inviteUrl} size={168} level="M" marginSize={2} /><span><QrCode size={14} /> {me.display_name}</span></div>
      </article>
      <p className="v2-invite-url">{inviteUrl}</p>
      {shareStatus && <p className="v2-status">{shareStatus}</p>}
      <button className="prototype-reset" type="button" onClick={onLogout}>Odhlásit sa a jít na vzduch</button>
    </section>
  )
}

export default function HodyApp() {
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

  const logout = async () => {
    try { await logoutUser() } catch { /* local logout still wins */ }
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
      {screen === 'profile' && <ProfileScreen me={me} onMeChanged={(user) => { setMe(user); setPeople((current) => current.map((item) => item.id === user.id ? user : item)) }} onLogout={logout} />}
      {screen !== 'interactions' && <nav className="bottom-nav" aria-label="Hlavní navigace">{navItems.map((item) => <button className={screen === item.id ? 'active' : ''} key={item.id} type="button" onClick={() => setScreen(item.id)}><item.Icon size={19} strokeWidth={2.15} /><span>{item.label}</span></button>)}</nav>}
    </main>
  )
}
