import { useMemo, useState } from 'react'

type Person = {
  name: string
  note: string
  questions: string[]
}

const people: Person[] = [
  {
    name: 'Klára',
    note: 'Když mě nevidíš, jsem asi u muziky.',
    questions: [
      'Jaká věc ti vždycky zlepší náladu?',
      'Co ses za poslední rok naučila sama o sobě?',
      'Jakou naprosto zbytečnou schopnost bys chtěla umět?',
    ],
  },
  {
    name: 'Petr',
    note: 'Poznáš mě podle toho, že mám pořád něco v ruce.',
    questions: [
      'Co je něco, do čeho ses v poslední době fakt zažral?',
      'Který člověk tě v životě nejvíc ovlivnil?',
      'Kdybys mohl na týden umět jednu novou věc, co by to bylo?',
    ],
  },
  {
    name: 'Anička',
    note: 'Pravděpodobně mě uslyšíš dřív, než mě uvidíš.',
    questions: [
      'Jaký malý moment si z poslední doby fakt pamatuješ?',
      'Co by o tobě většina lidí vůbec netipla?',
      'Kdybys měl vlastní svátek, jak by se slavil?',
    ],
  },
  {
    name: 'Kuba',
    note: 'Když se ztratím, hledej mě tam, kde se něco děje.',
    questions: [
      'Co ti jde překvapivě dobře?',
      'Co bys chtěl, aby o tobě lidi chápali trochu líp?',
      'Která úplně obyčejná věc ti dělá větší radost, než by měla?',
    ],
  },
]

function App() {
  const [personIndex, setPersonIndex] = useState(0)
  const [freeMode, setFreeMode] = useState(false)
  const [interactionDone, setInteractionDone] = useState(false)
  const [interactionCount, setInteractionCount] = useState(0)

  const person = people[personIndex]
  const initials = useMemo(() => person.name.slice(0, 1).toUpperCase(), [person.name])

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
    <main className="app-shell" id="domu">
      <header className="topbar">
        <div>
          <p className="eyebrow">Vranovické hody · 2026</p>
          <h1>Dej se do řeči.</h1>
        </div>
        <button className="status-button" type="button">Som ve hře</button>
      </header>

      <section className="person-card">
        <div className="ornament-strip" aria-hidden="true">
          <span>✦</span><span>❀</span><span>✦</span><span>❀</span><span>✦</span>
        </div>

        <div className="photo-placeholder" aria-label={`Fotka uživatele ${person.name}`}>
          <span>{initials}</span>
          <small>profilová fotka</small>
        </div>

        <div className="person-copy">
          <p className="eyebrow">Teď ti padl</p>
          <h2>{person.name}</h2>
          <p className="person-note">{person.note}</p>
        </div>

        {!freeMode ? (
          <div className="questions">
            <p className="section-label">Na co se můžeš zeptat</p>
            {person.questions.map((question, index) => (
              <div className="question" key={question}>
                <span>{index + 1}</span>
                <p>{question}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="free-mode">
            <p className="free-mode-kicker">Volná zábava</p>
            <p className="free-mode-copy">Tak už si povídejte. Telefon může zpátky do kapsy.</p>
          </div>
        )}

        <div className="actions">
          <button
            className={`primary-button${interactionDone ? ' success' : ''}`}
            type="button"
            onClick={confirmInteraction}
          >
            {interactionDone ? 'Bavili jsme se ✓' : 'Bavili jsme se'}
          </button>

          {!freeMode && (
            <button className="secondary-button" type="button" onClick={() => setFreeMode(true)}>
              Volná zábava
            </button>
          )}

          <button className="text-button" type="button" onClick={showAnotherPerson}>
            Jiný člověk →
          </button>
        </div>
      </section>

      <aside className="tiny-stat" aria-label="Testovací statistika">
        <span>{interactionCount}</span>
        <p>testovacích interakcí v tomhle zařízení</p>
      </aside>

      <nav className="bottom-nav" aria-label="Hlavní navigace">
        <a className="active" href="#domu">Domů</a>
        <a href="#lidi">Lidi</a>
        <a href="#kronika">Kronika</a>
        <a href="#hra">Hra</a>
        <a href="#profil">Profil</a>
      </nav>
    </main>
  )
}

export default App
