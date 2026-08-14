import { useMemo, useState } from 'react'
import {
  BookImage,
  Camera,
  Check,
  ChevronRight,
  CircleUserRound,
  Home,
  Medal,
  MessageCircle,
  Moon,
  PartyPopper,
  Pencil,
  Plus,
  QrCode,
  Search,
  Share2,
  Shuffle,
  Sparkles,
  Trophy,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'

type Screen = 'home' | 'people' | 'chronicle' | 'game' | 'profile'

type Person = {
  name: string
  note: string
  questions: string[]
  meetings: number
  achievements: string[]
  accent: 'wine' | 'green' | 'blue' | 'gold'
}

type ChronicleItem = {
  id: number
  title: string
  meta: string
  caption?: string
  accent: 'wine' | 'green' | 'blue' | 'gold'
  initials: string
}

const people: Person[] = [
  {
    name: 'Klára',
    note: 'Když mě nevidíš, jsem asi u muziky.',
    meetings: 2,
    achievements: ['Seznamovač', 'Fotograf'],
    accent: 'wine',
    questions: [
      'Jaká věc ti vždycky zlepší náladu?',
      'Co ses za poslední rok naučila sama o sobě?',
      'Jakou naprosto zbytečnou schopnost bys chtěla umět?',
    ],
  },
  {
    name: 'Petr',
    note: 'Poznáš mě podle toho, že mám pořád něco v ruce.',
    meetings: 0,
    achievements: ['První kontakt'],
    accent: 'green',
    questions: [
      'Co je něco, do čeho ses v poslední době fakt zažral?',
      'Který člověk tě v životě nejvíc ovlivnil?',
      'Kdybys mohl na týden umět jednu novou věc, co by to bylo?',
    ],
  },
  {
    name: 'Anička',
    note: 'Pravděpodobně mě uslyšíš dřív, než mě uvidíš.',
    meetings: 1,
    achievements: ['Parta', 'Fotograf'],
    accent: 'blue',
    questions: [
      'Jaký malý moment si z poslední doby fakt pamatuješ?',
      'Co by o tobě většina lidí vůbec netipla?',
      'Kdybys měl vlastní svátek, jak by se slavil?',
    ],
  },
  {
    name: 'Kuba',
    note: 'Když se ztratím, hledej mě tam, kde se něco děje.',
    meetings: 3,
    achievements: ['Ještě jednou', 'Seznamovač'],
    accent: 'gold',
    questions: [
      'Co ti jde překvapivě dobře?',
      'Co bys chtěl, aby o tobě lidi chápali trochu líp?',
      'Která úplně obyčejná věc ti dělá větší radost, než by měla?',
    ],
  },
]

const chronicle: ChronicleItem[] = [
  { id: 1, title: 'Klára + Anička', meta: 'před 6 min', caption: 'První momentka dne.', accent: 'wine', initials: 'KA' },
  { id: 2, title: 'Kuba, Petr + další', meta: 'před 19 min', caption: 'Tady už to začalo být podezřelé.', accent: 'green', initials: 'KP' },
  { id: 3, title: 'Anička získala Fotograf', meta: 'před 31 min', accent: 'blue', initials: 'A' },
]

const navItems: { id: Screen; label: string; Icon: LucideIcon }[] = [
  { id: 'home', label: 'Domů', Icon: Home },
  { id: 'people', label: 'Lidi', Icon: UsersRound },
  { id: 'chronicle', label: 'Kronika', Icon: BookImage },
  { id: 'game', label: 'Hra', Icon: Sparkles },
  { id: 'profile', label: 'Profil', Icon: CircleUserRound },
]

function FolkRosette({ small = false }: { small?: boolean }) {
  return <span className={`folk-rosette${small ? ' small' : ''}`} aria-hidden="true" />
}

function RibbonDivider() {
  return <div className="ribbon-divider" aria-hidden="true" />
}

function PageHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <header className="page-header">
      <div className="page-header-ornament" aria-hidden="true" />
      <div className="page-header-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      <FolkRosette />
    </header>
  )
}

function PhotoPlaceholder({ person, large = false }: { person: Person; large?: boolean }) {
  return (
    <div className={`photo-placeholder accent-${person.accent}${large ? ' photo-large' : ''}`} aria-label={`Místo pro fotku uživatele ${person.name}`}>
      <div className="photo-textile" aria-hidden="true" />
      <div className="photo-corner photo-corner-top" aria-hidden="true" />
      <div className="photo-corner photo-corner-bottom" aria-hidden="true" />
      <span>{person.name.slice(0, 1).toUpperCase()}</span>
      <small>profilová fotka</small>
    </div>
  )
}

