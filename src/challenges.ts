export type PhotoChallenge = {
  id: string
  text: string
}

export const PHOTO_CHALLENGES: PhotoChallenge[] = [
  { id: 'novy-clovek', text: 'Cvakni fotku s někým, koho si dnes potkal poprvé.' },
  { id: 'tri-ksichty', text: 'Dejte sa tři dohromady a udělejte úplně stejný ksicht.' },
  { id: 'nejvetsi-usmev', text: 'Najdi největší úsměv na place a cvakni ho.' },
  { id: 'masle', text: 'Cvakni nejbarevnější mašle nebo detail kroja, co najdeš.' },
  { id: 'muzika', text: 'Vyfoť sa s muzikú nebo aspoň tak, aby byla muzika v záběru.' },
  { id: 'kamaradi', text: 'Cvakni partu, která sa zná už podezřele dlouho.' },
  { id: 'generace', text: 'Dostaň do jedné fotky dvě různé generace.' },
  { id: 'tanecek', text: 'Cvakni někoho přímo při tanci. Rozmazání sa počítá jako umění.' },
  { id: 'pozdni-prichod', text: 'Vyfoť sa s někým, kdo dorazil na hody až po tobě.' },
  { id: 'nejvyssi', text: 'Najdi někoho, kdo je vyšší než ty, a udělejte společnú fotku.' },
  { id: 'stejne-jmeno', text: 'Najdi dva lidi se stejným nebo podobným ménem a cvakni je spolu.' },
  { id: 'cizi-klobouk', text: 'Půjč si na fotku klobúk, věneček nebo jinú hodovú parádu.' },
  { id: 'ctyri-lidi', text: 'Dostaň na jednu fotku aspoň čtyři lidi a žádný nech sa netváří normálně.' },
  { id: 'pripitok', text: 'Cvakni společný přípitek. Klidně aj nealko, nejsme účetní lihovaru.' },
  { id: 'tanecni-mistr', text: 'Vyfoť sa s někým, kdo tvrdí, že umí tancovat. Důkazy netřeba.' },
  { id: 'dve-leve', text: 'Najdi někoho s „Dvě levé v čižmách“ a udělejte vítěznú fotku.' },
  { id: 'krojovy-detail', text: 'Cvakni jeden detail, podle kterého bys poznal hody aj bez cedule.' },
  { id: 'fotobomba', text: 'Udělej slušnú fotobombu do fotky kamarádů. Pak je cvakni už schválně.' },
  { id: 'pred-a-po', text: 'Cvakni partu, která vypadá, že už má za sebú dlouhý večer.' },
  { id: 'nejvetsi-partak', text: 'Vyfoť člověka, který dnes podle tebe nejvíc drží partu pohromadě.' },
  { id: 'ruce', text: 'Dejte aspoň tři ruce doprostřed jak sportovní tým a cvakni to.' },
  { id: 'selfie-retaz', text: 'Udělej selfie s člověkem, se kterým ještě žádnú společnú fotku nemáš.' },
  { id: 'pozadi', text: 'Udělej fotku, na které bude poznat, že ste fakt na vranovských hodech.' },
  { id: 'nahodny-par', text: 'Najdi dva lidi, kteří vedle sebe zrovna náhodně stojí, a udělej z nich slavnostní portrét.' },
]

export const PHOTO_CHALLENGE_ACHIEVEMENT = {
  id: 'hodovy-nezmar',
  name: 'Hodový nezmar',
  description: 'Splnil aspoň polovinu hodových foto výzev.',
  needed: Math.ceil(PHOTO_CHALLENGES.length / 2),
} as const
