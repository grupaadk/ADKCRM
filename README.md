# ADK/ALCO CRM

System zarzadzania klientami i dokumentami dla ADK Okna.

Stack: **Next.js 16** + **Clerk** + **Convex** + **Google Drive API** + **Jotform** + **Trello**

---

## Szybki start

```bash
git clone <repo-url>
cd adk
npm install
cp .env.local.example .env.local   # uzupelnij wartosci
npm run dev
```

Aplikacja uruchomi sie na `http://localhost:3000`.

---

## Komendy

| Komenda                | Opis                          |
| ---------------------- | ----------------------------- |
| `npm run dev`          | Frontend + backend rownolegle |
| `npm run dev:frontend` | Tylko Next.js                 |
| `npm run dev:backend`  | Tylko Convex dev sync         |
| `npm run build`        | Production build Next.js      |
| `npm run start`        | Uruchom production server     |
| `npm run lint`         | ESLint                        |
| `npm test`             | Testy (vitest, edge-runtime)  |
| `npm run test:watch`   | Testy w trybie watch          |

---

## Zmienne srodowiskowe

### Plik `.env.local` (frontend + Convex CLI)

```bash
# Convex
CONVEX_DEPLOYMENT=dev:your-deployment-name
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://your-deployment.convex.site

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_FRONTEND_API_URL=https://your-clerk-instance.clerk.accounts.dev
```

### Convex Dashboard (zmienne serwerowe)

Ustaw przez UI dashboardu Convex albo komendami:

```bash
# Wymagane
npx convex env set ENCRYPTION_KEY "$(openssl rand -hex 32)"
npx convex env set CLERK_FRONTEND_API_URL "https://your-clerk-instance.clerk.accounts.dev"

# Google Drive (wymagane do integracji z Drive)
npx convex env set GOOGLE_CLIENT_ID "your-google-client-id"
npx convex env set GOOGLE_CLIENT_SECRET "your-google-client-secret"
npx convex env set APP_URL "http://localhost:3000"

# Jotform (opcjonalne - mozna tez ustawic z panelu admin)
npx convex env set JOTFORM_WEBHOOK_SECRET "dowolny-sekret"
npx convex env set JOTFORM_API_KEY "your-jotform-api-key"
npx convex env set JOTFORM_FORM_ID "your-form-id"

# Trello (opcjonalne - mozna tez ustawic z panelu admin)
npx convex env set TRELLO_API_KEY "your-trello-api-key"
npx convex env set TRELLO_API_TOKEN "your-trello-api-token"
```

### Tabela zbiorcza

| Zmienna                             | `.env.local` | Convex Dashboard |            Wymagana            |
| ----------------------------------- | :----------: | :--------------: | :----------------------------: |
| `CONVEX_DEPLOYMENT`                 |     tak      |        -         |              tak               |
| `NEXT_PUBLIC_CONVEX_URL`            |     tak      |        -         |              tak               |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` |     tak      |        -         |              tak               |
| `CLERK_SECRET_KEY`                  |     tak      |        -         |              tak               |
| `CLERK_FRONTEND_API_URL`            |     tak      |       tak        |              tak               |
| `ENCRYPTION_KEY`                    |      -       |       tak        |              tak               |
| `GOOGLE_CLIENT_ID`                  |      -       |       tak        |            do Drive            |
| `GOOGLE_CLIENT_SECRET`              |      -       |       tak        |            do Drive            |
| `APP_URL`                           |      -       |       tak        | nie (domyslnie localhost:3000) |
| `JOTFORM_WEBHOOK_SECRET`            |      -       |       tak        |              nie               |
| `JOTFORM_API_KEY`                   |      -       |       tak        |        nie (mozna z UI)        |
| `JOTFORM_FORM_ID`                   |      -       |       tak        |        nie (mozna z UI)        |
| `TRELLO_API_KEY`                    |      -       |       tak        |        nie (mozna z UI)        |
| `TRELLO_API_TOKEN`                  |      -       |       tak        |        nie (mozna z UI)        |

---

## Konfiguracja Clerk

Pelna dokumentacja integracji Clerk + Convex: https://docs.convex.dev/auth/clerk

### 1. Utworz konto i aplikacje na clerk.com

1. Wejdz na https://clerk.com i zaloz konto (lub https://dashboard.clerk.com/sign-up)
2. Utworz nowa aplikacje
3. Wlacz metody logowania: **Email + haslo** i/lub **Google SSO**
4. Skopiuj klucze z dashboardu Clerk:
   - `Publishable Key` -> `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `Secret Key` -> `CLERK_SECRET_KEY`
   - `Frontend API URL` -> `CLERK_FRONTEND_API_URL`

