import { FormEvent, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { KeyRound, Languages, RotateCcw, X } from 'lucide-react'
import HodyAppV11 from './HodyAppV11'
import './hody-v12.css'

type Language = 'cs' | 'en'
type ListedUser = { id: string; display_name: string; preferred_language?: Language }

const LANGUAGE_KEY = 'hody-language-v1'

function currentLanguage(): Language {
  const saved = window.localStorage.getItem(LANGUAGE_KEY)
  if (saved === 'cs' || saved === 'en') return saved
  const browser = (navigator.languages?.[0] || navigator.language || '').toLowerCase()
  return browser.startsWith('cs') || browser.startsWith('sk') ? 'cs' : 'en'
}

function RegistrationExtras({
  language,
  pin,
  onLanguage,
  onPin,
}: {
  language: Language
  pin: string
  onLanguage: (value: Language) => void
  onPin: (value: string) => void
}) {
  const english = currentLanguage() === 'en'
  return (
    <div className="v12-registration-extras">
      <label>
        <span><Languages size={15} /> {english ? 'App language' : 'Jazyk aplikace'}</span>
        <select value={language} onChange={(event) => onLanguage(event.target.value as Language)} required>
          <option value="cs">Čeština</option>
          <option value="en">English</option>
        </select>
        <small>{english ? 'Saved to your account and used as your default language.' : 'Uloží sa k účtu a příště sa použije jako výchozí jazyk.'}</small>
      </label>
      <label>
        <span><KeyRound size={15} /> {english ? '4-digit recovery PIN' : '4místný obnovovací PIN'}</span>
        <input
          value={pin}
          onChange={(event) => onPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
          inputMode="numeric"
          autoComplete="off"
          pattern="[0-9]{4}"
          minLength={4}
          maxLength={4}
          placeholder="1234"
          required
        />
        <small>{english ? 'Use it if you forget your password. Pick four digits you will remember.' : 'Použiješ ho, když zapomeneš heslo. Dej si čtyři čísla, které si zapamatuješ.'}</small>
      </label>
    </div>
  )
}

function LoginExtras({ language, onLanguage, onForgot }: {
  language: Language
  onLanguage: (value: Language) => void
  onForgot: () => void
}) {
  const english = language === 'en'
  return (
    <div className="v12-login-extras">
      <label>
        <span><Languages size={15} /> {english ? 'Language' : 'Jazyk'}</span>
        <select value={language} onChange={(event) => onLanguage(event.target.value as Language)}>
          <option value="cs">Čeština</option>
          <option value="en">English</option>
        </select>
      </label>
      <button className="v12-forgot-button" type="button" onClick={onForgot}>
        <KeyRound size={16} /> {english ? 'Forgot password?' : 'Zapomenuté heslo?'}
      </button>
    </div>
  )
}

function PasswordReset({ language, onClose }: { language: Language; onClose: () => void }) {
  const english = language === 'en'
  const [users, setUsers] = useState<ListedUser[]>([])
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetch('/api/users', { credentials: 'same-origin' })
      .then(async (response) => response.ok ? response.json() as Promise<{ users: ListedUser[] }> : { users: [] })
      .then((result) => {
        setUsers(result.users)
        setName((current) => current || result.users[0]?.display_name || '')
      })
      .catch(() => setUsers([]))
  }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    if (password !== confirm) {
      setMessage(english ? 'The passwords do not match.' : 'Nové heslo sa neshoduje.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/api/v12/password-reset', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, recovery_pin: pin, new_password: password }),
      })
      const body = await response.json() as { error?: string }
      if (!response.ok) throw new Error(body.error || (english ? 'Password reset failed.' : 'Heslo sa nepodařilo přepsat.'))
      setSuccess(true)
      setMessage(english ? 'Password changed. You can sign in now.' : 'Heslo je přepsané. Teď sa možeš přihlásit.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (english ? 'Password reset failed.' : 'Heslo sa nepodařilo přepsat.'))
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div className="v12-reset-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="v12-reset-modal" role="dialog" aria-modal="true" aria-label={english ? 'Reset password' : 'Obnovit heslo'}>
        <button className="v12-reset-close" type="button" onClick={onClose} aria-label={english ? 'Close' : 'Zavřít'}><X size={18} /></button>
        <div className="v12-reset-icon"><RotateCcw size={26} /></div>
        <p className="eyebrow">{english ? 'Account recovery' : 'Záchrana účtu'}</p>
        <h2>{english ? 'Set a new password' : 'Nastav si nové heslo'}</h2>
        <p>{english ? 'Choose your account, enter the four-digit PIN from registration, and set a new password.' : 'Vyber svůj účet, zadej čtyřmístný PIN z registrace a nastav nové heslo.'}</p>
        {!success ? (
          <form onSubmit={submit}>
            <label><span>{english ? 'Account' : 'Účet'}</span><select value={name} onChange={(event) => setName(event.target.value)} required>{users.map((user) => <option key={user.id} value={user.display_name}>{user.display_name}</option>)}</select></label>
            <label><span>{english ? 'Recovery PIN' : 'Obnovovací PIN'}</span><input value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" pattern="[0-9]{4}" placeholder="1234" required /></label>
            <label><span>{english ? 'New password' : 'Nové heslo'}</span><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={4} maxLength={128} required /></label>
            <label><span>{english ? 'Repeat new password' : 'Nové heslo znova'}</span><input value={confirm} onChange={(event) => setConfirm(event.target.value)} type="password" minLength={4} maxLength={128} required /></label>
            <button className="primary-button" type="submit" disabled={busy || !name}>{busy ? (english ? 'Resetting…' : 'Přepisuju…') : (english ? 'Reset password' : 'Přepsat heslo')}</button>
          </form>
        ) : <button className="primary-button" type="button" onClick={onClose}>{english ? 'Back to sign in' : 'Zpátky na přihlášení'}</button>}
        {message && <p className={success ? 'v12-reset-success' : 'entry-error'}>{message}</p>}
      </section>
    </div>,
    document.body,
  )
}

