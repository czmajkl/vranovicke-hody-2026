import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Flame, Heart, Sparkles } from 'lucide-react'
import HodyAppV8 from './HodyAppV8'
import spicyData from './data/spicy-questions.json'
import {
  getMeV9,
  getUsersV9,
  type ApiUserV9,
  type RelationshipStatus,
} from './api-v9'
import './hody-v9.css'

type SpicyQuestion = {
  id: string
  category: 'spicy'
  text: string
}

const SPICY_QUESTIONS = spicyData.spicy_questions as SpicyQuestion[]

const RELATIONSHIP_OPTIONS: Array<{ value: RelationshipStatus; label: string; copy: string }> = [
  { value: 'looking', label: 'Chcu sa seznámit', copy: 'Když potkáš kompatibilního člověka se stejným stavem, může padnút aj čtvrtá spicy otázka.' },
  { value: 'not_looking', label: 'Teď nic nehledám', copy: 'Pokec klidně, ale seznamovací otázky necháme být.' },
  { value: 'taken', label: 'Su zadaný/á', copy: 'Vztahový radar je vypnutý. Normální otázky jedú dál.' },
]

function relationshipLabel(value: RelationshipStatus) {
  return RELATIONSHIP_OPTIONS.find((item) => item.value === value)?.label ?? 'Teď nic nehledám'
}

function isSpicyPair(me: ApiUserV9 | null, person: ApiUserV9 | undefined) {
  if (!me || !person) return false
  if (me.relationship_status !== 'looking' || person.relationship_status !== 'looking') return false
  if (!me.gender || !person.gender) return false
  return !(me.gender === 'male' && person.gender === 'male')
}

function pickSpicy(previous: string) {
  const pool = SPICY_QUESTIONS.filter((item) => item.text !== previous)
  const choices = pool.length ? pool : SPICY_QUESTIONS
  return choices[Math.floor(Math.random() * choices.length)]?.text ?? ''
}

