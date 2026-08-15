import { useEffect, useState } from 'react'
import { Languages } from 'lucide-react'
import HodyAppV10 from './HodyAppV10'
import questionsCs from './data/questions.json'
import questionsEn from './data/questions.en.json'
import spicyCs from './data/spicy-questions.json'
import spicyEn from './data/spicy-questions.en.json'
import extraCs from './data/extra-spicy-questions.json'
import extraEn from './data/extra-spicy-questions.en.json'
import challengesCs from './data/photo-challenges.json'
import challengesEn from './data/photo-challenges.en.json'
import './hody-v11.css'

type Language = 'cs' | 'en'
type TextItem = { id: string; text: string }

const LANGUAGE_KEY = 'hody-language-v1'

function initialLanguage(): Language {
  const saved = window.localStorage.getItem(LANGUAGE_KEY)
  if (saved === 'cs' || saved === 'en') return saved
  const browser = (navigator.languages?.[0] || navigator.language || '').toLowerCase()
  return browser.startsWith('cs') || browser.startsWith('sk') ? 'cs' : 'en'
}

function pairText(cs: TextItem[], en: TextItem[]) {
  const enById = new Map(en.map((item) => [item.id, item.text]))
  return cs.flatMap((item) => {
    const translated = enById.get(item.id)
    return translated ? [[item.text, translated] as const] : []
  })
}

const CONTENT_TRANSLATIONS = new Map<string, string>([
  ...pairText(questionsCs.questions as TextItem[], questionsEn.questions as TextItem[]),
  ...pairText(spicyCs.spicy_questions as TextItem[], spicyEn.spicy_questions as TextItem[]),
  ...pairText(extraCs.extra_spicy_questions as TextItem[], extraEn.extra_spicy_questions as TextItem[]),
  ...pairText(challengesCs.photo_challenges as TextItem[], challengesEn.photo_challenges as TextItem[]),
])

