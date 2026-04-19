# Konfiguracja Google OAuth — ADKokna

## TL;DR — natychmiastowe rozwiązanie błędu 403

Dodaj `oknaminskmazowiecki@gmail.com` jako Test User w Google Cloud Console.  
Nie wymaga zmian w kodzie ani weryfikacji Google. Zajmuje 2 minuty.

---

## Analiza konfiguracji w repo

### Gdzie jest config OAuth

Aplikacja **nie** używa Convex Auth / `@auth/core` dla Google.  
Auth użytkownika = Clerk.  
Google OAuth = własna implementacja HTTP actions w Convex:

| Plik | Rola |
|------|------|
| `convex/gmailAuth.ts` | OAuth flow dla Gmail API |
| `convex/googleDriveAuth.ts` | OAuth flow dla Google Drive API |
| `convex/http.ts` | Routing HTTP — rejestruje endpointy |

Zmienne środowiskowe (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) są ustawione **w Convex Dashboard**, nie w `.env.local`.

### Żądane scope'y

| API | Scope | Kategoria Google |
|-----|-------|-----------------|
| Gmail | `https://mail.google.com/` | **Restricted** (najwyższy poziom) |
| Google Drive | `https://www.googleapis.com/auth/drive` | **Restricted** |

Scope `https://mail.google.com/` daje pełny dostęp do Gmaila (czytanie, wysyłanie, usuwanie).  
To scope restricted — najbardziej restrykcyjna kategoria Google.

### Redirect URI używane przez aplikację

```
https://fearless-firefly-85.eu-west-1.convex.site/api/gmail/callback
https://fearless-firefly-85.eu-west-1.convex.site/api/google-drive/callback
```

Obie muszą być wpisane w Google Cloud Console → Credentials → OAuth 2.0 Client ID → Authorized redirect URIs.

### Parametry OAuth URL — czy refresh token będzie działać?

**Tak, kod jest poprawny.** Oba flow mają:
- `access_type: "offline"` ✅ — Google wyda refresh token
- `prompt: "consent"` ✅ — refresh token zwracany przy każdym logowaniu, nie tylko pierwszym

Bez tych parametrów refresh token przychodziłby tylko raz i po wygaśnięciu access tokenu (1 h) aplikacja przestałaby czytać maile. Tu nie ma problemu.

### Drobna niespójność między plikami

`gmailAuth.ts` buduje redirect URI dynamicznie z żądania HTTP:
```ts
const redirectUri = `${url.protocol}//${url.host}/api/gmail/callback`;
```

`googleDriveAuth.ts` używa zmiennej `CONVEX_SITE_URL`:
```ts
const redirectUri = `${siteUrl}/api/google-drive/callback`;
```

W produkcji obie dają ten sam URL, ale **upewnij się, że `CONVEX_SITE_URL` jest ustawione w Convex Dashboard** (wartość: `https://fearless-firefly-85.eu-west-1.convex.site`), bo bez tego Drive OAuth zwróci 500.

---

## Instrukcja krok po kroku — Google Cloud Console

### Krok 1 — Znajdź projekt GCP

1. Wejdź na https://console.cloud.google.com/
2. Na górze kliknij selektor projektu
3. Szukaj projektu powiązanego z Twoim `GOOGLE_CLIENT_ID`  
   _(Client ID możesz odczytać w Convex Dashboard → Settings → Environment Variables)_
4. Właścicielem projektu jest konto Google, którym zalogowałeś się tworząc projekt — prawdopodobnie `wuzapora@gmail.com` lub konto firmowe

### Krok 2 — Dodaj Test Users (natychmiastowe rozwiązanie)

Ścieżka: **APIs & Services → OAuth consent screen → Test users**

1. Kliknij **+ ADD USERS**
2. Wpisz adres: `oknaminskmazowiecki@gmail.com`
3. Kliknij **ADD**
4. Kliknij **SAVE**

Po dodaniu konto może się logować od razu — bez żadnych zmian w kodzie ani deploymentu.

**Limit test users: 100 kont.** Dla aplikacji wewnętrznej (tylko Ty i kilka kont firmowych) to wystarczy na zawsze.

### Krok 3 — Sprawdź Authorized Redirect URIs

Ścieżka: **APIs & Services → Credentials → [Twój OAuth 2.0 Client ID]**

