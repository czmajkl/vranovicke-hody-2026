# Vizuální zdroje a licence

Tento dokument eviduje externí vizuální zdroje použité nebo studované při tvorbě grafického systému aplikace Vranovické hody 2026.

## Přímo použité knihovny

### Cormorant Garamond

- Balíček: `@fontsource/cormorant-garamond@5.3.0`
- Zdroj: Fontsource / Cormorant Project
- Licence: SIL Open Font License 1.1
- Použití: slavnostní nadpisy, jména a display typografie
- Font je self-hostovaný jako součást výsledného buildu; aplikace není závislá na externím fontovém CDN.

### Lucide

- Balíček: `lucide-react@1.28.0`
- Zdroj: Lucide
- Licence: ISC
- Použití: funkční UI ikony (lidé, foto, kronika, sdílení, profil, navigace atd.)

## Folklorní reference

### Flower pattern inspired by Moravian folklore

- Autor: Ctibor
- Zdroj: OpenClipart / FreeSVG
- OpenClipart ID: 91435
- FreeSVG ID: 184865
- Licence: Public Domain / CC0
- Použití: vizuální reference pro způsob skládání květinových moravských motivů.

Do repozitáře není vložena přímá kopie tohoto SVG. Lokální soubory v `src/assets/folk/` jsou nově nakreslené modulární motivy vytvořené pro tuto aplikaci.

### Historická lidová výšivka

- Zdroj: Wikimedia Commons, historické/public-domain materiály s lidovou výšivkou a moravskými kroji
- Použití: reference pro principy symetrie, rytmu, rostlinných tvarů a barevných kontrastů.

## Lokální assety aplikace

Soubory v `src/assets/folk/` jsou původní SVG vytvořené pro tento projekt:

- `rosette.svg` – vícebarevná hodová rozeta
- `floral-divider.svg` – horizontální květinový pás
- `corner-bouquet.svg` – rohová rostlinná kompozice
- `textile-pattern.svg` – opakovatelný geometricko-květinový vzor

Nejde o odbornou rekonstrukci konkrétního vranovického krojového ornamentu. Vizuální systém je současná grafická interpretace inspirovaná jihomoravskými hody a moravským folklorem.

## Zásada

Pokud se později použije konkrétní fotografie, výšivka, ilustrace nebo jiný cizí asset, musí být před vložením do produkce doplněn sem včetně autora, zdroje a licence.
