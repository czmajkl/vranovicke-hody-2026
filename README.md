# Vranovické hody 2026

Mobilní sociální hra / icebreaker pro Vranovické hody 2026.

> **Aplikace nemá odměňovat používání aplikace. Má odměňovat to, co člověk udělá mimo ni.**

Cílem je nenuceně promíchat skupinu lidí, nabídnout důvod začít konverzaci a potom telefon zase schovat.

## Základní princip

Na hlavní obrazovce se zobrazí člověk ze hry, jeho fotka, krátká věta o sobě a tři náhodné otázky. Uživatel může:

- začít konverzaci,
- přepnout na **Volnou zábavu** a otázky schovat,
- potvrdit **Bavili jsme se**,
- zobrazit **Jiného člověka** bez penalizace.

Otázky se při novém člověku losují znovu. Opakované setkání se stejným člověkem je v pořádku.

## Hlavní části aplikace

- **Domů** – náhodný člověk + tři otázky
- **Lidi** – seznam účastníků a jejich profily
- **Kronika** – především fotografie a vybrané události
- **Hra** – achievementy, body a vedlejší leaderboard
- **Profil** – vlastní profil, pozvánka a režim **Neotravuj**

## Fotografie

Plánovaný tok fotografie:

1. vyfocení / výběr fotografie v telefonu,
2. originál v plném rozlišení uložit do Google Drive archivu,
3. z lokálního originálu vytvořit zmenšenou webovou kopii,
4. webovou kopii uložit do Cloudflare R2,
5. zobrazit ji v aplikaci a Hodové kronice.

Označení dalších lidí na fotografii je nepovinné.

## Předběžný stack

- GitHub – zdrojový kód
- React + TypeScript + Vite – frontend
- Cloudflare Pages – hosting
- Cloudflare Functions / Workers – API
- Cloudflare D1 – aplikační data
- Cloudflare R2 – webové verze fotografií
- Google Drive – archiv originálních fotografií

## Stav projektu

Projekt je ve fázi návrhu a prvního prototypu. Produktová rozhodnutí jsou v [`docs/`](docs/).