### 2. Aktywuj integracje Convex w Clerk

1. W dashboardzie Clerk wejdz do **Integrations** (lub https://dashboard.clerk.com/apps/setup/convex)
2. Wlacz integracje **Convex**
3. Skopiuj **Frontend API URL** (format dev: `https://verb-noun-00.clerk.accounts.dev`)

### 3. Skonfiguruj `auth.config.ts` w Convex

Plik `/convex/auth.config.ts` juz istnieje w repo:

```ts
import { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
```

Zmienna `CLERK_JWT_ISSUER_DOMAIN` to ta sama wartosc co `CLERK_FRONTEND_API_URL`.

### 4. Ustaw zmienne srodowiskowe

**W `.env.local`:**

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_FRONTEND_API_URL=https://verb-noun-00.clerk.accounts.dev
```

**Na Convex Dashboard** (lub przez CLI):

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN "https://verb-noun-00.clerk.accounts.dev"
```

Wartosc `CLERK_JWT_ISSUER_DOMAIN` na Convex Dashboard musi byc taka sama jak `CLERK_FRONTEND_API_URL` w `.env.local`.

Po ustawieniu uruchom `npx convex dev`, zeby zsynchronizowac konfiguracje.

### 5. Rozne instancje Clerk dla dev i prod

- **Development:** klucz `pk_test_...`, domena `https://verb-noun-00.clerk.accounts.dev`
- **Production:** klucz `pk_live_...`, domena `https://clerk.twoja-domena.com`

Ustaw odpowiednie wartosci na Convex Dashboard osobno dla deploymenta dev i prod.

### Jak to dziala w kodzie

- `/proxy.ts` -- middleware Clerk (`clerkMiddleware`) chroni trasy `/admin(.*)`
- `/app/layout.tsx` -- `<ClerkProvider dynamic>` opakowuje cala aplikacje
- `/components/ConvexClientProvider.tsx` -- `ConvexProviderWithClerk` laczy Clerk z Convex, przekazuje `useAuth` z `@clerk/nextjs`
- `/convex/auth.config.ts` -- konfiguracja providera JWT dla Convex (walidacja tokenow po stronie backendu)

### Weryfikacja dzialania

Po konfiguracji:

1. Uruchom `npm run dev`
2. Wejdz na `http://localhost:3000/admin`
3. Powinien pojawic sie ekran logowania Clerk
4. Po zalogowaniu sprawdz czy `useConvexAuth()` zwraca `isAuthenticated: true`

Jesli po zalogowaniu Convex nie widzi uzytkownika:

- Sprawdz czy `CLERK_JWT_ISSUER_DOMAIN` jest ustawiony na Convex Dashboard
- Sprawdz czy uruchomiles `npx convex dev` po zmianach w `auth.config.ts`
- Wiecej: https://docs.convex.dev/auth/debug

---

## Konfiguracja Google Cloud (Drive + Docs)

### 1. Utworz projekt w Google Cloud Console

1. Wejdz na https://console.cloud.google.com
2. Utworz nowy projekt (np. `ADK CRM`)

### 2. Wlacz wymagane API

W menu **APIs & Services > Library** wlacz:

- **Google Drive API**
- **Google Docs API**

### 3. Skonfiguruj OAuth consent screen

1. Wejdz do **APIs & Services > OAuth consent screen**
2. Wybierz typ:
   - `External` (dla kont spoza Google Workspace)
   - `Internal` (dla kont w tym samym Workspace)
3. Uzupelnij:
   - **App name**: `ADK CRM`
   - **Support email**: twoj email
4. Dodaj scope'y:
   - `https://www.googleapis.com/auth/drive`
   - `email`
   - `profile`
5. W sekcji **Test users** dodaj email konta Google, ktore bedzie uzywane do polaczenia z Drive
6. Zapisz

**Wazne:** Dopoki aplikacja jest w statusie "Testing":

- Tylko test users moga sie polaczyc
- Tokeny wygasaja po 7 dniach
- Przenies do "In production" przed wdrozeniem

### 4. Utworz credentials OAuth 2.0

1. Wejdz do **APIs & Services > Credentials**
2. Kliknij **Create Credentials > OAuth client ID**
3. Typ: **Web application**
4. Nazwa: `ADK CRM`
5. **Authorized redirect URIs** -- dodaj:
   ```
   https://your-convex-deployment.convex.site/api/google-drive/callback
   ```
6. Skopiuj **Client ID** i **Client Secret**

### 5. Ustaw na Convex Dashboard

```bash
npx convex env set GOOGLE_CLIENT_ID "your-client-id.apps.googleusercontent.com"
npx convex env set GOOGLE_CLIENT_SECRET "GOCSPX-..."
npx convex env set ENCRYPTION_KEY "$(openssl rand -hex 32)"
npx convex env set APP_URL "http://localhost:3000"
```

### 6. Polacz z aplikacji

1. Uruchom `npm run dev`
2. Wejdz do `/admin/ustawienia` -> zakladka **Google Drive**
3. Kliknij **Polacz z Google Drive**
4. Zaloguj sie kontem Google z listy test users
5. Po powrocie wybierz Shared Drive i folder szablonow

### Jak to dziala w kodzie

- `/convex/googleDriveAuth.ts` -- OAuth flow (initiate + callback)
- `/convex/googleDrive.ts` -- operacje na Drive (foldery, kopiowanie, mail merge, wykrywanie placeholderow)
- Token jest automatycznie odswiezany przy kazdym uzyciu API
- Jesli token wygasnie, system probuje go odswiezyc i ponawia request
- Health check co 30 minut (cron w `/convex/crons.ts`)

---

## Konfiguracja Jotform

### 1. Pobierz klucz API

1. Zaloguj sie na https://jotform.com
2. Wejdz do **Settings > API**
3. Utworz nowy klucz z uprawnieniami **Full Access**
4. Skopiuj klucz

### 2. Konfiguracja z panelu admin (zalecane)

1. Wejdz do `/admin/ustawienia` -> zakladka **Jotform**
2. Wpisz **API Key** i **Form ID**
3. Kliknij **Testuj polaczenie**
4. Kliknij **Zapisz**
5. Kliknij **Zarejestruj webhook**

### Alternatywnie: zmienne srodowiskowe

```bash
npx convex env set JOTFORM_API_KEY "your-api-key"
npx convex env set JOTFORM_FORM_ID "your-form-id"
npx convex env set JOTFORM_WEBHOOK_SECRET "dowolny-sekret"
```

### Webhook URL

```
https://your-convex-deployment.convex.site/api/webhooks/jotform?secret=YOUR_SECRET
```

### Obslugiwane formaty

Webhook obsluguje payloady w formatach:

- `multipart/form-data` (domyslny format Jotform)
- `application/x-www-form-urlencoded`
- `application/json`

### Mapowanie pol

Mapper pol jest w `/convex/jotform.ts` i obsluguje dwa zestawy nazw:

- oryginalne pola PRD (`q8_imieI`, `q20_podajSwoj`, itd.)
- alternatywne pola (`q2_q2_textbox0`, `q3_q3_textbox1`, itd.)

Jesli Twoj formularz uzywa innych nazw pol, dodaj fallbacki w funkcji `mapJotformPayload()`.

---

## Konfiguracja Trello

### 1. Pobierz klucze

1. Wejdz na https://trello.com/power-ups/admin
2. Skopiuj **API Key**
3. Wygeneruj **API Token** z linku:
   ```
   https://trello.com/1/authorize?expiration=never&name=ADKCRM&scope=read,write&response_type=token&key=YOUR_API_KEY
   ```
4. Skopiuj token z ekranu autoryzacji

### 2. Konfiguracja z panelu admin (zalecane)

1. Wejdz do `/admin/ustawienia` -> zakladka **Trello**
2. Wpisz **API Key** i **API Token**
3. Kliknij **Testuj polaczenie** (zaladuje tablice)
4. Wybierz **Board**
5. Kliknij **Pobierz listy**
6. Zmapuj statusy CRM na listy Trello
7. Kliknij **Zapisz**
8. Kliknij **Rejestruj** (webhook)

### Alternatywnie: zmienne srodowiskowe

```bash
npx convex env set TRELLO_API_KEY "your-api-key"
npx convex env set TRELLO_API_TOKEN "your-api-token"
```

Reszta konfiguracji (board, listy, mapowanie) nadal wymaga panelu admin.

### Synchronizacja statusow

| Status CRM     | Opis               |
| -------------- | ------------------ |
| `lead`         | Nowe zapytanie     |
| `inquiry`      | Oferta wyslana     |
| `measurement`  | Do pomiarow        |
| `offer`        | Oferta po pomiarze |
| `contract`     | Umowa              |
| `production`   | Produkcja          |
| `installation` | Montaz             |
| `completed`    | Zakonczone         |
| `warranty`     | Gwarancja          |

Mapowanie statusow na listy Trello ustawiasz w panelu admin.

### Webhook Trello

- URL: `https://your-convex-deployment.convex.site/api/webhooks/trello`
- Obsluguje `GET` (weryfikacja) i `POST` (eventy)
- Przesuniecie karty miedzy listami synchronizuje status klienta w CRM

---

## Struktura projektu

```
app/                          # Next.js App Router
  admin/                      # Panel administracyjny (chroniony przez Clerk)
    dashboard/page.tsx        # Dashboard ze statystykami
    klienci/                  # Lista klientow (tabela, kanban, karty)
    klient/[id]/page.tsx      # Widok klienta
    nowy/page.tsx             # Formularz nowego klienta
    szablony/                 # Zarzadzanie szablonami dokumentow
    ustawienia/page.tsx       # Ustawienia integracji
  layout.tsx                  # Root layout z ClerkProvider
  page.tsx                    # Strona glowna (redirect)

components/
  ConvexClientProvider.tsx    # Provider Convex + Clerk

convex/                       # Backend Convex
  schema.ts                   # Definicja tabel i indeksow
  clients.ts                  # CRUD klientow, zmiana statusow
  events.ts                   # Historia zdarzen
  viewConfig.ts               # Konfiguracja widoku per user
  documentTemplates.ts        # Szablony dokumentow
  dashboard.ts                # Statystyki dashboardu
  googleDrive.ts              # Integracja Google Drive
  googleDriveAuth.ts          # OAuth flow Google
  jotform.ts                  # Webhook Jotform
  jotformAdmin.ts             # Konfiguracja Jotform
  jotformInternal.ts          # Wewnetrzne mutacje Jotform
  trello.ts                   # Integracja Trello
  trelloWebhook.ts            # Webhook Trello
  http.ts                     # Router HTTP (webhooks, OAuth)
  crons.ts                    # Zadania cykliczne
  seed.ts                     # Dane testowe
  auth.config.ts              # Konfiguracja auth Clerk
  lib/crypto.ts               # Szyfrowanie AES-256-GCM
  tests/                      # Testy backend

proxy.ts                      # Middleware Clerk (ochrona /admin)
```

---

## Testowanie

```bash
# Wszystkie testy
npm test

# Jeden plik
npm test -- convex/tests/clients.test.ts

# Watch mode
npm run test:watch
```

Testy backendowe uzywaja `convex-test` i `vitest` w `edge-runtime`.

---

## Kolejnosc konfiguracji od zera

1. `npm install`
2. Utworz konto Convex i projekt: `npx convex dev` (pierwsza konfiguracja)
3. Skonfiguruj Clerk (konto + klucze)
4. Uzupelnij `.env.local`
5. Ustaw zmienne na Convex Dashboard (`ENCRYPTION_KEY`, `CLERK_FRONTEND_API_URL`)
6. Uruchom `npm run dev`
7. (Opcjonalnie) Skonfiguruj Google Cloud Console i polacz Google Drive
8. (Opcjonalnie) Skonfiguruj Jotform z panelu admin
9. (Opcjonalnie) Skonfiguruj Trello z panelu admin

---

## Rozwiazywanie problemow

### Google Drive zwraca 401

Token wygasl. System automatycznie probuje go odswiezyc. Jesli nadal nie dziala:

1. Wejdz do ustawien Google Drive
2. Kliknij **Odnow token**
3. Jesli nie pomoze: **Rozlacz** i polacz ponownie

### Jotform webhook nie tworzy klienta

1. Sprawdz logi `convex dev` po wyslaniu formularza
2. Szukaj `[jotform] mapped payload` -- jesli `firstName` i `lastName` sa puste, formularz uzywa innych nazw pol
3. Dodaj fallbacki w `/convex/jotform.ts` w funkcji `mapJotformPayload()`

### Trello webhook zwraca 500

1. Upewnij sie ze `convex dev` jest uruchomione
2. Sprawdz czy endpoint odpowiada: `curl https://your-deployment.convex.site/api/webhooks/trello`
3. Ponow rejestracje webhooka z panelu admin

### Token Google wygasa po 7 dniach

Aplikacja Google Cloud jest w statusie "Testing". Przenies ja do "In production" w OAuth consent screen.
