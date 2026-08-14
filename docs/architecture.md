# Architektura

## Cíl

Jednoduchá mobilní webová aplikace bez zbytečné infrastruktury.

## Předběžné komponenty

### Frontend

- React
- TypeScript
- Vite
- deployment přes Cloudflare Pages

### Backend

- Cloudflare Pages Functions / Workers
- Cloudflare D1 pro data
- Cloudflare R2 pro zmenšené fotografie používané ve webu
- Google Drive pro archiv originálních fotografií

## Fotografie

Navržený tok:

1. uživatel vyfotí nebo vybere fotografii,
2. originální soubor se odešle do Google Drive archivu,
3. po úspěšném uložení se ze stejného lokálního souboru vytvoří zmenšená webová verze,
4. webová verze se odešle do R2,
5. metadata se uloží do D1,
6. fotografie se zobrazí v Kronice.

Pokud se originál nepodaří archivovat, fotografie se nemá publikovat jako jediná zmenšená kopie.

## Předběžné datové entity

- users
- sessions
- interactions
- questions
- photos
- photo_tags
- achievements
- user_achievements
- invites

Datový model ještě není uzamčený.

## Náhodný výběr člověka

Základní pravidla:

- nikdy nenabízet uživatele samotného,
- vynechat lidi v režimu Neotravuj,
- neopakovat okamžitě právě přeskočeného člověka,
- lehce preferovat lidi s menším počtem interakcí s aktuálním uživatelem,
- opakované interakce se stejnou osobou jsou povolené.

## Bezpečnost

- hesla nikdy neukládat v plaintextu,
- citlivé klíče pouze v Cloudflare Secrets,
- Google Drive autorizaci držet na backendu,
- frontend nesmí obsahovat privilegované přístupové údaje.