const UI: Record<string, string> = {
  'Vitaj na hodech!': 'Welcome to Vranovice Festival!',
  'Najdi člověka, odklikni otázku, pobav sa a telefon zase strč do kapsy.': 'Find someone, pick a question, have a real conversation, then put the phone away again.',
  'Založit sa do hry': 'Join the game',
  'Už su tu': 'I already joined',
  'Mobil je enom tahák. Hody sa furt odehrávajú mezi lidma.': 'The app is only a prompt. The festival still happens between real people.',
  'Zpátky na náves': 'Back',
  'Nový kus do party': 'New to the group',
  'Hoď sa mezi nás.': 'Join us.',
  'Méno, fotka a tři zásadní diagnózy: kdo seš, co provádíš na parketu a co ti případně nalét.': 'Name, photo, and the essentials: who you are, how you dance, and what people may offer you to drink.',
  'Jak ti máme říkat': 'Your name',
  'Heslo · minimálně 4 znaky': 'Password · at least 4 characters',
  'Co seš zač': 'Gender',
  'Jak seš na tom s tancem': 'How do you dance?',
  'Co ti može kdo nalét': 'What can people offer you?',
  'Vyber sa': 'Choose',
  'Přiznaj barvu': 'Be honest',
  'Vyber pitný režim': 'Choose a drink preference',
  'Šohaj': 'Man',
  'Děvčica': 'Woman',
  'Mazák od muziky': 'Confident dancer',
  'Dvě levé v čižmách': 'Two left feet',
  'Tož to nějak odskáču': "I'll improvise",
  'Slivovicu, jak sa sluší': 'Slivovica',
  'Zelenú nebo něco hodnějšího': 'Green liqueur or something lighter',
  'Fernet či rum, hlavně ať to kope': 'Fernet or rum',
  'Co naleješ, to vypiju': "I'll drink whatever you pour",
  'Nechcu, díky': 'No alcohol, thanks',
  'Dobrá. Na panáka tě přes appku nikdo tahat nebude.': 'Got it. Nobody will be able to send you a shot through the app.',
  'Co o tobě vědět': 'About you',
  'nemusíš nic': 'optional',
  'Fotka sedí': 'Photo ready',
  'Nahraj svoju fotku': 'Add your photo',
  'Štelujem ju…': 'Preparing photo…',
  'povinné · foťák nebo galerie': 'required · camera or gallery',
  'Založit profil a vlézt do placu': 'Create profile and join',
  'Zakládám…': 'Creating profile…',
  'Dom': 'Home',
  'Lidi': 'People',
  'Drby': 'Feed',
  'Hra': 'Game',
  'Já': 'Me',
  'co seš zač': 'Gender',
  'jak sa vrtíš': 'Dancing',
  'co ti nalét': 'Drinks',
  'Zatím tají': 'Not set',
  'Taneční pověst neznámá': 'Dance level not set',
  'Pitný režim nevyplněný': 'Drink preference not set',
  'Tají': 'Not set',
  'Neznámé': 'Unknown',
  'Nevyplněné': 'Not set',
  'Som ve hře': 'Available',
  'Neotravuj': 'Do not suggest me',
  'Tuhle sme dali': 'We talked about this',
  'Tož jo': 'Done',
  'Tož ju': 'Done',
  'Jinú': 'Different one',
  '↻ Jinú otázku': '↻ Different question',
  'Bavili sme sa': 'We talked',
  'Volná zábava.': 'Free conversation.',
  'Otázky sú odpracované. Telefon už može zpátky do kapsy.': 'Questions done. The phone can go back into your pocket.',
  'Cvaknút si fotku': 'Take a photo',
  'Cvaknút fotku': 'Take a photo',
  'Hoď někoho jiného': 'Another person',
  'Pozvat na panáka': 'Buy a shot',
  'Co mu nalét?': 'What should it be?',
  'Panák sa neposílá rovnou do žaludka.': 'A shot is not accepted automatically.',
  'Slivovica': 'Slivovica',
  'Zelená': 'Green liqueur',
  'Vodka': 'Vodka',
  'Rum': 'Rum',
  'Fernet': 'Fernet',
  'Tequila': 'Tequila',
  'Jäger': 'Jägermeister',
  'Borovička': 'Juniper spirit',
  'Becherovka': 'Becherovka',
  'něco hodnějšího': 'Something lighter',
  'Kdo je na place': "Who's here",
  'Naši lidi': 'People',
  'Tady sa nehrajú otázky. Tady sa hlavně zjišťuje, koho vytáhnút na panáka.': 'Browse everyone here, open a profile, or invite someone for a shot.',
  'na place': 'available',
  'Nic na sebe zatím nepráskl.': 'No bio yet.',
  'Člověk z placu': 'Festival guest',
  'Hodové drby': 'Festival feed',
  'Co sa tu semlelo': 'What happened here',
  'Kdo došel, kdo sa bavil, kdo koho tahá na panáka a co sa podařilo cvaknút.': 'New arrivals, conversations, shots, and photos from the festival.',
  'Všecky hovory': 'All conversations',
  'Kdo s kým a co odklikl': 'Who talked to whom and which questions they covered',
  'Zatím tu fučí větr.': 'Nothing here yet.',
  'Až sa něco semele, Drby to prásknú.': 'Once something happens, it will show up here.',
  'Nová tvář v placu. Tož si ju zapamatujte.': 'A new face at the festival. Go say hello.',
  'Cvakli momentku a nechali ju mezi Drbama.': 'They took a photo and added it to the festival feed.',
  'Otázky sú ve výpisu hovorů, ať z Drbů není účetní kniha.': 'The questions are in the conversation log so the feed stays readable.',
  'Kontrolní lejstro': 'Conversation log',
  'Enom verifikace. Kdo, s kým, kdy a co odklikl před „Bavili sme sa“.': 'A simple record of who talked, when, and which questions they confirmed.',
  'Zpátky do Drbů': 'Back to the feed',
  'Zatím ani slovo.': 'No conversations yet.',
  'Hra': 'Game',
  'Body, panáky a pověst': 'Points, shots, and reputation',
  'Tady už appka počítá. Na place máš ale furt mluvit s lidma, ne hypnotizovat tabulku.': 'This is where the app keeps score. The actual game still happens with people, not with the leaderboard.',
  'Bodový šenk': 'Points',
  'Kdo fakt hraje': "Who's actually playing",
  'První pokec +5, opakovaný +2 a každá potvrzená otázka +1.': 'First conversation +5, repeat conversation +2, each confirmed question +1.',
  'Nejvíc přijatých panáků': 'Most accepted shots',
  'Nejštědřejší duše': 'Most generous',
  'Zatím nula. Hostinec by zaplakal.': 'Nobody yet.',
  'Šenkovní čest': 'Generosity board',
  'Panák je panák. Flaša vína pro stůl je flaša vína. Obojí sa počítá, ale ukazujeme to zvlášť.': 'Shots and bottles of wine both count, but they are shown separately.',
  'Dondu pro víno na stůl': 'I brought wine for the table',
  'Zapisuju flašu…': 'Logging bottle…',
  'Zatím nikdo nic. Stůl je podezřele suchý.': 'Nothing yet. The table is suspiciously dry.',
  'Co mosíš donést': 'What you still owe',
  'Panákové dluhy': 'Shots I owe',
  'Přijaté panáky už nejsú notifikace. Teď sú to závazky mezi tebú a šenkem.': 'Once a shot is accepted, it becomes something you actually owe the recipient.',
  'Doneseno': 'Delivered',
  'Zapisuju…': 'Saving…',
  'Nic nedlužíš.': 'You owe no shots.',
  'Vzácný stav. Užívej, než někoho pozveš.': 'A rare condition. Enjoy it while it lasts.',
  'Panák tě našel': 'A shot found you',
  'mosíš rozhodnút': 'you need to decide',
  'Beru ho': 'Accept',
  'Přehodit': 'Forward',
  'Tady sa neschovává do Hry. Buď ho vezmeš a původní dárce ho pak uvidí mezi dluhama, nebo ho pošleš dál.': 'Accept it and the original giver will owe it to you, or forward it to someone else.',
  'Hodová foto výzva': 'Festival photo challenge',
  'Hodový nezmar': 'Festival Legend',
  'Cvakni to, než sa přehodí': 'Take it before the challenge changes',
  'Odznak máš. Teď už fotíš pro čest a Drby.': 'You earned the badge. Everything else is for glory and the feed.',
  'Poslední výzva do odznaku.': 'One last challenge for the badge.',
  'Tuhle máš splněnú': 'Challenge completed',
  'Ukládám důkaz…': 'Saving proof…',
  'Cvaknút výzvu': 'Take challenge photo',
  'Tvoje místo': 'Your profile',
  'Ty sám': 'You',
  'Fotka, taneční pověst, pitný režim, stav a verbovací QR.': 'Your photo, dancing, drink preferences, availability, and invite QR.',
  'Som na hodech': 'At the festival',
  'O sobě zatím nic nepráskls.': 'No bio yet.',
  'Poštelovat profil': 'Edit profile',
  'Nech to tak': 'Cancel editing',
  'Pošteluj údaje': 'Edit details',
  'Uložit to': 'Save changes',
  'Náhodně tě teď ostatním neházíme.': 'You will not appear in random suggestions.',
  'Možeš padnút komukoli na hlavní obrazovce.': 'You can appear in random suggestions.',
  'Dotáhni dalšího': 'Invite someone',
  'Tvoje verbovací cedula': 'Your invite QR',
  'Kdo načte tenhle QR, přistane na registraci s tvým ménem v odkazu. Když sa přidá, Drby tě prásknú.': 'Anyone who scans this QR opens registration through your invitation. If they join, it will appear in the feed.',
  'Poslat pozvánku': 'Share invitation',
  'Tvoje stopa': 'Your photos',
  'Momentky': 'Moments',
  'Zatím žádná momentka.': 'No photos yet.',
  'To je na hodech stav dočasný.': 'That probably will not last long.',
  'Odhlásit sa a jít na vzduch': 'Sign out',
  'Jak to máš na hodech se seznamováním': 'Dating preference',
  'Seznamovací stav': 'Dating preference',
  'Tož třeba přeskočí jiskra': 'Open to a spark',
  'Co sa má stát, to sa stane': 'Let fate decide',
  'Do trojice všeho dobrého': 'Looking for a woman',
  'Enom na hody, ne na námluvy': 'Here for the festival, not dating',
  'Srdce už mám zadané': 'Already taken',
  'Jsi otevřený/á seznamování. Když si preference sednú na obou stranách, přihodíme spicy otázku.': 'You are open to meeting someone. If both preferences match, you may get a spicy question.',
  'Nic nehrotíš, ale dveře nezavíráš. Když si sednete, spicy otázka može padnút.': 'No pressure, but you are open to whatever happens. A compatible match may get a spicy question.',
  'Tahle volba hledá děvčicu. U šohaja aj děvčice. Druhá strana ale mosí být taky otevřená.': 'This preference looks for a woman, whether you are a man or a woman. The other person's preference must also match.',
  'Pokec, tanec a sranda ano. Seznamovací otázky necháme být.': 'Conversation, dancing, and fun are welcome. Dating questions stay off.',
  'Vztahový radar je vypnutý. Normální otázky jedú dál.': 'Dating questions are off. Regular questions still work normally.',
  'Preference si sedly, tož přibyla jedna odvážnější.': 'Your preferences match, so you get one spicier question.',
  'SPICY': 'SPICY',
  'EXTRA SPICY': 'EXTRA SPICY',
  'Další spicy level': 'Next spicy level',
  'Stejná dvojica už dala spicy dvakrát. Tož bez alibi.': 'You two have already completed spicy questions twice. Time for the next level.',
  'Foto úkol na túto minutu': 'Photo challenge for this minute',
  'Toto máš z krku': 'Completed',
  'Cvakni to, než sa to přehodí': 'Take it before it changes',
  'Splněno, počkaj na další': 'Done, wait for the next one',
  'Zapsané. Další fotoúkol sa ukáže po minutě.': 'Saved. A new photo challenge will appear after a minute.',
  'Hotovo. Hodový nezmar je tvůj.': 'Done. You earned the Festival Legend badge.',
  'Nejsi přihlášený.': 'You are not signed in.',
  'Tohle nevypadá jak fotka.': 'This does not look like an image.',
  'Fotku sa nepodařilo otevřít.': 'The photo could not be opened.',
  'Prohlížeč odmítl nachystat fotku.': 'The browser could not prepare the photo.',
  'Fotku sa nepodařilo rozumně zmenšit. Zkus ju cvaknút znova.': 'The photo could not be resized safely. Please take it again.',
  'Bez fotky tě do placu nepustíme. Nahraj ju znova.': 'A profile photo is required. Please upload it again.',
  'Méno mosí mět 2 až 40 znaků.': 'Your name must contain 2 to 40 characters.',
  'Heslo mosí mět aspoň 4 znaky.': 'Your password must contain at least 4 characters.',
  'Takové méno už tu máme. Vymysli si druhé.': 'That name is already in use. Please choose another one.',
  'Méno nebo heslo nesedí.': 'Name or password is incorrect.',
  'Vyber, jestli seš šohaj nebo děvčica.': 'Choose your gender.',
  'Přiznaj, jak seš na tom s tancem.': 'Choose your dance level.',
  'Vyber, co ti može kdo nabídnút.': 'Choose your drink preference.',
  'Tenhle člověk má „Nechcu, díky“. Panáka mu neposílej.': 'This person does not want alcohol. Please do not send them a shot.',
  'Sobě panáka přes appku kupovat nemusíš.': 'You do not need to buy yourself a shot through the app.',
  'Takový panák v našem šenku nevedeme.': 'That shot is not available.',
  'Ten člověk sa někam ztratil.': 'That person is no longer available.',
  'Sám se sebú sa do Drbů fakt nepočítáš.': 'A conversation with yourself does not count.',
  'Napřed odklikni aspoň jednu otázku.': 'Confirm at least one question first.',
  'Toho člověka už tu nevidím.': 'That person is no longer here.'
}

