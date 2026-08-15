import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Clock3, Flame, GlassWater, Send, Shuffle, Sparkles } from 'lucide-react'
import HodyAppV9 from './HodyAppV9'
import questionData from './data/questions.json'
import extraSpicyData from './data/extra-spicy-questions.json'
import {
  acceptShot,
  forwardShot,
  getMeV9,
  getOwedShots,
  getPairSpiceStatus,
  getUsersV9,
  getV7PendingShots,
  markShotDelivered,
  shotKindLabel,
  type ApiUserV9,
  type OwedShot,
  type V7PendingShot,
} from './api-v10'
import './hody-v10.css'

type QuestionItem = {
  id: string
  category: 'light' | 'personal' | 'deep' | 'wildcard'
  text: string
}

type ExtraSpicyQuestion = {
  id: string
  category: 'extra_spicy'
  text: string
}

const QUESTION_POOL = questionData.questions as QuestionItem[]
const EXTRA_SPICY = extraSpicyData.extra_spicy_questions as ExtraSpicyQuestion[]
const SKIP_COOLDOWN_KEY = 'hody-skip-cooldown-until-v10'
const SKIP_SECONDS = 5 * 60

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}:${rest.toString().padStart(2, '0')}`
}

function formatStamp(value: string) {
  const parsed = new Date(`${value.replace(' ', 'T')}Z`)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('cs-CZ', { hour: '2-digit', minute: '2-digit' }).format(parsed)
}

function pickExtra(previous: string) {
  const pool = EXTRA_SPICY.filter((item) => item.text !== previous)
  const choices = pool.length ? pool : EXTRA_SPICY
  return choices[Math.floor(Math.random() * choices.length)]?.text ?? ''
}

function pickReplacement(current: string, visible: string[]) {
  const currentItem = QUESTION_POOL.find((item) => item.text === current)
  const category = currentItem?.category
  const pool = QUESTION_POOL.filter((item) =>
    (!category || item.category === category) && item.text !== current && !visible.includes(item.text),
  )
  const choices = pool.length ? pool : QUESTION_POOL.filter((item) => item.text !== current)
  return choices[Math.floor(Math.random() * choices.length)]?.text ?? current
}

function IncomingShotModal({
  shot,
  total,
  people,
  meId,
  busy,
  error,
  onAccept,
  onForward,
}: {
  shot: V7PendingShot
  total: number
  people: ApiUserV9[]
  meId: string
  busy: boolean
  error: string
  onAccept: () => void
  onForward: (userId: string) => void
}) {
  const candidates = people.filter((person) => person.id !== meId && person.drink_preference !== 'none')
  const [forwardTo, setForwardTo] = useState(candidates[0]?.id ?? '')

  useEffect(() => {
    if (!candidates.some((person) => person.id === forwardTo)) setForwardTo(candidates[0]?.id ?? '')
  }, [shot.id, candidates.map((item) => item.id).join('|')])

  const senderName = shot.forwarded_by_name || shot.giver_name
  const senderPhoto = shot.forwarded_by_photo_data || shot.giver_photo_data

  return createPortal(
    <div className="v10-shot-alert-backdrop">
      <section className="v10-shot-alert" role="dialog" aria-modal="true" aria-label="Čeká na tebe panák">
        <div className="v10-shot-alert-kicker"><Sparkles size={16} /> Panák tě našel · {total > 1 ? `1 z ${total}` : 'mosíš rozhodnút'}</div>
        <div className="v10-shot-alert-person">
          <div className="v10-shot-alert-avatar">{senderPhoto ? <img src={senderPhoto} alt={`Fotka ${senderName}`} /> : senderName.slice(0, 1)}</div>
          <div>
            <span>{formatStamp(shot.created_at)}</span>
            <h2>{shot.forwarded_by_name ? `${shot.forwarded_by_name} ti přehodil/a panáka` : `${shot.giver_name} tě zve na panáka`}</h2>
            {shot.forwarded_by_name && <p>Původně ho kupuje {shot.giver_name}.</p>}
          </div>
        </div>
        <div className="v10-shot-kind"><GlassWater size={20} /><strong>{shotKindLabel(shot.shot_kind)}</strong></div>
        <p className="v10-shot-alert-copy">Tady sa neschovává do Hry. Buď ho vezmeš a {shot.giver_name} ho pak uvidí mezi dluhama, nebo ho pošleš dál.</p>
        {error && <p className="entry-error">{error}</p>}
        <button className="primary-button v10-shot-accept" type="button" disabled={busy} onClick={onAccept}><GlassWater size={18} /> {busy ? 'Zapisuju…' : 'Beru ho'}</button>
        {candidates.length ? (
          <div className="v10-shot-forward">
            <select value={forwardTo} onChange={(event) => setForwardTo(event.target.value)} disabled={busy}>
              {candidates.map((person) => <option value={person.id} key={person.id}>{person.display_name}</option>)}
            </select>
            <button type="button" disabled={busy || !forwardTo} onClick={() => onForward(forwardTo)}><Send size={17} /> Přehodit</button>
          </div>
        ) : <small>Teď ho není komu přehodit. Tož buď přijmút, nebo svolat víc lidí.</small>}
      </section>
    </div>,
    document.body,
  )
}

function OwedShotsCard({ shots, busyId, message, onDelivered }: {
  shots: OwedShot[]
  busyId: string
  message: string
  onDelivered: (shot: OwedShot) => void
}) {
  return (
    <section className="v10-owed-card">
      <div className="v10-owed-head"><div><span>Co mosíš donést</span><h2>Panákové dluhy</h2><p>Přijaté panáky už nejsú notifikace. Teď sú to závazky mezi tebú a šenkem.</p></div><GlassWater size={30} /></div>
      {message && <p className="v10-owed-message">{message}</p>}
      <div className="v10-owed-list">
        {shots.length ? shots.map((shot) => (
          <article className="v10-owed-row" key={shot.id}>
            <div className="v10-owed-avatar">{shot.recipient_photo_data ? <img src={shot.recipient_photo_data} alt={`Fotka ${shot.recipient_name}`} /> : shot.recipient_name.slice(0, 1)}</div>
            <div className="v10-owed-copy"><span>{formatStamp(shot.accepted_at)}</span><h3>{shot.recipient_name}</h3><p>{shotKindLabel(shot.shot_kind)}</p></div>
            <button type="button" disabled={busyId === shot.id} onClick={() => onDelivered(shot)}><Check size={17} /> {busyId === shot.id ? 'Zapisuju…' : 'Doneseno'}</button>
          </article>
        )) : <div className="v10-owed-empty"><Check size={22} /><strong>Nic nedlužíš.</strong><span>Vzácný stav. Užívej, než někoho pozveš.</span></div>}
      </div>
    </section>
  )
}

function ExtraSpicyCard({ question, selected, onToggle, onShuffle }: {
  question: string
  selected: boolean
  onToggle: () => void
  onShuffle: () => void
}) {
  return (
    <article className={`v2-question v10-extra-spicy${selected ? ' checked' : ''}`} data-v10-extra-spicy="true">
      <span className="v2-question-number v10-extra-number">5</span>
      <div className="v10-extra-copy"><span><Flame size={14} /> EXTRA SPICY</span><p>{question}</p></div>
      <button type="button" onClick={onToggle}>{selected ? <><Check size={17} /> Tož jo</> : 'Tuhle sme dali'}</button>
      <button className="v10-extra-shuffle" type="button" disabled={selected} onClick={onShuffle}><Shuffle size={15} /> Jinú</button>
    </article>
  )
}

export default function HodyAppV10() {
  const regularOverridesRef = useRef(new Map<string, string>())
  const extraSelectedRef = useRef(false)
  const extraQuestionRef = useRef('')
  const lastPairSignatureRef = useRef('')

  const [me, setMe] = useState<ApiUserV9 | null>(null)
  const [people, setPeople] = useState<ApiUserV9[]>([])
  const [incoming, setIncoming] = useState<V7PendingShot[]>([])
  const [incomingBusy, setIncomingBusy] = useState(false)
  const [incomingError, setIncomingError] = useState('')
  const [activeScreen, setActiveScreen] = useState('')
  const [owedMount, setOwedMount] = useState<HTMLElement | null>(null)
  const [owed, setOwed] = useState<OwedShot[]>([])
  const [owedBusyId, setOwedBusyId] = useState('')
  const [owedMessage, setOwedMessage] = useState('')
  const [extraMount, setExtraMount] = useState<HTMLElement | null>(null)
  const [extraQuestion, setExtraQuestion] = useState('')
  const [extraSelected, setExtraSelected] = useState(false)
  const [skipUntil, setSkipUntil] = useState(() => Number(window.localStorage.getItem(SKIP_COOLDOWN_KEY) ?? '0'))
  const [now, setNow] = useState(Date.now())
  const [cooldownMessage, setCooldownMessage] = useState('')

  useEffect(() => { extraSelectedRef.current = extraSelected }, [extraSelected])
  useEffect(() => { extraQuestionRef.current = extraQuestion }, [extraQuestion])

  const cooldownRemaining = Math.max(0, Math.ceil((skipUntil - now) / 1000))

  const refreshPeopleAndShots = async () => {
    if (!document.querySelector('main.v2-shell')) return
    try {
      const [meResult, peopleResult, shotResult] = await Promise.all([getMeV9(), getUsersV9(), getV7PendingShots()])
      setMe(meResult.user)
      setPeople(peopleResult.users)
      setIncoming(shotResult.shots)
      setIncomingError('')
    } catch {
      // Přihlášení a starší UI si chyby řeší po svém. Tohle je jen globální vrstva.
    }
  }

  useEffect(() => {
    void refreshPeopleAndShots()
    const timer = window.setInterval(() => void refreshPeopleAndShots(), 3500)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const nativeFetch = window.fetch.bind(window)
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()

      if (method === 'POST' && url.includes('/api/interactions') && typeof init?.body === 'string') {
        try {
          const body = JSON.parse(init.body) as { questions?: unknown[]; [key: string]: unknown }
          const regular = Array.isArray(body.questions)
            ? body.questions.filter((item): item is string => typeof item === 'string').map((question) => regularOverridesRef.current.get(question) ?? question)
            : []
          const spicyText = document.querySelector('.screen-home .v9-spicy-question.checked p')?.textContent?.trim() ?? ''
          const extraText = extraSelectedRef.current ? extraQuestionRef.current : ''
          const questions = [...new Set([...regular, ...(spicyText ? [spicyText] : []), ...(extraText ? [extraText] : [])])]
          body.questions = questions
          if (spicyText) body.spicy_question = spicyText
          if (extraText) body.extra_spicy_question = extraText
          return nativeFetch(input, { ...init, body: JSON.stringify(body) })
        } catch {
          return nativeFetch(input, init)
        }
      }

      return nativeFetch(input, init)
    }
    return () => { window.fetch = nativeFetch }
  }, [])

  const restoreRegularQuestions = () => {
    document.querySelectorAll<HTMLElement>('.screen-home .v2-question[data-v10-base-question]').forEach((card) => {
      const base = card.dataset.v10BaseQuestion
      if (base) card.dataset.v8OriginalQuestion = base
      delete card.dataset.v10BaseQuestion
    })
    regularOverridesRef.current.clear()
  }

  useEffect(() => {
    const addShuffleButtons = () => {
      const cards = Array.from(document.querySelectorAll<HTMLElement>('.screen-home .v2-question:not([data-v9-spicy="true"]):not([data-v10-extra-spicy="true"])'))
      for (const card of cards) {
        if (card.querySelector('.v10-question-shuffle')) continue
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'v10-question-shuffle'
        button.textContent = '↻ Jinú otázku'
        button.addEventListener('click', (event) => {
          event.preventDefault()
          event.stopPropagation()
          if (card.classList.contains('checked')) return
          const textNode = card.querySelector('p')
          const current = textNode?.textContent?.trim() ?? ''
          if (!textNode || !current) return
          const visible = cards.map((item) => item.querySelector('p')?.textContent?.trim() ?? '').filter(Boolean)
          const next = pickReplacement(current, visible)
          const base = card.dataset.v10BaseQuestion || card.dataset.v8OriginalQuestion || current
          card.dataset.v10BaseQuestion = base
          card.dataset.v8OriginalQuestion = `__v10_override_${base}`
          regularOverridesRef.current.set(base, next)
          textNode.textContent = next
        })
        card.appendChild(button)
      }
    }

    addShuffleButtons()
    const observer = new MutationObserver(addShuffleButtons)
    observer.observe(document.body, { childList: true, subtree: true })
    const timer = window.setInterval(addShuffleButtons, 700)
    return () => { observer.disconnect(); window.clearInterval(timer) }
  }, [])

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const button = target?.closest('button') as HTMLButtonElement | null
      if (!button) return

      if (button.textContent?.includes('Hoď někoho jiného')) {
        const done = Boolean(document.querySelector('.screen-home .v2-free-mode'))
        const current = Date.now()
        if (done) {
          restoreRegularQuestions()
          window.localStorage.removeItem(SKIP_COOLDOWN_KEY)
          setSkipUntil(0)
          setCooldownMessage('')
          return
        }
        if (skipUntil > current) {
          event.preventDefault()
          event.stopImmediatePropagation()
          setCooldownMessage(`Další los až za ${formatCountdown(Math.ceil((skipUntil - current) / 1000))}.`)
          return
        }
        restoreRegularQuestions()
        const until = current + SKIP_SECONDS * 1000
        window.localStorage.setItem(SKIP_COOLDOWN_KEY, String(until))
        setSkipUntil(until)
        setCooldownMessage('Pět minut na člověka. Když dáte „Bavili sme sa“, brzda zmizí.')
      }
    }

    document.addEventListener('click', handler, true)
    return () => document.removeEventListener('click', handler, true)
  }, [skipUntil])

  useEffect(() => {
    const syncDone = () => {
      if (document.querySelector('.screen-home .v2-free-mode') && skipUntil) {
        window.localStorage.removeItem(SKIP_COOLDOWN_KEY)
        setSkipUntil(0)
        setCooldownMessage('')
      }
    }
    syncDone()
    const observer = new MutationObserver(syncDone)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [skipUntil])

  useEffect(() => {
    const syncScreen = () => {
      const label = document.querySelector('.bottom-nav button.active span')?.textContent?.trim() ?? ''
      setActiveScreen(label)
      const screen = document.querySelector('main.v2-shell > section.screen') as HTMLElement | null
      if (label === 'Hra' && screen) {
        let mount = screen.querySelector('#v10-owed-mount') as HTMLElement | null
        if (!mount) {
          mount = document.createElement('div')
          mount.id = 'v10-owed-mount'
          const boards = screen.querySelector('.v2-leaderboards')
          if (boards) screen.insertBefore(mount, boards)
          else screen.appendChild(mount)
        }
        setOwedMount(mount)
      } else {
        setOwedMount(null)
      }
    }
    syncScreen()
    const observer = new MutationObserver(syncScreen)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const loadOwed = async () => {
    try {
      const result = await getOwedShots()
      setOwed(result.shots)
    } catch {
      setOwed([])
    }
  }

  useEffect(() => {
    if (activeScreen !== 'Hra') return
    void loadOwed()
    const timer = window.setInterval(() => void loadOwed(), 5000)
    return () => window.clearInterval(timer)
  }, [activeScreen])

  useEffect(() => {
    let cancelled = false
    const syncPair = async () => {
      const home = document.querySelector('.screen-home')
      const zone = home?.querySelector('.v2-question-zone')
      const targetName = home?.querySelector('.v6-person-name-row h2')?.textContent?.trim() ?? ''
      const target = people.find((person) => person.display_name === targetName)
      const regularSignature = Array.from(zone?.querySelectorAll<HTMLElement>('.v2-question:not([data-v9-spicy="true"]):not([data-v10-extra-spicy="true"])') ?? [])
        .slice(0, 3)
        .map((card) => card.querySelector('p')?.textContent?.trim() ?? '')
        .join('|')
      const signature = `${target?.id ?? ''}|${regularSignature}`

      if (!zone || !target?.id) {
        setExtraMount(null)
        return
      }
      if (signature === lastPairSignatureRef.current) return
      lastPairSignatureRef.current = signature

      try {
        const status = await getPairSpiceStatus(target.id)
        if (cancelled) return
        if (!status.extra_allowed) {
          setExtraMount(null)
          setExtraSelected(false)
          return
        }

        let mount = zone.querySelector('#v10-extra-spicy-mount') as HTMLElement | null
        if (!mount) {
          mount = document.createElement('div')
          mount.id = 'v10-extra-spicy-mount'
          zone.appendChild(mount)
        }
        setExtraMount(mount)
        setExtraQuestion((current) => pickExtra(current))
        setExtraSelected(false)
      } catch {
        if (!cancelled) setExtraMount(null)
      }
    }

    void syncPair()
    const observer = new MutationObserver(() => void syncPair())
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    const timer = window.setInterval(() => void syncPair(), 1200)
    return () => { cancelled = true; observer.disconnect(); window.clearInterval(timer) }
  }, [people])

  const currentIncoming = incoming[0]
  const forwardCandidates = useMemo(() => people.filter((person) => person.id !== me?.id && person.drink_preference !== 'none'), [people, me?.id])

  const acceptIncoming = async () => {
    if (!currentIncoming || incomingBusy) return
    setIncomingBusy(true)
    setIncomingError('')
    try {
      await acceptShot(currentIncoming.id)
      await refreshPeopleAndShots()
    } catch (error) {
      setIncomingError(error instanceof Error ? error.message : 'Panák sa nepodařilo přijmút.')
    } finally {
      setIncomingBusy(false)
    }
  }

  const forwardIncoming = async (userId: string) => {
    if (!currentIncoming || incomingBusy || !userId) return
    setIncomingBusy(true)
    setIncomingError('')
    try {
      await forwardShot(currentIncoming.id, userId)
      await refreshPeopleAndShots()
    } catch (error) {
      setIncomingError(error instanceof Error ? error.message : 'Panák sa zasekl při přehazování.')
    } finally {
      setIncomingBusy(false)
    }
  }

  const delivered = async (shot: OwedShot) => {
    if (owedBusyId) return
    setOwedBusyId(shot.id)
    setOwedMessage('')
    try {
      await markShotDelivered(shot.id)
      setOwedMessage(`${shotKindLabel(shot.shot_kind)} pro ${shot.recipient_name}: doneseno. Čest zachráněná.`)
      await loadOwed()
    } catch (error) {
      setOwedMessage(error instanceof Error ? error.message : 'Donesení sa nepodařilo zapsat.')
    } finally {
      setOwedBusyId('')
    }
  }

  return (
    <>
      <HodyAppV9 />

      {currentIncoming && me && (
        <IncomingShotModal
          shot={currentIncoming}
          total={incoming.length}
          people={forwardCandidates}
          meId={me.id}
          busy={incomingBusy}
          error={incomingError}
          onAccept={() => void acceptIncoming()}
          onForward={(userId) => void forwardIncoming(userId)}
        />
      )}

      {owedMount && createPortal(
        <OwedShotsCard shots={owed} busyId={owedBusyId} message={owedMessage} onDelivered={(shot) => void delivered(shot)} />,
        owedMount,
      )}

      {extraMount && extraQuestion && createPortal(
        <ExtraSpicyCard
          question={extraQuestion}
          selected={extraSelected}
          onToggle={() => setExtraSelected((value) => !value)}
          onShuffle={() => { if (!extraSelected) setExtraQuestion(pickExtra(extraQuestion)) }}
        />,
        extraMount,
      )}

      {activeScreen === 'Dom' && cooldownRemaining > 0 && (
        <div className="v10-skip-cooldown"><Clock3 size={17} /><span>{cooldownMessage || 'Další los'} <strong>{formatCountdown(cooldownRemaining)}</strong></span></div>
      )}
    </>
  )
}
