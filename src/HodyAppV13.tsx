import { ChangeEvent, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Camera, ImagePlus, Sparkles, UserRound } from 'lucide-react'
import HodyAppV12 from './HodyAppV12'
import { compressMomentPhoto, takePendingMomentArchive } from './photo-next'
import './hody-v13.css'

type Language = 'cs' | 'en'
type ListedUser = {
  id: string
  display_name: string
  profile_photo_data?: string | null
  is_available?: number
}

const LANGUAGE_KEY = 'hody-language-v1'
const SKIP_COOLDOWN_KEY = 'hody-skip-cooldown-until-v10'

function language(): Language {
  return window.localStorage.getItem(LANGUAGE_KEY) === 'en' ? 'en' : 'cs'
}

function FreeMomentCard({
  people,
  meId,
  taggedUserId,
  busy,
  message,
  onTaggedUser,
  onPhoto,
}: {
  people: ListedUser[]
  meId: string
  taggedUserId: string
  busy: boolean
  message: string
  onTaggedUser: (value: string) => void
  onPhoto: (event: ChangeEvent<HTMLInputElement>) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const english = language() === 'en'
  const candidates = people
    .filter((person) => person.id !== meId)
    .sort((a, b) => a.display_name.localeCompare(b.display_name, english ? 'en' : 'cs'))

  return (
    <article className="v13-free-moment">
      <div className="v13-free-moment-icon"><ImagePlus size={25} /></div>
      <div className="v13-free-moment-copy">
        <span>{english ? 'Festival feed' : 'Do Drbů'}</span>
        <h2>{english ? 'Take a moment' : 'Vyfoť momentku'}</h2>
        <p>{english
          ? 'A standalone photo for the feed. It is not tied to the current conversation and earns you +1 point.'
          : 'Samostatná fotka do Drbů. Není svázaná s aktuálním hovorem a dostaneš za ni +1 bod.'}</p>
      </div>
      <label className="v13-free-moment-person">
        <span><UserRound size={14} /> {english ? 'Who is in the photo? · optional' : 'Kdo je na fotce? · volitelné'}</span>
        <select value={taggedUserId} onChange={(event) => onTaggedUser(event.target.value)} disabled={busy}>
          <option value="">{english ? 'Nobody in particular' : 'Nikdo konkrétní'}</option>
          {candidates.map((person) => <option value={person.id} key={person.id}>{person.display_name}</option>)}
        </select>
      </label>
      <button className="primary-button v13-free-moment-button" type="button" disabled={busy} onClick={() => input.current?.click()}>
        <Camera size={18} /> {busy ? (english ? 'Saving photo…' : 'Ukládám momentku…') : (english ? 'Take a moment' : 'Vyfoť momentku')}
      </button>
      <input ref={input} className="v2-hidden-input" type="file" accept="image/*" capture="environment" onChange={onPhoto} />
      {message && <p className="v13-free-moment-message"><Sparkles size={14} /> {message}</p>}
    </article>
  )
}

export default function HodyAppV13() {
  useState(() => {
    // Cooldown from a previous page load must never block a freshly opened app.
    window.localStorage.removeItem(SKIP_COOLDOWN_KEY)
    return true
  })

  const [homeMount, setHomeMount] = useState<HTMLElement | null>(null)
  const [people, setPeople] = useState<ListedUser[]>([])
  const [meId, setMeId] = useState('')
  const [taggedUserId, setTaggedUserId] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const refresh = async () => {
      if (!document.querySelector('main.v2-shell')) return
      try {
        const [meResponse, peopleResponse] = await Promise.all([
          fetch('/api/me', { credentials: 'same-origin' }),
          fetch('/api/users', { credentials: 'same-origin' }),
        ])
        if (meResponse.ok) {
          const payload = await meResponse.json() as { user?: { id?: string } | null }
          setMeId(payload.user?.id ?? '')
        }
        if (peopleResponse.ok) {
          const payload = await peopleResponse.json() as { users?: ListedUser[] }
          setPeople(payload.users ?? [])
        }
      } catch {
        // The underlying app handles its own loading errors.
      }
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 7000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const syncMount = () => {
      const home = document.querySelector('.screen-home') as HTMLElement | null
      if (!home) {
        setHomeMount(null)
        return
      }
      let mount = home.querySelector('#v13-free-moment-mount') as HTMLElement | null
      if (!mount) {
        mount = document.createElement('div')
        mount.id = 'v13-free-moment-mount'
        const banner = home.querySelector('.v2-festival-banner')
        if (banner) banner.insertAdjacentElement('afterend', mount)
        else home.prepend(mount)
      }
      setHomeMount(mount)
    }

    syncMount()
    const observer = new MutationObserver(syncMount)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const stopDuplicateOnlyPerson = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const button = target?.closest('button') as HTMLButtonElement | null
      if (!button) return
      const copy = button.textContent ?? ''
      if (!copy.includes('Hoď někoho jiného') && !copy.includes('Another person')) return
      const available = people.filter((person) => person.id !== meId && person.is_available === 1)
      if (available.length > 1) return
      event.preventDefault()
      event.stopImmediatePropagation()
      setMessage(language() === 'en'
        ? 'There is nobody else available right now, so I will not show you the same person again.'
        : 'Teď tu není nikdo další dostupný, takže ti stejného člověka znovu nenahodím.')
    }
    window.addEventListener('click', stopDuplicateOnlyPerson, true)
    return () => window.removeEventListener('click', stopDuplicateOnlyPerson, true)
  }, [people, meId])

  const pickFreeMoment = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || busy) return
    setBusy(true)
    setMessage('')
    try {
      const imageData = await compressMomentPhoto(file)
      const archive = await takePendingMomentArchive()
      const response = await fetch('/api/v13/free-moment', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          image_data: imageData,
          drive_file_id: archive?.drive_file_id,
          tagged_user_id: taggedUserId || undefined,
        }),
      })
      const payload = await response.json() as { error?: string; points?: number }
      if (!response.ok) throw new Error(payload.error || (language() === 'en' ? 'The photo could not be saved.' : 'Momentka sa nepodařila uložit.'))
      setMessage(language() === 'en' ? 'Added to the feed. +1 point.' : 'Momentka je v Drbech. +1 bod.')
      setTaggedUserId('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (language() === 'en' ? 'The photo could not be saved.' : 'Momentka sa nepodařila uložit.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <HodyAppV12 />
      {homeMount && createPortal(
        <FreeMomentCard
          people={people}
          meId={meId}
          taggedUserId={taggedUserId}
          busy={busy}
          message={message}
          onTaggedUser={setTaggedUserId}
          onPhoto={pickFreeMoment}
        />,
        homeMount,
      )}
    </>
  )
}
