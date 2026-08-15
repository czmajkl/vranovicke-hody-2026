import { ChangeEvent, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Camera, Check, Clock3, GlassWater, Sparkles, Trophy, X } from 'lucide-react'
import HodyAppV6 from './HodyAppV6'
import {
  SHOT_KINDS,
  buySpecificShot,
  completePhotoChallenge,
  getPhotoChallenge,
  getUsers,
  getV7PendingShots,
  saveMomentPhoto,
  shotKindLabel,
  type ApiUser,
  type PhotoChallengeStatus,
  type ShotKind,
} from './api-v7'
import { compressMomentPhoto } from './photo-next'
import './hody-v7.css'

const SKIP_COOLDOWN_KEY = 'hody-skip-cooldown-until-v1'
const SHOT_EXPLAINED_KEY = 'hody-shot-explained-v1'
const SKIP_SECONDS = 3 * 60 + 30

function defaultShotKind(user: ApiUser): ShotKind {
  if (user.drink_preference === 'green') return 'zelena'
  if (user.drink_preference === 'dark') return 'fernet'
  return 'slivovica'
}

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}:${rest.toString().padStart(2, '0')}`
}

function ShotPicker({
  person,
  busy,
  firstTime,
  kind,
  onKind,
  onClose,
  onSend,
}: {
  person: ApiUser
  busy: boolean
  firstTime: boolean
  kind: ShotKind
  onKind: (kind: ShotKind) => void
  onClose: () => void
  onSend: () => void
}) {
  return (
    <div className="v7-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="v7-shot-modal" role="dialog" aria-modal="true" aria-label={`Pozvat ${person.display_name} na panáka`}>
        <button className="v7-modal-close" type="button" onClick={onClose} aria-label="Zavřít"><X size={18} /></button>
        <div className="v7-modal-icon"><GlassWater size={27} /></div>
        <p className="eyebrow">Co mu nalét?</p>
        <h2>{person.display_name} ide na panáka</h2>
        {firstTime && (
          <div className="v7-first-shot-note">
            <Sparkles size={18} />
            <p><strong>Panák sa neposílá rovnou do žaludka.</strong> {person.display_name} ho napřed uvidí ve Hře a mosí ho přijmút. Když nechce, može ho přehodit někomu dalšímu.</p>
          </div>
        )}
        <div className="v7-shot-grid">
          {SHOT_KINDS.map((item) => (
            <button className={kind === item.id ? 'selected' : ''} type="button" key={item.id} onClick={() => onKind(item.id)}>
              {kind === item.id && <Check size={15} />}{item.label}
            </button>
          ))}
        </div>
        <button className="primary-button v7-send-shot" type="button" onClick={onSend} disabled={busy}>
          <GlassWater size={18} /> {busy ? 'Posílám do šenku…' : `Pozvat na ${shotKindLabel(kind).toLowerCase()}`}
        </button>
      </section>
    </div>
  )
}

function PhotoChallengeCard({ status, busy, message, onPhoto }: {
  status: PhotoChallengeStatus
  busy: boolean
  message: string
  onPhoto: (event: ChangeEvent<HTMLInputElement>) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const remaining = Math.max(0, status.needed - status.completed)

  return (
    <article className={`v7-challenge-card${status.achievement.earned ? ' earned' : ''}`}>
      <div className="v7-challenge-top">
        <div className="v7-challenge-icon">{status.achievement.earned ? <Trophy size={26} /> : <Camera size={26} />}</div>
        <div>
          <p className="eyebrow">Foto úkol na túto minutu</p>
          <h2>{status.achievement.earned ? 'Hodový nezmar' : 'Cvakni to, než sa to přehodí'}</h2>
        </div>
        <span className="v7-challenge-time"><Clock3 size={14} /> {status.seconds_until_change}s</span>
      </div>

      <p className="v7-challenge-text">{status.challenge.text}</p>
      <div className="v7-challenge-bottom">
        <div className="v7-challenge-progress">
          {status.achievement.earned
            ? <strong>Odznak máš. Teď už fotíš enom pro slávu.</strong>
            : <><strong>{remaining === 1 ? 'Ještě jedna fotka' : `Ještě ${remaining} fotek`} do odznaku „Hodový nezmar“.</strong><span>Počítá sa 12 různých výzev z 24.</span></>}
        </div>
        <button className="primary-button" type="button" disabled={busy} onClick={() => input.current?.click()}>
          <Camera size={18} /> {busy ? 'Ukládám důkaz…' : 'Cvaknút výzvu'}
        </button>
        <input ref={input} className="v2-hidden-input" type="file" accept="image/*" capture="environment" onChange={onPhoto} />
      </div>
      {message && <p className="v7-challenge-message">{message}</p>}
    </article>
  )
}

export default function HodyAppV7() {
  const usersRef = useRef<ApiUser[]>([])
  const [activeScreen, setActiveScreen] = useState('')
  const [gameMount, setGameMount] = useState<HTMLElement | null>(null)
  const [shotTarget, setShotTarget] = useState<ApiUser | null>(null)
  const [shotKind, setShotKind] = useState<ShotKind>('slivovica')
  const [shotBusy, setShotBusy] = useState(false)
  const [shotNotice, setShotNotice] = useState('')
  const [skipUntil, setSkipUntil] = useState(() => Number(window.localStorage.getItem(SKIP_COOLDOWN_KEY) ?? '0'))
  const [now, setNow] = useState(Date.now())
  const [challenge, setChallenge] = useState<PhotoChallengeStatus | null>(null)
  const [challengeBusy, setChallengeBusy] = useState(false)
  const [challengeMessage, setChallengeMessage] = useState('')

  const cooldownRemaining = Math.max(0, Math.ceil((skipUntil - now) / 1000))

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const syncScreen = () => {
      const label = document.querySelector('.bottom-nav button.active span')?.textContent?.trim() ?? ''
      setActiveScreen(label)
      const currentScreen = document.querySelector('main.v2-shell > section.screen') as HTMLElement | null
      if (label === 'Hra' && currentScreen) {
        let mount = currentScreen.querySelector('#v7-challenge-mount') as HTMLElement | null
        if (!mount) {
          mount = document.createElement('div')
          mount.id = 'v7-challenge-mount'
          const header = currentScreen.querySelector('.v2-page-header')
          if (header?.nextSibling) currentScreen.insertBefore(mount, header.nextSibling)
          else currentScreen.appendChild(mount)
        }
        setGameMount(mount)
      } else {
        setGameMount(null)
      }
    }

    syncScreen()
    const observer = new MutationObserver(syncScreen)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
    const timer = window.setInterval(syncScreen, 800)
    return () => {
      observer.disconnect()
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    const handler = async (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return

      const question = target.closest('.v2-question') as HTMLElement | null
      if (question && !target.closest('button')) {
        const confirmButton = question.querySelector('button') as HTMLButtonElement | null
        confirmButton?.click()
        return
      }

      const button = target.closest('button') as HTMLButtonElement | null
      if (!button) return

      if (button.textContent?.includes('Hoď někoho jiného')) {
        const conversationDone = Boolean(document.querySelector('.screen-home .v2-free-mode'))
        const current = Date.now()
        if (!conversationDone && skipUntil > current) {
          event.preventDefault()
          event.stopImmediatePropagation()
          setShotNotice(`Dalšího člověka možeš hodit za ${formatCountdown(Math.ceil((skipUntil - current) / 1000))}. Napřed chvilu vydrž u tohohle.`)
          return
        }
        if (!conversationDone) {
          const until = current + SKIP_SECONDS * 1000
          window.localStorage.setItem(SKIP_COOLDOWN_KEY, String(until))
          setSkipUntil(until)
        } else if (skipUntil) {
          window.localStorage.removeItem(SKIP_COOLDOWN_KEY)
          setSkipUntil(0)
        }
        return
      }

      if (button.textContent?.includes('Pozvat na panáka')) {
        event.preventDefault()
        event.stopImmediatePropagation()
        const name = button.closest('.person-tile')?.querySelector('h2')?.textContent?.trim()
          ?? button.closest('.v6-person-name-row')?.querySelector('h2')?.textContent?.trim()
        if (!name) return

        if (!usersRef.current.length) {
          try {
            usersRef.current = (await getUsers()).users
          } catch {
            setShotNotice('Lidi sa nepodařilo načíst. Panák chvílu počká.')
            return
          }
        }
        const person = usersRef.current.find((user) => user.display_name === name)
        if (!person) return
        setShotTarget(person)
        setShotKind(defaultShotKind(person))
      }
    }

    document.addEventListener('click', handler, true)
    return () => document.removeEventListener('click', handler, true)
  }, [skipUntil])

  useEffect(() => {
    if (activeScreen !== 'Hra') return
    let cancelled = false

    const loadChallenge = async () => {
      try {
        const result = await getPhotoChallenge()
        if (!cancelled) setChallenge(result)
      } catch {
        if (!cancelled) setChallenge(null)
      }
    }

    void loadChallenge()
    const challengeTimer = window.setInterval(loadChallenge, 60_000)

    const annotateShots = async () => {
      try {
        const result = await getV7PendingShots()
        const cards = Array.from(document.querySelectorAll('.v2-shot-card'))
        result.shots.forEach((shot, index) => {
          const copy = cards[index]?.querySelector('.v2-shot-copy')
          if (!copy) return
          let badge = copy.querySelector('.v7-shot-kind') as HTMLElement | null
          if (!badge) {
            badge = document.createElement('strong')
            badge.className = 'v7-shot-kind'
            copy.prepend(badge)
          }
          badge.textContent = shotKindLabel(shot.shot_kind)
        })
      } catch {
        // Legacy cards remain usable even if annotation fails.
      }
    }

    void annotateShots()
    const shotTimer = window.setInterval(annotateShots, 1800)
    return () => {
      cancelled = true
      window.clearInterval(challengeTimer)
      window.clearInterval(shotTimer)
    }
  }, [activeScreen])

  useEffect(() => {
    if (!challenge || activeScreen !== 'Hra') return
    const timer = window.setInterval(() => {
      setChallenge((current) => current ? { ...current, seconds_until_change: Math.max(0, current.seconds_until_change - 1) } : current)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [challenge?.challenge.id, activeScreen])

  const sendShot = async () => {
    if (!shotTarget || shotBusy) return
    setShotBusy(true)
    try {
      await buySpecificShot(shotTarget.id, shotKind)
      window.localStorage.setItem(SHOT_EXPLAINED_KEY, '1')
      setShotNotice(`${shotKindLabel(shotKind)} pro ${shotTarget.display_name} je v šenku. Teď ju mosí přijmút, nebo može poslat dál.`)
      setShotTarget(null)
    } catch (error) {
      setShotNotice(error instanceof Error ? error.message : 'Panák sa neposlal.')
    } finally {
      setShotBusy(false)
    }
  }

  const takeChallengePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !challenge || challengeBusy) return

    const challengeId = challenge.challenge.id
    setChallengeBusy(true)
    setChallengeMessage('')
    try {
      const imageData = await compressMomentPhoto(file)
      const saved = await saveMomentPhoto({ image_data: imageData })
      const result = await completePhotoChallenge(challengeId, saved.photo_id)
      setChallengeMessage(result.achievement_earned
        ? 'Hotovo. Hodový nezmar je tvůj.'
        : `Zapsané. ${Math.max(0, result.needed - result.completed)} výzev do odznaku.`)
      setChallenge(await getPhotoChallenge())
    } catch (error) {
      setChallengeMessage(error instanceof Error ? error.message : 'Výzvu sa nepodařilo uložit.')
    } finally {
      setChallengeBusy(false)
    }
  }

  return (
    <>
      <HodyAppV6 />

      {shotNotice && (
        <button className="v7-toast" type="button" onClick={() => setShotNotice('')}>
          <Sparkles size={17} /><span>{shotNotice}</span><strong>×</strong>
        </button>
      )}

      {activeScreen === 'Dom' && cooldownRemaining > 0 && (
        <div className="v7-skip-cooldown">
          <Clock3 size={17} />
          <span>Další los až za <strong>{formatCountdown(cooldownRemaining)}</strong>. Když dáte „Bavili sme sa“, brzda sa zruší.</span>
        </div>
      )}

      {shotTarget && (
        <ShotPicker
          person={shotTarget}
          busy={shotBusy}
          firstTime={window.localStorage.getItem(SHOT_EXPLAINED_KEY) !== '1'}
          kind={shotKind}
          onKind={setShotKind}
          onClose={() => setShotTarget(null)}
          onSend={() => void sendShot()}
        />
      )}

      {gameMount && challenge && createPortal(
        <PhotoChallengeCard status={challenge} busy={challengeBusy} message={challengeMessage} onPhoto={takeChallengePhoto} />,
        gameMount,
      )}
    </>
  )
}
