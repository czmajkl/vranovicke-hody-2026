const person = {
  name: 'Klára',
  note: 'Když mě nevidíš, jsem asi u muziky.',
  questions: [
    'Jaká věc ti vždycky zlepší náladu?',
    'Co ses za poslední rok naučila sama o sobě?',
    'Jakou naprosto zbytečnou schopnost bys chtěla umět?',
  ],
}

function App() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Vranovické hody 2026</p>
          <h1>Najdi si člověka.</h1>
        </div>
        <button className="status-button" type="button">Som ve hře</button>
      </header>

      <section className="person-card">
        <div className="photo-placeholder" aria-label={`Fotka uživatele ${person.name}`}>
          <span>{person.name.slice(0, 1)}</span>
        </div>

        <div className="person-copy">
          <p className="eyebrow">Teď můžeš zkusit</p>
          <h2>{person.name}</h2>
          <p className="person-note">{person.note}</p>
        </div>

        <div className="questions">
          <p className="section-label">Na co se můžeš zeptat</p>
          {person.questions.map((question, index) => (
            <button className="question" type="button" key={question}>
              <span>{index + 1}</span>
              {question}
            </button>
          ))}
        </div>

        <div className="actions">
          <button className="primary-button" type="button">Bavili jsme se</button>
          <button className="secondary-button" type="button">Volná zábava</button>
          <button className="text-button" type="button">Jiný člověk →</button>
        </div>
      </section>

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
