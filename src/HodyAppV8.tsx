import { ChangeEvent, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Camera, Check, Clock3, GlassWater, Sparkles, Trophy, Wine, X } from 'lucide-react'
import HodyAppV7 from './HodyAppV7'
import questionData from './data/questions.json'
import {
  completePhotoChallenge,
  donateWineBottle,
  getGenerosity,
  getPhotoChallenge,
  getUsers,
  saveMomentPhoto,
  type ApiUser,
  type GenerosityRow,
  type PhotoChallengeStatus,
} from './api-v8'
import { compressMomentPhoto } from './photo-next'
import './hody-v8.css'

type QuestionItem = {
  id: string
  category: 'light' | 'personal' | 'deep' | 'wildcard'
  text: string
}

const QUESTION_POOL = questionData.questions as QuestionItem[]

function randomOne<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)]
}

function drawQuestionSet(previous: string[]) {
  const light = QUESTION_POOL.filter((item) => item.category === 'light')
  const personal = QUESTION_POOL.filter((item) => item.category === 'personal' || item.category === 'deep')
  const wildcard = QUESTION_POOL.filter((item) => item.category === 'wildcard')
  let result = [randomOne(light), randomOne(personal), randomOne(wildcard)].map((item) => item.text)

  const same = result.every((text, index) => text === previous[index])
  if (same && wildcard.length > 1) {
    const alternatives = wildcard.filter((item) => item.text !== result[2])
    result = [result[0], result[1], randomOne(alternatives).text]
  }
  return result
}

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}:${rest.toString().padStart(2, '0')}`
}

function genderLabel(user: ApiUser) {
  if (user.gender === 'male') return 'Šohaj'
  if (user.gender === 'female') return 'Děvčica'
  return 'Tají'
}

function danceLabel(user: ApiUser) {
  if (user.dance_level === 'pro') return 'Mazák od muziky'
  if (user.dance_level === 'amateur') return 'Dvě levé v čižmách'
  if (user.dance_level === 'wild') return 'Tož to nějak odskáču'
  return 'Neznámé'
}

function drinkLabel(user: ApiUser) {
  if (user.drink_preference === 'slivovica') return 'Slivovica'
  if (user.drink_preference === 'green') return 'Zelená / něco hodnějšího'
  if (user.drink_preference === 'dark') return 'Fernet či rum'
  if (user.drink_preference === 'anything') return 'Co naleješ'
  if (user.drink_preference === 'none') return 'Nechcu, díky'
  return 'Nevyplněné'
}

function PhotoChallengeCard({
  status,
  busy,
  completedCurrent,
  message,
  onPhoto,
}: {
  status: PhotoChallengeStatus
  busy: boolean
  completedCurrent: boolean
  message: string
  onPhoto: (event: ChangeEvent<HTMLInputElement>) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const progress = Math.min(100, Math.round((status.completed / status.needed) * 100))
  const remaining = Math.max(0, status.needed - status.completed)

  return (
    <article className={`v8-challenge-card${status.achievement.earned ? ' earned' : ''}${completedCurrent ? ' done-now' : ''}`}>
      <div className="v8-challenge-pattern" aria-hidden="true" />
      <div className="v8-challenge-top">
        <div className="v8-challenge-badge">{status.achievement.earned ? <Trophy size={24} /> : <Camera size={24} />}</div>
        <div className="v8-challenge-heading">
          <span>Hodová foto výzva</span>
          <h2>{status.achievement.earned ? 'Hodový nezmar' : 'Cvakni to, než sa přehodí'}</h2>
        </div>
        <div className="v8-challenge-clock"><Clock3 size={14} /> {formatCountdown(status.seconds_until_change)}</div>
      </div>

      <p className="v8-challenge-text">{status.challenge.text}</p>

      <div className="v8-challenge-progress-row">
        <div className="v8-challenge-progress-copy">
          <strong>{status.completed}/{status.needed} do odznaku</strong>
          <span>{status.achievement.earned ? 'Odznak máš. Teď už fotíš pro čest a Drby.' : remaining === 1 ? 'Poslední výzva do odznaku.' : `Ještě ${remaining} různých výzev.`}</span>
        </div>
        <div className="v8-challenge-progress"><i style={{ width: `${progress}%` }} /></div>
      </div>

      <button className="primary-button v8-challenge-button" type="button" disabled={busy || completedCurrent} onClick={() => input.current?.click()}>
        {completedCurrent ? <><Check size={18} /> Tuhle máš splněnú</> : <><Camera size={18} /> {busy ? 'Ukládám důkaz…' : 'Cvaknút výzvu'}</>}
      </button>
      <input ref={input} className="v2-hidden-input" type="file" accept="image/*" capture="environment" onChange={onPhoto} />
      {message && <p className="v8-challenge-message">{message}</p>}
    </article>
  )
}

function GenerosityBoard({ rows, busy, message, onWine }: {
  rows: GenerosityRow[]
  busy: boolean
  message: string
  onWine: () => void
}) {
  return (
    <section className="v8-generosity-card">
      <div className="v8-generosity-head">
        <div><span>Šenkovní čest</span><h2>Nejštědřejší duše</h2><p>Panák je panák. Flaša vína pro stůl je flaša vína. Obojí sa počítá, ale ukazujeme to zvlášť.</p></div>
        <Wine size={31} />
      </div>
      <button className="primary-button v8-wine-button" type="button" disabled={busy} onClick={onWine}><Wine size={18} /> {busy ? 'Zapisuju flašu…' : 'Dondu pro víno na stůl'}</button>
      {message && <p className="v8-generosity-message">{message}</p>}
      <div className="v8-generosity-list">
        {rows.length ? rows.map((row, index) => (
          <div className="v8-generosity-row" key={row.id}>
            <strong>{index + 1}.</strong>
            <div className="v8-generosity-avatar">{row.profile_photo_data ? <img src={row.profile_photo_data} alt={`Fotka ${row.display_name}`} /> : row.display_name.slice(0, 1).toUpperCase()}</div>
            <span>{row.display_name}</span>
            <em><GlassWater size={14} /> {Number(row.shot_count) || 0}</em>
            <em><Wine size={14} /> {Number(row.wine_count) || 0}</em>
          </div>
        )) : <p className="v8-generosity-empty">Zatím nikdo nic. Stůl je podezřele suchý.</p>}
      </div>
    </section>
  )
}

function PersonDetail({ user, onClose }: { user: ApiUser; onClose: () => void }) {
  return createPortal(
    <div className="v8-person-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <article className="v8-person-modal" role="dialog" aria-modal="true" aria-label={`Profil ${user.display_name}`}>
        <button className="v8-person-close" type="button" onClick={onClose} aria-label="Zavřít"><X size={19} /></button>
        <div className="v8-person-photo">{user.profile_photo_data ? <img src={user.profile_photo_data} alt={`Fotka ${user.display_name}`} /> : <span>{user.display_name.slice(0, 1).toUpperCase()}</span>}</div>
        <div className="v8-person-copy">
          <span>Člověk z placu</span>
          <h2>{user.display_name}</h2>
          <p>{user.bio || 'Nic na sebe zatím nepráskl.'}</p>
          <div className="v8-person-facts">
            <i><strong>{genderLabel(user)}</strong><small>co seš zač</small></i>
            <i><strong>{danceLabel(user)}</strong><small>jak sa vrtíš</small></i>
            <i><strong>{drinkLabel(user)}</strong><small>co ti nalét</small></i>
          </div>
        </div>
      </article>
    </div>,
    document.body,
  )
}

export default function HodyAppV8() {
  const questionMapRef = useRef(new Map<string, string>())
  const lastQuestionSetRef = useRef<string[]>([])
  const lastPersonRef = useRef('')
  const usersRef = useRef<ApiUser[]>([])
  const applyingQuestionsRef = useRef(false)

  const [activeScreen, setActiveScreen] = useState('')
  const [drbyMount, setDrbyMount] = useState<HTMLElement | null>(null)
  const [gameMount, setGameMount] = useState<HTMLElement | null>(null)
  const [profileUser, setProfileUser] = useState<ApiUser | null>(null)

  const [challenge, setChallenge] = useState<PhotoChallengeStatus | null>(null)
  const [challengeBusy, setChallengeBusy] = useState(false)
  const [challengeDone, setChallengeDone] = useState(false)
  const [challengeMessage, setChallengeMessage] = useState('')

  const [generosity, setGenerosity] = useState<GenerosityRow[]>([])
  const [wineBusy, setWineBusy] = useState(false)
  const [wineMessage, setWineMessage] = useState('')

  const applyCurrentQuestionMap = () => {
    if (applyingQuestionsRef.current) return
    const cards = Array.from(document.querySelectorAll<HTMLElement>('.screen-home .v2-question'))
    if (!cards.length || !questionMapRef.current.size) return

    applyingQuestionsRef.current = true
    try {
      for (const card of cards) {
        const textNode = card.querySelector('p')
        if (!textNode) continue
        let original = card.dataset.v8OriginalQuestion
        if (!original) {
          const current = textNode.textContent?.trim() ?? ''
          const reverse = Array.from(questionMapRef.current.entries()).find(([, displayed]) => displayed === current)?.[0]
          original = reverse ?? current
          card.dataset.v8OriginalQuestion = original
        }
        const displayed = questionMapRef.current.get(original)
        if (displayed && textNode.textContent !== displayed) textNode.textContent = displayed
      }
    } finally {
      applyingQuestionsRef.current = false
    }
  }

  const refreshQuestionCycle = () => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>('.screen-home .v2-question'))
    if (!cards.length) return

    const reverseMap = new Map(Array.from(questionMapRef.current.entries()).map(([original, displayed]) => [displayed, original]))
    const originals = cards.map((card) => {
      const textNode = card.querySelector('p')
      const current = textNode?.textContent?.trim() ?? ''
      const original = card.dataset.v8OriginalQuestion || reverseMap.get(current) || current
      card.dataset.v8OriginalQuestion = original
      return original
    })

    const fresh = drawQuestionSet(lastQuestionSetRef.current)
    lastQuestionSetRef.current = fresh
    questionMapRef.current = new Map(originals.map((original, index) => [original, fresh[index]]))
    applyCurrentQuestionMap()
  }

  useEffect(() => {
    const nativeFetch = window.fetch.bind(window)
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
      if (method === 'POST' && url.includes('/api/interactions') && typeof init?.body === 'string' && questionMapRef.current.size) {
        try {
          const payload = JSON.parse(init.body) as { questions?: unknown }
          if (Array.isArray(payload.questions)) {
            payload.questions = payload.questions.map((question) => typeof question === 'string' ? questionMapRef.current.get(question) ?? question : question)
            return nativeFetch(input, { ...init, body: JSON.stringify(payload) })
          }
        } catch {
          // Když body není JSON, necháme původní request být.
        }
      }
      return nativeFetch(input, init)
    }
    return () => { window.fetch = nativeFetch }
  }, [])

  useEffect(() => {
    const syncQuestions = () => {
      if (applyingQuestionsRef.current) return
      const home = document.querySelector('.screen-home')
      if (!home) return
      const person = home.querySelector('.v6-person-name-row h2')?.textContent?.trim() ?? ''
      const cards = home.querySelectorAll('.v2-question')
      if (!person || !cards.length) return

      if (person !== lastPersonRef.current || !questionMapRef.current.size) {
        lastPersonRef.current = person
        refreshQuestionCycle()
      } else {
        applyCurrentQuestionMap()
      }
    }

    syncQuestions()
    const observer = new MutationObserver(syncQuestions)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })

    const clickHandler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const button = target?.closest('button') as HTMLButtonElement | null
      if (button?.textContent?.includes('Hoď někoho jiného') && !event.defaultPrevented) {
        window.setTimeout(() => {
          lastPersonRef.current = document.querySelector('.screen-home .v6-person-name-row h2')?.textContent?.trim() ?? lastPersonRef.current
          refreshQuestionCycle()
        }, 60)
      }
    }
    document.addEventListener('click', clickHandler)
    return () => {
      observer.disconnect()
      document.removeEventListener('click', clickHandler)
    }
  }, [])

  useEffect(() => {
    const syncScreen = () => {
      const label = document.querySelector('.bottom-nav button.active span')?.textContent?.trim() ?? ''
      setActiveScreen(label)
      const screen = document.querySelector('main.v2-shell > section.screen') as HTMLElement | null
      if (!screen) return

      if (label === 'Drby') {
        let mount = screen.querySelector('#v8-challenge-mount') as HTMLElement | null
        if (!mount) {
          mount = document.createElement('div')
          mount.id = 'v8-challenge-mount'
          const header = screen.querySelector('.v2-page-header')
          if (header?.nextSibling) screen.insertBefore(mount, header.nextSibling)
          else screen.prepend(mount)
        }
        setDrbyMount(mount)
      } else {
        setDrbyMount(null)
      }

      if (label === 'Hra') {
        let mount = screen.querySelector('#v8-generosity-mount') as HTMLElement | null
        if (!mount) {
          mount = document.createElement('div')
          mount.id = 'v8-generosity-mount'
          const boards = screen.querySelector('.v2-leaderboards')
          if (boards) screen.insertBefore(mount, boards)
          else screen.appendChild(mount)
        }
        setGameMount(mount)
      } else {
        setGameMount(null)
      }
    }

    syncScreen()
    const observer = new MutationObserver(syncScreen)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const clickHandler = async (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target || target.closest('button, input, select, textarea, a, label')) return
      const tile = target.closest('.person-tile') as HTMLElement | null
      if (!tile) return
      const name = tile.querySelector('h2')?.textContent?.trim()
      if (!name) return
      try {
        if (!usersRef.current.length) usersRef.current = (await getUsers()).users
        const user = usersRef.current.find((item) => item.display_name === name)
        if (user) setProfileUser(user)
      } catch {
        // Profilový modal není kritický pro zbytek appky.
      }
    }
    document.addEventListener('click', clickHandler)
    return () => document.removeEventListener('click', clickHandler)
  }, [])

  useEffect(() => {
    if (activeScreen !== 'Drby') return
    let cancelled = false
    const load = async () => {
      try {
        const result = await getPhotoChallenge()
        if (!cancelled) {
          setChallenge(result)
          setChallengeDone(false)
          setChallengeMessage('')
        }
      } catch {
        if (!cancelled) setChallenge(null)
      }
    }
    void load()
    const timer = window.setInterval(load, 60_000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [activeScreen])

  useEffect(() => {
    if (!challenge || activeScreen !== 'Drby') return
    const timer = window.setInterval(() => {
      setChallenge((current) => current ? { ...current, seconds_until_change: Math.max(0, current.seconds_until_change - 1) } : current)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [challenge?.challenge.id, activeScreen])

  useEffect(() => {
    if (activeScreen !== 'Hra') return
    let cancelled = false
    const load = async () => {
      try {
        const result = await getGenerosity()
        if (!cancelled) setGenerosity(result.rows)
      } catch {
        if (!cancelled) setGenerosity([])
      }
    }
    void load()
    return () => { cancelled = true }
  }, [activeScreen])

  const takeChallengePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !challenge || challengeBusy || challengeDone) return

    setChallengeBusy(true)
    setChallengeMessage('')
    try {
      const imageData = await compressMomentPhoto(file)
      const saved = await saveMomentPhoto({ image_data: imageData })
      const result = await completePhotoChallenge(challenge.challenge.id, saved.photo_id)
      setChallengeDone(true)
      setChallenge((current) => current ? {
        ...current,
        completed: result.completed,
        total: result.total,
        needed: result.needed,
        achievement: { ...current.achievement, earned: result.achievement_earned },
      } : current)
      setChallengeMessage(result.achievement_earned ? 'Hotovo. Hodový nezmar je tvůj.' : 'Cvaknuté a zapsané do Drbů. Další úkol přijde po minutě.')
    } catch (error) {
      setChallengeMessage(error instanceof Error ? error.message : 'Výzvu sa nepodařilo uložit.')
    } finally {
      setChallengeBusy(false)
    }
  }

  const donateWine = async () => {
    if (wineBusy) return
    setWineBusy(true)
    setWineMessage('')
    try {
      await donateWineBottle()
      const result = await getGenerosity()
      setGenerosity(result.rows)
      setWineMessage('Zapsané. Jedna flaša vína pro stůl ide na tvoje triko.')
    } catch (error) {
      setWineMessage(error instanceof Error ? error.message : 'Víno sa nepodařilo zapsat.')
    } finally {
      setWineBusy(false)
    }
  }

  return (
    <>
      <HodyAppV7 />

      {drbyMount && challenge && createPortal(
        <PhotoChallengeCard status={challenge} busy={challengeBusy} completedCurrent={challengeDone} message={challengeMessage} onPhoto={takeChallengePhoto} />,
        drbyMount,
      )}

      {gameMount && createPortal(
        <GenerosityBoard rows={generosity} busy={wineBusy} message={wineMessage} onWine={() => void donateWine()} />,
        gameMount,
      )}

      {profileUser && <PersonDetail user={profileUser} onClose={() => setProfileUser(null)} />}
    </>
  )
}
