# Datový model

První návrh dat pro Cloudflare D1. Schéma je verzované v `migrations/`.

## Principy

- Jeden uživatel = jeden profil bez e-mailu.
- Přihlášení používá jméno / normalizované uživatelské jméno + heslo.
- Heslo se nikdy neukládá v čitelné podobě. Do D1 patří pouze odvozený hash.
- Session token se klientovi posílá jako bezpečná cookie; do databáze se ukládá pouze jeho hash.
- Interakce mezi stejnou dvojicí jsou opakovatelné. Záměrně na nich není unikátní omezení.
- `is_available = 0` odpovídá režimu **Neotravuj**. Profil zůstává dohledatelný v seznamu lidí, jen se nemá nabízet náhodným výběrem.
- Body jsou vedené přes `score_events`, aby šlo zpětně vysvětlit, odkud vznikly, místo jednoho magického čísla v `users`.
- Fotka se publikuje přes webovou kopii v R2. `drive_file_id` drží odkaz na archivovaný originál v Google Drive.
- Tagování fotek je nepovinné přes `photo_tags`.

## Tabulky

### `users`
Profil, heslový hash, bio, profilová fotka, stav Neotravuj a případný pozývající uživatel.

### `sessions`
Serverové sessions. `token_hash` je unikátní, samotný token patří pouze do klientské cookie.

### `questions`
Banka otázek. Kategorie jsou `light`, `personal`, `deep`, `wildcard`.

### `interactions`
Každé kliknutí **Bavili jsme se** je samostatný záznam. Stejná dvojice se může objevit vícekrát.

### `achievements` + `user_achievements`
Definice odznaků a jejich získání.

### `invites`
QR/link pozvánky s volitelným připsáním bodů až po skutečné registraci.

### `photos` + `photo_tags`
Metadata momentek. R2 drží webovou verzi, Google Drive originál.

### `score_events`
Auditovatelný bodový ledger pro interakce, fotky, pozvánky a výzvy.

## Co se zatím vědomě neřeší

- finální hodnoty bodů,
- konkrétní achievement thresholds,
- Google Drive OAuth/service-account strategie,
- image processing parametry,
- admin rozhraní,
- rate limiting a ochrana proti spamu.

Tyhle věci mají být doplněné až s reálným API, ne vytesané do SQL podle nálady prvního večera.

## Připojení D1

Až bude databáze vytvořená v Cloudflare, přidá se do `wrangler.jsonc` binding `DB` s `database_name` a `database_id`. Potom lze aplikovat migrace přes Wrangler.