const PLACEHOLDERS: Record<string, string> = {
  'Třeba Martin': 'For example, Martin',
  '1234 klidně stačí': 'At least 4 characters',
  'Když mě nenajdeš, su asi...': "If you can't find me, I'm probably...",
  'Koho hledáš?': 'Search people'
}

function normalize(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function translateDynamic(source: string): string | null {
  let match: RegExpMatchArray | null
  if ((match = source.match(/^Do placu tě dotáhl (.+)\.$/))) return `${match[1]} invited you to join.`
  if ((match = source.match(/^(.+) dorazil na hody!$/))) return `${match[1]} joined the festival!`
  if ((match = source.match(/^(.+) dotáhl (.+) na hody!$/))) return `${match[1]} invited ${match[2]} to the festival!`
  if ((match = source.match(/^(.+) pozval (.+) na panáka\.$/))) return `${match[1]} invited ${match[2]} for a shot.`
  if ((match = source.match(/^(.+) přehodil panáka na (.+)\.$/))) return `${match[1]} forwarded a shot to ${match[2]}.`
  if ((match = source.match(/^(.+) sa bavil s (.+)\.$/))) return `${match[1]} talked with ${match[2]}.`
  if ((match = source.match(/^Původně ho kupoval (.+)\. Panáková štafeta pokračuje\.$/))) return `Originally bought by ${match[1]}. The shot relay continues.`
  if ((match = source.match(/^(.+) tě zve na panáka$/))) return `${match[1]} invited you for a shot`
  if ((match = source.match(/^(.+) ti přehodil\/a panáka$/))) return `${match[1]} forwarded you a shot`
  if ((match = source.match(/^Původně ho kupuje (.+)\.$/))) return `Originally bought by ${match[1]}.`
  if ((match = source.match(/^Další los až za (.+)\.$/))) return `Next person in ${match[1]}.`
  if ((match = source.match(/^Dalšího člověka možeš hodit za (.+)\. Napřed chvilu vydrž u tohohle\.$/))) return `You can switch to another person in ${match[1]}. Stay with this conversation for a moment.`
  if ((match = source.match(/^(\d+)\/(\d+) do odznaku$/))) return `${match[1]}/${match[2]} toward the badge`
  if ((match = source.match(/^Ještě (\d+) různých výzev\.$/))) return `${match[1]} different challenges left.`
  if ((match = source.match(/^Ještě (\d+) fotek do odznaku „Hodový nezmar“\.$/))) return `${match[1]} photos left to earn the Festival Legend badge.`
  if ((match = source.match(/^1 z (\d+)$/))) return `1 of ${match[1]}`
  if ((match = source.match(/^Server vrátil chybu (\d+)\.$/))) return `Server returned error ${match[1]}.`
  if ((match = source.match(/^Archiv originálu vrátil chybu (\d+)\.$/))) return `Original photo archive returned error ${match[1]}.`
  if ((match = source.match(/^Fotka (.+)$/))) return `Photo of ${match[1]}`
  if ((match = source.match(/^Profil (.+)$/))) return `${match[1]}'s profile`
  if ((match = source.match(/^(.+) ide na panáka$/))) return `A shot for ${match[1]}`
  if ((match = source.match(/^Pozvat na (.+)$/))) return `Send ${match[1]}`
  if ((match = source.match(/^(.+) je v šenku\..*$/))) return `${match[1]} sent. The recipient will get a notification and can accept or forward it.`
  if ((match = source.match(/^Panák od (.+) přijatý\..*$/))) return `Shot from ${match[1]} accepted.`
  if ((match = source.match(/^Panák přehozený na (.+)\..*$/))) return `Shot forwarded to ${match[1]}.`
  if ((match = source.match(/^Cvaknuté\. Fotka už visí mezi Drbama\.$/))) return 'Photo saved to the festival feed.'
  return null
}

function translate(source: string) {
  return CONTENT_TRANSLATIONS.get(source) ?? UI[source] ?? translateDynamic(source)
}

function directText(element: Element) {
  return normalize(Array.from(element.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent ?? '')
    .join(' '))
}

function translateElement(element: HTMLElement) {
  if (element.closest('.v11-language-toggle')) return

  if (element instanceof HTMLOptionElement) {
    if (element.dataset.v11Done === '1') return
    const source = normalize(element.textContent ?? '')
    const translated = translate(source)
    if (translated) element.textContent = translated
    element.dataset.v11Done = '1'
    return
  }

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    const placeholder = element.getAttribute('placeholder')
    if (placeholder && !element.dataset.v11Placeholder) {
      const translated = PLACEHOLDERS[normalize(placeholder)] ?? translate(normalize(placeholder))
      if (translated) {
        element.dataset.v11Placeholder = placeholder
        element.setAttribute('placeholder', translated)
      }
    }
  }

  for (const attribute of ['aria-label', 'alt', 'title'] as const) {
    const current = element.getAttribute(attribute)
    if (!current || element.dataset[`v11${attribute.replace(/[^a-z]/g, '')}` as keyof DOMStringMap]) continue
    const translated = translate(normalize(current))
    if (translated) {
      element.dataset[`v11${attribute.replace(/[^a-z]/g, '')}` as keyof DOMStringMap] = current
      element.setAttribute(attribute, translated)
    }
  }

  const hasComplexChildren = Array.from(element.children).some((child) => child.tagName.toLowerCase() !== 'svg')
  if (hasComplexChildren) return

  const source = directText(element)
  if (!source) return
  const translated = translate(source)
  if (!translated || translated === source) return

  element.dataset.v11Source = source
  element.dataset.v11En = translated
  element.classList.add('v11-translatable')
  const computed = window.getComputedStyle(element)
  element.style.setProperty('--v11-font-size', computed.fontSize)
  element.style.setProperty('--v11-line-height', computed.lineHeight)
}

function translatePage() {
  document.documentElement.lang = 'en'
  document.documentElement.classList.add('v11-en')
  document.title = 'Vranovice Festival 2026'
  document.querySelectorAll<HTMLElement>('body *').forEach(translateElement)
}

export default function HodyAppV11() {
  const [language] = useState<Language>(initialLanguage)

  useEffect(() => {
    if (language !== 'en') {
      document.documentElement.lang = 'cs'
      document.documentElement.classList.remove('v11-en')
      return
    }

    let frame = 0
    const schedule = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(translatePage)
    }

    translatePage()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => {
      observer.disconnect()
      window.cancelAnimationFrame(frame)
    }
  }, [language])

  const switchLanguage = () => {
    window.localStorage.setItem(LANGUAGE_KEY, language === 'cs' ? 'en' : 'cs')
    window.location.reload()
  }

  return (
    <>
      <HodyAppV10 />
      <button className="v11-language-toggle" type="button" onClick={switchLanguage} aria-label={language === 'cs' ? 'Switch to English' : 'Přepnout do češtiny'}>
        <Languages size={16} />
        <strong>{language === 'cs' ? 'EN' : 'CZ'}</strong>
      </button>
    </>
  )
}
