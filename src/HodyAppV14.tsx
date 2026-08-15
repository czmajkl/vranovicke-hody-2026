import { FormEvent, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { KeyRound, LockKeyhole, X } from 'lucide-react'
import HodyAppV13 from './HodyAppV13'
import './hody-v14.css'

type Language = 'cs' | 'en'
type ListedUser = {
  id: string
  display_name: string
}

type PasswordDialog = {
  open: boolean
  lockedName?: string
}

const LANGUAGE_KEY = 'hody-language-v1'

function language(): Language {
  return window.localStorage.getItem(LANGUAGE_KEY) === 'en' ? 'en' : 'cs'
}

function PasswordChangeModal({ lockedName, onClose }: { lockedName?: string; onClose: () => void }) {
  const english = language() === 'en'
  const [users, setUsers] = useState<ListedUser[]>([])
  const [name, setName] = useState(lockedName ?? '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (lockedName) {
      setName(lockedName)
      return
    }
    fetch('/api/users', { credentials: 'same-origin' })
      .then(async (response) => response.ok ? response.json() as Promise<{ users?: ListedUser[] }> : { users: [] })
      .then((payload) => {
        const next = payload.users ?? []
        setUsers(next)
        setName((current) => current || next[0]?.display_name || '')
      })
      .catch(() => setUsers([]))
  }, [lockedName])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || !name) return
    if (password !== confirm) {
      setMessage(english ? 'The passwords do not match.' : 'Hesla sa neshodujú.')
      return
    }
    if (password.length < 4) {
      setMessage(english ? 'Use at least 4 characters.' : 'Dej heslo aspoň na 4 znaky.')
      return
    }

    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/api/v14/password-reset-open', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, new_password: password, language: language() }),
      })
      const body = await response.json() as { error?: string }
      if (!response.ok) throw new Error(body.error || (english ? 'Password change failed.' : 'Heslo sa nepodařilo změnit.'))
      setSuccess(true)
      setMessage(english ? 'Password changed.' : 'Heslo je změněné.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (english ? 'Password change failed.' : 'Heslo sa nepodařilo změnit.'))
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div className="v14-password-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="v14-password-modal" role="dialog" aria-modal="true" aria-label={english ? 'Change password' : 'Změna hesla'}>
        <button className="v14-password-close" type="button" onClick={onClose} aria-label={english ? 'Close' : 'Zavřít'}><X size={18} /></button>
        <div className="v14-password-icon"><KeyRound size={26} /></div>
        <p className="eyebrow">{english ? 'Account' : 'Účet'}</p>
        <h2>{english ? 'Change password' : 'Změna hesla'}</h2>
        <p>{english ? 'No old password or recovery PIN is required.' : 'Bez starého hesla a bez obnovovacího PINu.'}</p>

        {!success ? (
          <form onSubmit={submit} className="v14-password-form">
            {lockedName ? (
              <div className="v14-password-account"><span>{english ? 'Account' : 'Účet'}</span><strong>{lockedName}</strong></div>
            ) : (
              <label>
                <span>{english ? 'Account' : 'Účet'}</span>
                <select value={name} onChange={(event) => setName(event.target.value)} required>
                  {users.map((user) => <option key={user.id} value={user.display_name}>{user.display_name}</option>)}
                </select>
              </label>
            )}
            <label>
              <span>{english ? 'New password' : 'Nové heslo'}</span>
              <div className="v14-password-input"><LockKeyhole size={16} /><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={4} maxLength={128} required /></div>
            </label>
            <label>
              <span>{english ? 'Repeat new password' : 'Nové heslo znova'}</span>
              <div className="v14-password-input"><LockKeyhole size={16} /><input value={confirm} onChange={(event) => setConfirm(event.target.value)} type="password" minLength={4} maxLength={128} required /></div>
            </label>
            <button className="primary-button" type="submit" disabled={busy || !name}>
              <KeyRound size={17} /> {busy ? (english ? 'Changing…' : 'Měním…') : (english ? 'Change password' : 'Změnit heslo')}
            </button>
          </form>
        ) : (
          <button className="primary-button" type="button" onClick={onClose}>{english ? 'Done' : 'Hotovo'}</button>
        )}
        {message && <p className={success ? 'v14-password-success' : 'entry-error'}>{message}</p>}
      </section>
    </div>,
    document.body,
  )
}