export default function HodyAppV12() {
  const registerLanguageRef = useRef<Language>(currentLanguage())
  const recoveryPinRef = useRef('')
  const [language, setLanguage] = useState<Language>(currentLanguage())
  const [registrationLanguage, setRegistrationLanguage] = useState<Language>(currentLanguage())
  const [recoveryPin, setRecoveryPin] = useState('')
  const [registrationMount, setRegistrationMount] = useState<HTMLElement | null>(null)
  const [loginMount, setLoginMount] = useState<HTMLElement | null>(null)
  const [resetOpen, setResetOpen] = useState(false)

  useEffect(() => { registerLanguageRef.current = registrationLanguage }, [registrationLanguage])
  useEffect(() => { recoveryPinRef.current = recoveryPin }, [recoveryPin])

  const switchLanguage = async (next: Language) => {
    if (next === language) return
    try {
      await fetch('/api/v12/language', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ preferred_language: next }),
      })
    } catch {
      // Anonymous visitors only store the choice locally.
    }
    window.localStorage.setItem(LANGUAGE_KEY, next)
    window.location.reload()
  }

  useEffect(() => {
    const nativeFetch = window.fetch.bind(window)
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()

      if (method === 'POST' && url.includes('/api/register') && typeof init?.body === 'string') {
        try {
          const body = JSON.parse(init.body) as Record<string, unknown>
          const response = await nativeFetch(input, {
            ...init,
            body: JSON.stringify({
              ...body,
              preferred_language: registerLanguageRef.current,
              recovery_pin: recoveryPinRef.current,
            }),
          })
          if (response.ok) window.localStorage.setItem(LANGUAGE_KEY, registerLanguageRef.current)
          return response
        } catch {
          return nativeFetch(input, init)
        }
      }

      const response = await nativeFetch(input, init)
      if (method === 'POST' && url.includes('/api/login') && response.ok) {
        try {
          const payload = await response.clone().json() as { user?: { preferred_language?: Language } }
          const accountLanguage = payload.user?.preferred_language
          if (accountLanguage === 'cs' || accountLanguage === 'en') {
            const changed = accountLanguage !== currentLanguage()
            window.localStorage.setItem(LANGUAGE_KEY, accountLanguage)
            if (changed) window.setTimeout(() => window.location.reload(), 80)
          }
        } catch {
          // Login itself stays valid even if language sync fails.
        }
      }
      return response
    }
    return () => { window.fetch = nativeFetch }
  }, [])

  useEffect(() => {
    fetch('/api/me', { credentials: 'same-origin' })
      .then(async (response) => response.ok ? response.json() as Promise<{ user?: { preferred_language?: Language } | null }> : { user: null })
      .then((payload) => {
        const preferred = payload.user?.preferred_language
        if ((preferred === 'cs' || preferred === 'en') && preferred !== currentLanguage()) {
          window.localStorage.setItem(LANGUAGE_KEY, preferred)
          window.location.reload()
        }
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    const sync = () => {
      const form = document.querySelector('.entry-form') as HTMLFormElement | null
      if (!form) {
        setRegistrationMount(null)
        setLoginMount(null)
        return
      }
      const registration = Boolean(form.querySelector('.v3-registration-facts'))
      if (registration) {
        let mount = form.querySelector('#v12-registration-extras') as HTMLElement | null
        if (!mount) {
          mount = document.createElement('div')
          mount.id = 'v12-registration-extras'
          const firstLabel = form.querySelector('label')
          if (firstLabel) form.insertBefore(mount, firstLabel)
          else form.prepend(mount)
        }
        setRegistrationMount(mount)
        setLoginMount(null)
      } else {
        let mount = form.querySelector('#v12-login-extras') as HTMLElement | null
        if (!mount) {
          mount = document.createElement('div')
          mount.id = 'v12-login-extras'
          const submit = form.querySelector('button[type="submit"]')
          if (submit) form.insertBefore(mount, submit)
          else form.appendChild(mount)
        }
        setLoginMount(mount)
        setRegistrationMount(null)
      }
    }

    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <HodyAppV11 />

      <button className="v12-language-toggle" type="button" onClick={() => void switchLanguage(language === 'cs' ? 'en' : 'cs')}>
        <Languages size={16} /><strong>{language === 'cs' ? 'EN' : 'CZ'}</strong>
      </button>

      {registrationMount && createPortal(
        <RegistrationExtras
          language={registrationLanguage}
          pin={recoveryPin}
          onLanguage={setRegistrationLanguage}
          onPin={setRecoveryPin}
        />,
        registrationMount,
      )}

      {loginMount && createPortal(
        <LoginExtras language={language} onLanguage={(next) => void switchLanguage(next)} onForgot={() => setResetOpen(true)} />,
        loginMount,
      )}

      {resetOpen && <PasswordReset language={language} onClose={() => setResetOpen(false)} />}
    </>
  )
}