function RelationshipSelect({ value, onChange, compact = false }: {
  value: RelationshipStatus
  onChange: (value: RelationshipStatus) => void
  compact?: boolean
}) {
  const selected = RELATIONSHIP_OPTIONS.find((item) => item.value === value) ?? RELATIONSHIP_OPTIONS[1]
  return (
    <label className={`v9-relationship-select${compact ? ' compact' : ''}`}>
      <span><Heart size={16} /> Jak to máš se seznamováním</span>
      <select value={value} onChange={(event) => onChange(event.target.value as RelationshipStatus)}>
        {RELATIONSHIP_OPTIONS.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
      </select>
      {!compact && <small>{selected.copy}</small>}
    </label>
  )
}

function RelationshipCard({ value }: { value: RelationshipStatus }) {
  const selected = RELATIONSHIP_OPTIONS.find((item) => item.value === value) ?? RELATIONSHIP_OPTIONS[1]
  return (
    <div className={`v9-relationship-card ${value}`}>
      <Heart size={20} />
      <div><span>Seznamovací stav</span><strong>{selected.label}</strong><small>{selected.copy}</small></div>
    </div>
  )
}

function SpicyQuestionCard({ question, selected, onToggle }: {
  question: string
  selected: boolean
  onToggle: () => void
}) {
  return (
    <article className={`v2-question v9-spicy-question${selected ? ' checked' : ''}`} data-v9-spicy="true">
      <span className="v2-question-number v9-spicy-number">4</span>
      <div className="v9-spicy-copy"><span><Flame size={14} /> SPICY</span><p>{question}</p></div>
      <button type="button" onClick={onToggle}>{selected ? <><Check size={17} /> Tož jo</> : 'Tuhle sme dali'}</button>
    </article>
  )
}

export default function HodyAppV9() {
  const registerStatusRef = useRef<RelationshipStatus>('not_looking')
  const profileStatusRef = useRef<RelationshipStatus>('not_looking')
  const profileDirtyRef = useRef(false)
  const spicySelectedRef = useRef(false)
  const spicyQuestionRef = useRef('')
  const lastQuestionSignatureRef = useRef('')

  const [registerStatus, setRegisterStatus] = useState<RelationshipStatus>('not_looking')
  const [profileStatus, setProfileStatus] = useState<RelationshipStatus>('not_looking')
  const [me, setMe] = useState<ApiUserV9 | null>(null)
  const [people, setPeople] = useState<ApiUserV9[]>([])
  const [registerMount, setRegisterMount] = useState<HTMLElement | null>(null)
  const [profileEditorMount, setProfileEditorMount] = useState<HTMLElement | null>(null)
  const [profileStatusMount, setProfileStatusMount] = useState<HTMLElement | null>(null)
  const [spicyMount, setSpicyMount] = useState<HTMLElement | null>(null)
  const [spicyQuestion, setSpicyQuestion] = useState('')
  const [spicySelected, setSpicySelected] = useState(false)

  useEffect(() => { registerStatusRef.current = registerStatus }, [registerStatus])
  useEffect(() => { profileStatusRef.current = profileStatus }, [profileStatus])
  useEffect(() => { spicySelectedRef.current = spicySelected }, [spicySelected])
  useEffect(() => { spicyQuestionRef.current = spicyQuestion }, [spicyQuestion])

  const changeProfileStatus = (value: RelationshipStatus) => {
    profileDirtyRef.current = true
    setProfileStatus(value)
  }

  useEffect(() => {
    const nativeFetch = window.fetch.bind(window)
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()

      if (typeof init?.body === 'string' && method === 'POST' && url.includes('/api/register')) {
        try {
          const body = JSON.parse(init.body) as Record<string, unknown>
          return nativeFetch(input, { ...init, body: JSON.stringify({ ...body, relationship_status: registerStatusRef.current }) })
        } catch {
          return nativeFetch(input, init)
        }
      }

      if (typeof init?.body === 'string' && method === 'PATCH' && url.includes('/api/me/profile')) {
        try {
          const body = JSON.parse(init.body) as Record<string, unknown>
          const response = await nativeFetch(input, { ...init, body: JSON.stringify({ ...body, relationship_status: profileStatusRef.current }) })
          if (response.ok) profileDirtyRef.current = false
          return response
        } catch {
          return nativeFetch(input, init)
        }
      }

      if (
        typeof init?.body === 'string' &&
        method === 'POST' &&
        url.includes('/api/interactions') &&
        spicySelectedRef.current &&
        spicyQuestionRef.current
      ) {
        try {
          const body = JSON.parse(init.body) as { questions?: unknown[]; [key: string]: unknown }
          const questions = Array.isArray(body.questions) ? body.questions.filter((item): item is string => typeof item === 'string') : []
          if (!questions.includes(spicyQuestionRef.current)) questions.push(spicyQuestionRef.current)
          return nativeFetch(input, { ...init, body: JSON.stringify({ ...body, questions }) })
        } catch {
          return nativeFetch(input, init)
        }
      }

      return nativeFetch(input, init)
    }
    return () => { window.fetch = nativeFetch }
  }, [])

  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      if (!document.querySelector('main.v2-shell')) return
      try {
        const [meResult, peopleResult] = await Promise.all([getMeV9(), getUsersV9()])
        if (cancelled) return
        setMe(meResult.user)
        setPeople(peopleResult.users)
        if (meResult.user && !profileDirtyRef.current) setProfileStatus(meResult.user.relationship_status)
      } catch {
        // Starší UI může dál fungovat i kdyby seznamovací rozšíření zrovna neodpovědělo.
      }
    }
    void refresh()
    const timer = window.setInterval(refresh, 5000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [])

  useEffect(() => {
    const annotatePeople = () => {
      if (!people.length) return
      const addChip = (host: Element | null, name: string) => {
        if (!host || host.querySelector('.v9-relationship-chip')) return
        const person = people.find((item) => item.display_name === name)
        if (!person) return
        const chip = document.createElement('span')
        chip.className = `v9-relationship-chip ${person.relationship_status}`
        chip.textContent = relationshipLabel(person.relationship_status)
        host.appendChild(chip)
      }

      document.querySelectorAll('.person-tile').forEach((tile) => {
        const name = tile.querySelector('h2')?.textContent?.trim() ?? ''
        addChip(tile.querySelector('.person-title-row'), name)
      })

      const homeName = document.querySelector('.screen-home .v6-person-name-row h2')?.textContent?.trim() ?? ''
      addChip(document.querySelector('.screen-home .v6-person-name-row'), homeName)
    }

    annotatePeople()
    const observer = new MutationObserver(annotatePeople)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [people])

  useEffect(() => {
    const syncMounts = () => {
      const registrationGrid = document.querySelector('.entry-form .v3-registration-facts')
      if (registrationGrid) {
        let mount = registrationGrid.querySelector('#v9-register-relationship') as HTMLElement | null
        if (!mount) {
          mount = document.createElement('div')
          mount.id = 'v9-register-relationship'
          registrationGrid.appendChild(mount)
        }
        setRegisterMount(mount)
      } else {
        setRegisterMount(null)
      }

      const profileGrid = document.querySelector('.v4-profile-editor .v4-editor-grid')
      if (profileGrid) {
        let mount = profileGrid.querySelector('#v9-profile-editor-relationship') as HTMLElement | null
        if (!mount) {
          mount = document.createElement('div')
          mount.id = 'v9-profile-editor-relationship'
          profileGrid.appendChild(mount)
        }
        setProfileEditorMount(mount)
      } else {
        setProfileEditorMount(null)
      }

      const profileCard = document.querySelector('.v2-profile-card')
      if (profileCard) {
        let mount = document.querySelector('#v9-profile-relationship') as HTMLElement | null
        if (!mount) {
          mount = document.createElement('div')
          mount.id = 'v9-profile-relationship'
          profileCard.insertAdjacentElement('afterend', mount)
        }
        setProfileStatusMount(mount)
      } else {
        setProfileStatusMount(null)
      }

      const home = document.querySelector('.screen-home')
      const zone = home?.querySelector('.v2-question-zone')
      const targetName = home?.querySelector('.v6-person-name-row h2')?.textContent?.trim() ?? ''
      const target = people.find((item) => item.display_name === targetName)
      const regularCards = Array.from(zone?.querySelectorAll<HTMLElement>('.v2-question:not([data-v9-spicy="true"])') ?? [])
      const signature = regularCards.slice(0, 3).map((card) => card.querySelector('p')?.textContent?.trim() ?? '').join('|')

      if (zone && isSpicyPair(me, target)) {
        let mount = zone.querySelector('#v9-spicy-question-mount') as HTMLElement | null
        if (!mount) {
          mount = document.createElement('div')
          mount.id = 'v9-spicy-question-mount'
          zone.appendChild(mount)
        }
        setSpicyMount(mount)

        if (signature && signature !== lastQuestionSignatureRef.current) {
          lastQuestionSignatureRef.current = signature
          const next = pickSpicy(spicyQuestionRef.current)
          setSpicyQuestion(next)
          setSpicySelected(false)
        } else if (!spicyQuestionRef.current) {
          setSpicyQuestion(pickSpicy(''))
          setSpicySelected(false)
        }
      } else {
        setSpicyMount(null)
        if (signature && signature !== lastQuestionSignatureRef.current) lastQuestionSignatureRef.current = signature
        setSpicySelected(false)
      }
    }

    syncMounts()
    const observer = new MutationObserver(syncMounts)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    const timer = window.setInterval(syncMounts, 900)
    return () => { observer.disconnect(); window.clearInterval(timer) }
  }, [me, people])

  return (
    <>
      <HodyAppV8 />

      {registerMount && createPortal(
        <RelationshipSelect value={registerStatus} onChange={setRegisterStatus} />,
        registerMount,
      )}

      {profileEditorMount && createPortal(
        <RelationshipSelect value={profileStatus} onChange={changeProfileStatus} compact />,
        profileEditorMount,
      )}

      {profileStatusMount && createPortal(<RelationshipCard value={profileStatus} />, profileStatusMount)}

      {spicyMount && spicyQuestion && createPortal(
        <SpicyQuestionCard question={spicyQuestion} selected={spicySelected} onToggle={() => setSpicySelected((value) => !value)} />,
        spicyMount,
      )}

      {spicyMount && <div className="v9-spicy-hint"><Sparkles size={14} /> Oba máte „Chcu sa seznámit“, tož přibyla jedna odvážnější.</div>}
    </>
  )
}
