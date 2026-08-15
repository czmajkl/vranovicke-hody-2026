import { useEffect } from 'react'

const SKIP_COOLDOWN_KEY = 'hody-skip-cooldown-until-v10'

export default function V10CooldownGuard() {
  useEffect(() => {
    const guard = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const button = target?.closest('button') as HTMLButtonElement | null
      if (!button?.textContent?.includes('Hoď někoho jiného')) return
      if (document.querySelector('.screen-home .v2-free-mode')) return

      const until = Number(window.localStorage.getItem(SKIP_COOLDOWN_KEY) ?? '0')
      if (until > Date.now()) {
        event.preventDefault()
        event.stopImmediatePropagation()
        event.stopPropagation()
      }
    }

    window.addEventListener('click', guard, true)
    return () => window.removeEventListener('click', guard, true)
  }, [])

  return null
}