function HomeScreen() {
  const [personIndex, setPersonIndex] = useState(0)
  const [freeMode, setFreeMode] = useState(false)
  const [interactionDone, setInteractionDone] = useState(false)
  const [interactionCount, setInteractionCount] = useState(0)
  const person = people[personIndex]

  const showAnotherPerson = () => {
    setPersonIndex((current) => (current + 1) % people.length)
    setFreeMode(false)
    setInteractionDone(false)
  }

  const confirmInteraction = () => {
    if (!interactionDone) {
      setInteractionCount((current) => current + 1)
      setInteractionDone(true)
    }
  }

  return (
    <section className="screen screen-home">
      <div className="festival-banner">
        <div className="festival-banner-pattern" aria-hidden="true" />
        <div className="festival-banner-copy">
          <span className="banner-kicker">Tradiční</span>
          <p>Vranovické hody</p>
          <strong>Vranovice · 2026</strong>
        </div>
        <FolkRosette />
      </div>

      <div className="home-heading">
        <div>
          <p className="eyebrow">Som na hodech</p>
          <h1>Dej se do řeči.</h1>
        </div>
        <button className="status-pill" type="button"><PartyPopper size={16} /> Som ve hře</button>
      </div>

      <article className="person-card">
        <div className="card-ribbon" aria-hidden="true">
          <span>VRANOVICE</span><FolkRosette small /><span>HODY 2026</span>
        </div>
        <PhotoPlaceholder person={person} large />

        <div className="person-copy">
          <p className="eyebrow">Teď ti padl</p>
          <h2>{person.name}</h2>
          <p className="person-note">{person.note}</p>
          {person.meetings > 0 && <p className="meeting-note"><MessageCircle size={15} /> Vy spolu: {person.meetings}×</p>}
        </div>

        <RibbonDivider />

        {!freeMode ? (
          <div className="questions">
            <p className="section-label">Vyber si jednu. Nebo žádnou.</p>
            {person.questions.map((question, index) => (
              <button className="question" key={question} type="button">
                <span>{index + 1}</span>
                <p>{question}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="free-mode">
            <FolkRosette small />
            <p className="free-mode-kicker">Volná zábava</p>
            <p className="free-mode-copy">Tak už si povídejte. Moje práce tady končí.</p>
          </div>
        )}

        <div className="actions">
          <button className={`primary-button${interactionDone ? ' success' : ''}`} type="button" onClick={confirmInteraction}>
            {interactionDone ? <><Check size={19} /> Bavili jsme se</> : <><MessageCircle size={19} /> Bavili jsme se</>}
          </button>
          {!freeMode && <button className="secondary-button" type="button" onClick={() => setFreeMode(true)}><Sparkles size={18} /> Volná zábava</button>}
          <button className="text-button" type="button" onClick={showAnotherPerson}><Shuffle size={18} /> Jiný člověk <ChevronRight size={17} /></button>
        </div>
      </article>

      <div className="pocket-note">
        <FolkRosette small />
        <p><strong>{interactionCount}</strong> testovacích interakcí. Ideální stav: mobil zase do kapsy.</p>
      </div>
    </section>
  )
}

function PeopleScreen({ onPick }: { onPick: () => void }) {
  const [query, setQuery] = useState('')
  const filtered = people.filter((person) => person.name.toLowerCase().includes(query.toLowerCase()))

  return (
    <section className="screen">
      <PageHeader eyebrow="Kdo je na hodech" title="Lidi" subtitle="Všichni, kdo jsou právě ve hře. Žádný popularity meter, jen vaše společná historie." />
      <label className="search-box">
        <Search size={19} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Najít člověka" />
      </label>
      <div className="people-grid">
        {filtered.map((person) => (
          <article className="person-tile" key={person.name}>
            <PhotoPlaceholder person={person} />
            <div className="person-tile-body">
              <div className="person-title-row">
                <h2>{person.name}</h2>
                <span className="meeting-badge"><MessageCircle size={13} /> {person.meetings}×</span>
              </div>
              <p>{person.note}</p>
              <div className="achievement-row">
                {person.achievements.slice(0, 2).map((achievement) => <span key={achievement}><Medal size={14} /> {achievement}</span>)}
              </div>
              <button className="mini-button" type="button" onClick={onPick}>Nahodit otázky <ChevronRight size={15} /></button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function ChronicleScreen() {
  return (
    <section className="screen">
      <PageHeader eyebrow="Hodová kronika" title="Co se děje" subtitle="Momentky mají přednost. Klikání do aplikace už méně, díkybohu." />
      <div className="chronicle-list">
        {chronicle.map((item, index) => (
          <article className={`chronicle-card chronicle-${item.accent}`} key={item.id}>
            {index < 2 ? (
              <div className="chronicle-photo">
                <div className="photo-textile" aria-hidden="true" />
                <Camera size={29} />
                <strong>{item.initials}</strong>
                <span>společná fotka</span>
              </div>
            ) : (
              <div className="achievement-event"><FolkRosette /><Medal size={21} /><span>nový odznak</span></div>
            )}
            <div className="chronicle-copy">
              <div><h2>{item.title}</h2><span>{item.meta}</span></div>
              {item.caption && <p>{item.caption}</p>}
            </div>
          </article>
        ))}
      </div>
      <button className="primary-button upload-button" type="button"><Plus size={19} /> Přidat momentku</button>
    </section>
  )
}

function GameScreen() {
  const achievements = [
    ['První kontakt', 'První potvrzená interakce', '✓'],
    ['Seznamovač', 'Poznej 5 různých lidí', '4/5'],
    ['Fotograf', 'Přidej 5 momentek', '2/5'],
    ['Ještě jednou', 'Potkej někoho podruhé', '✓'],
  ]

  return (
    <section className="screen">
      <PageHeader eyebrow="Vedlejší disciplína" title="Hra" subtitle="Body jsou koření, ne večeře. Hlavní program se pořád odehrává mimo displej." />
      <div className="score-card">
        <div className="score-pattern" aria-hidden="true" />
        <div className="score-main"><p>Tvoje skóre</p><strong>47</strong><span>bodů</span></div>
        <Trophy className="score-trophy" size={42} />
        <p className="score-caption">6 lidí · 2 fotky · 4 odznaky</p>
      </div>

      <h2 className="section-title">Odznaky</h2>
      <div className="achievement-list">
        {achievements.map(([name, description, progress], index) => (
          <article className={`achievement-card medal-${index % 4}`} key={name}>
            <span className="achievement-medal"><FolkRosette small /></span>
            <div><h3>{name}</h3><p>{description}</p></div>
            <strong>{progress}</strong>
          </article>
        ))}
      </div>

      <div className="leaderboard-heading"><h2 className="section-title">Žebříček</h2><span>jen bokovka</span></div>
      <div className="leaderboard">
        {['Anička', 'Kuba', 'Klára', 'Ty', 'Petr'].map((name, index) => (
          <div className={`leader-row${name === 'Ty' ? ' me' : ''}`} key={name}>
            <span>{index + 1}</span><strong>{name}</strong><em>{[76, 69, 58, 47, 31][index]} b.</em>
          </div>
        ))}
      </div>
    </section>
  )
}

function ProfileScreen() {
  const [quiet, setQuiet] = useState(false)
  const me: Person = useMemo(() => ({
    name: 'Michael',
    note: 'Pravděpodobně něco řeším a tvrdím, že už nic řešit nebudu.',
    questions: [],
    meetings: 0,
    achievements: ['Seznamovač', 'Ještě jednou'],
    accent: 'wine',
  }), [])

  return (
    <section className="screen">
      <PageHeader eyebrow="Tvoje místo" title="Profil" />
      <article className="profile-card">
        <PhotoPlaceholder person={me} />
        <div className="profile-copy">
          <p className="eyebrow">Som na hodech</p>
          <h2>{me.name}</h2>
          <p>{me.note}</p>
          <button className="mini-button" type="button"><Pencil size={15} /> Upravit profil</button>
        </div>
      </article>

      <button className={`quiet-card${quiet ? ' quiet-on' : ''}`} type="button" onClick={() => setQuiet((current) => !current)}>
        <span className="quiet-icon">{quiet ? <Moon size={22} /> : <PartyPopper size={22} />}</span>
        <div><strong>{quiet ? 'Neotravuj' : 'Som ve hře'}</strong><p>{quiet ? 'Ostatním tě teď náhodně nenabízíme.' : 'Můžeš se objevovat ostatním na hlavní obrazovce.'}</p></div>
        <span className="toggle"><i /></span>
      </button>

      <article className="invite-card">
        <div className="invite-corner" aria-hidden="true" />
        <div className="invite-copy">
          <p className="eyebrow">Přiveď dalšího</p>
          <h2>Pozvi někoho</h2>
          <p>Pošleš stejný vstup do hry. Za hotovou registraci pak pár symbolických bodů.</p>
          <button className="primary-button" type="button"><Share2 size={18} /> Sdílet pozvánku</button>
        </div>
        <div className="qr-placeholder" aria-label="Místo pro budoucí QR kód"><QrCode size={52} /><span>QR</span></div>
      </article>

      <div className="profile-achievements">
        <h2 className="section-title">Tvoje odznaky</h2>
        <div className="achievement-row large">
          {me.achievements.map((achievement) => <span key={achievement}><Medal size={15} /> {achievement}</span>)}
        </div>
      </div>
    </section>
  )
}

function App() {
  const [screen, setScreen] = useState<Screen>('home')

  return (
    <main className="app-shell">
      <div className="folk-background" aria-hidden="true"><span /><span /></div>
      {screen === 'home' && <HomeScreen />}
      {screen === 'people' && <PeopleScreen onPick={() => setScreen('home')} />}
      {screen === 'chronicle' && <ChronicleScreen />}
      {screen === 'game' && <GameScreen />}
      {screen === 'profile' && <ProfileScreen />}

      <nav className="bottom-nav" aria-label="Hlavní navigace">
        {navItems.map((item) => (
          <button className={screen === item.id ? 'active' : ''} key={item.id} type="button" onClick={() => setScreen(item.id)}>
            <item.Icon size={19} strokeWidth={2.15} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </main>
  )
}

export default App