W sekcji **Authorized redirect URIs** muszą być obie:
```
https://fearless-firefly-85.eu-west-1.convex.site/api/gmail/callback
https://fearless-firefly-85.eu-west-1.convex.site/api/google-drive/callback
```

Jeśli którejś brakuje — dodaj i kliknij **SAVE**.

---

## Sensitive vs Restricted scopes — co to znaczy dla publikacji

### Klasyfikacja scope'ów Google

| Kategoria | Przykłady | Weryfikacja do produkcji |
|-----------|-----------|--------------------------|
| Non-sensitive | `email`, `profile`, `openid` | Nie wymagana |
| Sensitive | `gmail.readonly`, `drive.readonly` | Wymagana (uproszczona) |
| **Restricted** | `https://mail.google.com/`, `drive` (full) | Wymagana + audyt bezpieczeństwa |

Twoja aplikacja używa **restricted scopes** dla obu API.

### Kiedy wymagana jest weryfikacja Google

| Sytuacja | Wymagana weryfikacja? |
|----------|-----------------------|
| Testing mode, dowolni użytkownicy z listy Test Users | ❌ Nie |
| In production, non-sensitive scopes | ❌ Nie |
| In production, sensitive scopes | ✅ Tak (formularz + recenzja) |
| In production, restricted scopes | ✅ Tak + niezależny audyt bezpieczeństwa (CASA Tier 2) |

### Ważna uwaga o "Internal" vs "External"

Jeśli na OAuth consent screen typ aplikacji to **Internal** (dostępne tylko dla Google Workspace):
- Brak limitu 100 test users
- Brak wymagań weryfikacji nawet dla restricted scopes
- Wymaga Google Workspace (płatne)

Jeśli typ to **External** (co jest prawdopodobne przy `@gmail.com`):
- Limit 100 test users w trybie Testing
- Restricted scopes wymagają weryfikacji do publikacji

---

## Jak przejść z Testing → In production (bezpiecznie)

### Opcja A — Zostań w Testing (zalecane dla aplikacji wewnętrznej)

Jeśli aplikacja jest używana tylko przez Ciebie i kilka kont firmowych:
- Dodaj wszystkie konta jako Test Users (do 100)
- Nigdy nie publikuj — zostań w Testing na zawsze
- Zero kosztów, zero weryfikacji, zero audytów

### Opcja B — Przejdź do In production (restricted scopes = długi proces)

Tylko jeśli potrzebujesz dostępu dla niezdefiniowanych z góry użytkowników.

1. **Zmień scope na mniej restrykcyjny** (jeśli możliwe):
   - `https://mail.google.com/` → `https://www.googleapis.com/auth/gmail.modify` (nadal restricted)
   - Lub `gmail.readonly` (sensitive, łatwiejsza weryfikacja) — jeśli nie wysyłasz maili
   
2. **Wypełnij OAuth consent screen** w całości:
   - Nazwa aplikacji, logo, strona główna, strona polityki prywatności, kontakt
   
3. **Prześlij do weryfikacji** (Google Verification):
   - Dla restricted scopes: Google wymaga **niezależnego audytu bezpieczeństwa** (CASA Tier 2 przez firmy jak Leviathan Security, Bishop Fox)
   - Koszt audytu: ~3000–8000 USD
   - Czas: 4–8 tygodni

**Dla aplikacji wewnętrznej ADKokna Opcja A jest zdecydowanie właściwa.**

---

## Convex i wersje pakietów

- `convex: ^1.35.1` — aktualna wersja, brak problemów
- Projekt **nie używa** `@auth/core` ani `convex/auth` — używa Clerk do autentykacji użytkowników
- Google OAuth to własny kod (HTTP actions), nie biblioteka — nie ma co aktualizować

---

## Podsumowanie działań

| Priorytet | Akcja | Czas |
|-----------|-------|------|
| 🔴 Teraz | Dodaj `oknaminskmazowiecki@gmail.com` do Test Users | 2 min |
| 🟡 Sprawdź | Czy oba redirect URI są w Cloud Console | 2 min |
| 🟡 Sprawdź | Czy `CONVEX_SITE_URL` jest ustawione w Convex Dashboard | 1 min |
| 🟢 Opcjonalnie | Rozważ zmianę scope Gmail na `gmail.readonly` jeśli nie piszesz maili | — |