function LoginPasswordButton({ onClick }: { onClick: () => void }) {
  const english = language() === 'en'
  return <button className="v14-login-password" type="button" onClick={onClick}><KeyRound size={16} /> {english ? 'Change password' : 'Změna hesla'}</button>
}

function ProfilePasswordCard({ name, onClick }: { name: string; onClick: () => void }) {
  const english = language() === 'en'
  return (
    <section className="v14-profile-password">
      <div><span>{english ? 'Account access' : 'Přístup k účtu'}</span><h2>{english ? 'Password' : 'Heslo'}</h2><p>{english ? `Change the password for ${name} without entering the old one.` : `Změň heslo pro ${name} bez zadávání starého hesla.`}</p></div>
      <button type="button" onClick={onClick}><KeyRound size={17} /> {english ? 'Change password' : 'Změna hesla'}</button>
    </section>
  )
}

export default function HodyAppV14() {
  const [loginMount, setLoginMount] = useState<HTMLElement | null>(null)
  const [profileMount, setProfileMount] = useState<HTMLElement | null>(null)
  const [profileName, setProfileName] = useState('')
  const [dialog, setDialog] = useState<PasswordDialog>({ open: false })

  useEffect(() => {
    const sync = () => {
      // Recovery PIN is obsolete in V14. Keep V12's legacy state out of sight and
      // disable its required input so registration is not blocked.
      const registrationExtras = document.querySelector('.v12-registration-extras')
      if (registrationExtras) {
        const labels = registrationExtras.querySelectorAll('label')
        const pinLabel = labels.item(1) as HTMLElement | null
        if (pinLabel) {
          pinLabel.style.display = 'none'
          const input = pinLabel.querySelector('input')
          if (input) {
            input.required = false
            input.disabled = true
          }
        }
      }

      document.querySelectorAll<HTMLElement>('.v12-forgot-button').forEach((button) => { button.style.display = 'none' })

      const loginForm = document.querySelector('.login-card .entry-form') as HTMLFormElement | null
      if (loginForm) {
        let mount = loginForm.querySelector('#v14-login-password-mount') as HTMLElement | null
        if (!mount) {
          mount = document.createElement('div')
          mount.id = 'v14-login-password-mount'
          const submit = loginForm.querySelector('button[type="submit"]')
          if (submit) loginForm.insertBefore(mount, submit)
          else loginForm.appendChild(mount)
        }
        setLoginMount(mount)
      } else {
        setLoginMount(null)
      }

      const profileCard = document.querySelector('.v2-profile-card') as HTMLElement | null
      if (profileCard) {
        const name = profileCard.querySelector('h2')?.textContent?.trim() ?? ''
        if (name) setProfileName(name)
        let mount = document.querySelector('#v14-profile-password-mount') as HTMLElement | null
        if (!mount) {
          mount = document.createElement('div')
          mount.id = 'v14-profile-password-mount'
          profileCard.insertAdjacentElement('afterend', mount)
        }
        setProfileMount(mount)
      } else {
        setProfileMount(null)
      }
    }

    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true })
    const timer = window.setInterval(sync, 700)
    return () => { observer.disconnect(); window.clearInterval(timer) }
  }, [])

  return (
    <>
      <HodyAppV13 />

      {loginMount && createPortal(
        <LoginPasswordButton onClick={() => setDialog({ open: true })} />,
        loginMount,
      )}

      {profileMount && profileName && createPortal(
        <ProfilePasswordCard name={profileName} onClick={() => setDialog({ open: true, lockedName: profileName })} />,
        profileMount,
      )}

      {dialog.open && <PasswordChangeModal lockedName={dialog.lockedName} onClose={() => setDialog({ open: false })} />}
    </>
  )
}
