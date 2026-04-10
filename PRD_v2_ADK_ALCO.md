# PRD v2: ADK/ALCO — System Zarządzania Klientami i Dokumentami

**Wersja:** 2.0  
**Data:** 2026-03-30  
**Autor:** Analityk / Kami  
**Stack:** Next.js 15 + Clerk + Convex  

---

## 1. Kontekst i Problem

### 1.1 AS-IS (obecny stan)

Firma ADK Okna (adkokna.pl) obsługuje klientów przez rozproszony system:

| Warstwa | Narzędzie | Rola |
|---------|-----------|------|
| Zbieranie leadów | Jotform (formularz na stronie adkokna.pl/darmowa-wycena) | Formularz "Formularz bezpłatnej wyceny" — zbiera dane osobowe, usługi, kolory, pliki, komentarz |
| Kanban / CRM | Trello ("1 TABELA GŁÓWNA") | Karta klienta z opisem markdown. Listy: OFERTY - zapytania → DO POMIARÓW → POMIARY → ... |
| Baza klientów | Notion ("Klienci / Zamówienie") | Pola: Imię, Nazwisko, Email, Tel, Adres + checkboxy dokumentów + URL-e plików |
| Przechowywanie plików | Google Shared Drive ("Klienci") | Foldery per klient, szablony w /Szablony/ |
| Orkiestracja | Make.com (3 scenariusze) | 1) Jotform→Trello, 2) Trello→Notion+folder, 3) Notion checkbox→kopiuj szablony |

**Scenariusze Make.com (do zastąpienia):**

1. **Jotform → Trello** — Po wysłaniu formularza tworzy kartę w Trello na liście "OFERTY - zapytania". Nazwa karty: `Imię_Nazwisko_Usługi_Miejscowość`. Opis: markdown z danymi klienta i zlecenia.

2. **Trello → Notion + Google Drive** — Po przeniesieniu karty z "OFERTY - zapytania" na "DO POMIARÓW": parsuje opis karty regexem, tworzy wpis w Notion, tworzy folder na Google Drive, zapisuje folder_id i URL z powrotem do Notion.

3. **Notion checkbox → Google Drive** — Po zaznaczeniu checkboxa w Notion: kopiuje szablon z dysku do folderu klienta, zmienia nazwę, zapisuje URL do Notion.

**Problemy:**
- 6 narzędzi = 6 punktów awarii
- Make.com kosztuje i limituje operacje
- Parsowanie danych regexem z opisu Trello jest kruche
- Brak walidacji danych między systemami
- Brak mail merge w dokumentach
- Duplikacja danych (Jotform → Trello desc → regex parse → Notion)
- Dane zlecenia (usługi, kolory) gubią się między systemami

### 1.2 TO-BE (docelowy stan)

Jedna aplikacja webowa zastępująca Notion + Make.com + częściowo Trello:

| Warstwa | Rozwiązanie |
|---------|-------------|
| Zbieranie leadów | Jotform → webhook bezpośrednio do aplikacji |
| CRM + Baza klientów | Aplikacja (Convex DB) z konfigurowalnym widokiem |
| Kanban | Aplikacja (wbudowany widok kanban) |
| Przechowywanie plików | Google Shared Drive (API, OAuth z UI w aplikacji) |
| Generowanie dokumentów | Aplikacja (dynamiczny mapper pól + server-side generation) |
| Orkiestracja | Convex (wbudowane) |

**Usunięte zależności:** Make.com, Notion, Trello (opcjonalny read-only sync).

---

## 2. Aktorzy i Role

| Rola | Opis | Uprawnienia |
|------|------|-------------|
| **Admin** | Właściciel firmy (Arek) | Pełny dostęp, konfiguracja Google Drive, szablony, mapper pól, układ widoków |
| **Handlowiec** | Osoba obsługująca klienta | CRUD klientów, generowanie dokumentów, zmiana statusów |
| **Montażysta** | Ekipa montażowa | Podgląd klienta, uzupełnianie protokołu montażu |
| **System** | Webhook Jotform | Automatyczne tworzenie leadów |

Autentykacja: Clerk (email + hasło lub Google SSO).

---

## 3. Model Danych (koncepcyjny)

> Uwaga: Ten rozdział opisuje strukturę danych, nie implementację. Dokładne nazwy mutacji, queries i typy zostaną ustalone w fazie implementacji.

### 3.1 Klient (clients)

**Dane podstawowe (z Jotform):**

| Pole | Typ | Źródło Jotform | Widoczność |
|------|-----|---------------|------------|
| firstName | string, required | `q8_imieI.first` | Zawsze |
| lastName | string, required | `q8_imieI.last` | Zawsze |
| email | string | `q20_podajSwoj` | Zawsze |
| phone | string | `q21_podajSwoj21.full` | Zawsze |
| city | string | `q37_miejscowosc` | Zawsze |
| address | string | Uzupełniany ręcznie | Zawsze |

**Dane zlecenia (z Jotform) — widoczne dopiero od statusu "measurement":**

| Pole | Typ | Źródło Jotform |
|------|-----|---------------|
| services | string[] | `q33_jakaUsluge33` — multi-select: Okna, Drzwi, Brama, Zabudowa tarasu, Konstrukcja aluminiowa, Ogrodzenie, System przeciwsłoneczny |
| windowColor | string[] | `q26_wybierzKolor` — Złoty dąb, Orzech, Winchester, Antracyt, Biały, Woodec Oak, Niestandardowy |
| doorColor | string[] | `q28_wybierzKolor28` — j.w. |
| gateColor | string[] | `q29_wybierzKolor29` — Złoty dąb, Orzech, Winchester, Antracyt, Biały, Woodec Oak, Niestandardowy |
| terraceColor | string[] | `q30_wybierzKolor30` — Antracyt, Brąz jasny, Niestandardowy |
| constructionColor | string[] | `q31_wybierzKolor31` — Biały, Antracyt, Brązowy, Niestandardowy |
| sunProtectionType | string[] | `q32_wybierzTyp` — Rolety, Żaluzje |
| projectFiles | string | `q27_przeslijPliki` — URL do plików |
| comment | string | `q23_miejsceNa` |

**Reguła widoczności danych zlecenia:**
> Dane zlecenia (usługi, kolory, komentarz, pliki) są **przechowywane od momentu wpłynięcia formularza**, ale **nie są wyświetlane w UI** dopóki status klienta nie zostanie zmieniony na "measurement" (Pomiar) lub dalszy. To oddziela fazę leadu (tylko dane kontaktowe) od fazy aktywnej obsługi (pełne dane).

**Status workflow:**

| Status | Label PL | Opis |
|--------|----------|------|
| `lead` | Lead / Zapytanie | Wpłynął formularz, jeszcze nie podjęto kontaktu |
| `inquiry` | Oferta wysłana | Wysłano wstępną wycenę |
| `measurement` | Do pomiarów | Zaakceptowano → tworzymy folder, wyświetlamy dane zlecenia |
| `offer` | Oferta po pomiarze | Szczegółowa wycena po pomiarze |
| `contract` | Umowa | Podpisana umowa |
| `production` | Produkcja | Zamówienie w produkcji |
| `installation` | Montaż | Ekipa montażowa w terenie |
| `completed` | Zakończone | Montaż odebrany |
| `warranty` | Gwarancja / Serwis | Zgłoszenie gwarancyjne |

**Dokumenty (checkboxy + URL-e):**

Dla każdego typu dokumentu: `{ enabled: boolean, url?: string, generatedAt?: timestamp }`

Typy: pomiar, umowa, gwarancjaAlco, rekojmiaAdk, odbiorInwestor, protokolMontaz, faktura, reklamacja.

**Karty gwarancyjne producentów:** tablica załączników (manufacturer, type, fileUrl).

**Google Drive:** folderId, folderUrl.

**Metadane:** source ("jotform" | "manual"), jotformSubmissionId, createdBy (Clerk userId), timestamps.

### 3.2 Szablon dokumentu (documentTemplates)

| Pole | Opis |
|------|------|
| key | Identyfikator: "pomiar", "umowa", "gwarancja_alco", ... |
| name | Nazwa wyświetlana: "Pomiar 2026/03" |
| googleDriveFileId | ID pliku szablonu na Google Drive |
| fileNamePattern | Pattern nazwy: `Pomiar_{{firstName}}_{{lastName}}_{{city}}` |
| fieldMappings | Dynamiczny mapper pól (sekcja 8) |
| version | Wersja szablonu |

### 3.3 Historia zdarzeń (clientEvents)

Każda akcja w systemie logowana z: clientId, type, details (JSON), performedBy, timestamp.

### 3.4 Konfiguracja Google Drive (driveConnection)

| Pole | Opis |
|------|------|
| accessToken | Encrypted OAuth access token |
| refreshToken | Encrypted OAuth refresh token |
| expiresAt | Timestamp wygaśnięcia access token |
| sharedDriveId | ID dysku współdzielonego ("Klienci") |
| templatesFolderId | ID folderu z szablonami |
| connectionStatus | "connected" / "expired" / "disconnected" / "error" |
| lastCheckedAt | Timestamp ostatniego health check |
| connectedBy | Clerk userId |
| connectedEmail | Email konta Google |

### 3.5 Konfiguracja widoku klientów (viewConfig)

| Pole | Opis |
|------|------|
| userId | Clerk userId (każdy user ma swój układ) |
| viewType | "table" / "kanban" / "cards" |
| columns | Tablica wybranych kolumn z kolejnością |
| sortBy | Pole sortowania + kierunek |
| filters | Zapisane filtry |
| groupBy | Opcjonalne grupowanie (np. po statusie, miejscowości) |

---

## 4. Mapa Szablonów Dokumentów

### 4.1 Szablony generowane z danych klienta

| Klucz | Plik szablonu | Nazwa wynikowa | Trigger |
|-------|--------------|---------------|---------|
| `pomiar` | Pomiar_2026_03.docx | `Pomiar_{{firstName}}_{{lastName}}_{{city}}` | checkbox Pomiar |
| `umowa` | umowa_2024.doc | `Umowa_{{firstName}}_{{lastName}}_{{city}}` | checkbox Umowa |
| `gwarancja_alco` | ALCO_karta_gwarancyjna.doc | `ALCO_karta_gwarancyjna_{{firstName}}_{{lastName}}_{{city}}` | checkbox Gwarancja |
| `rekojmia_adk` | ADK_rekojma.doc | `ADK_rekojma_{{firstName}}_{{lastName}}_{{city}}` | checkbox Gwarancja (razem z ALCO) |
| `odbior_inwestor` | Odbior_inwestor.doc | `Odbior_{{firstName}}_{{lastName}}_{{city}}` | checkbox Odbiór inwestora |
| `protokol_montaz` | protokol_od_Montazysty.doc | `OdMontazysty_{{firstName}}_{{lastName}}_{{city}}` | checkbox pr. od Montażysty |

Checkbox "Gwarancja" generuje zawsze 2 pliki (ALCO + ADK).

### 4.2 Karty gwarancyjne producentów (upload, nie generowane)

| Producent | Typ | Format |
|-----------|-----|--------|
| WIKĘD | Drzwi zewnętrzne | JPEG (2 strony) |
| ABAKUS (Salamander) | Okna PCV | PDF (4 str.) |
| ABM Jędraszek (VEKA) | Okna PCV | PDF (2 str.) |
| KS System | Brama garażowa | PDF (2 str.) |
| Wiśniowski | Brama garażowa | PDF (4 str.) |

---

## 5. Integracja z Google Drive — OAuth i zarządzanie połączeniem

### 5.1 Flow połączenia

```
Admin → Ustawienia → Integracje → Google Drive
    → [Połącz z Google Drive]
    → Google OAuth consent screen (scope: drive.file, drive)
    → Callback → zapisz access_token + refresh_token
    → Wybierz Shared Drive z listy
    → Wybierz folder szablonów
    → Status: ✅ Połączono (kontakt@adkokna.pl)
```

### 5.2 Ekran: Ustawienia → Google Drive (`/admin/integrations/google-drive`)

```
┌─────────────────────────────────────────────────────┐
│ 🔗 Integracja Google Drive                           │
├─────────────────────────────────────────────────────┤
│                                                      │
│ Status: ✅ Połączono                                 │
│ Konto: kontakt@adkokna.pl                            │
│ Połączono przez: Arek (admin)                        │
│ Data połączenia: 30.03.2026                          │
│ Token wygasa: za 47 minut (auto-odnawiany)           │
│                                                      │
│ ┌─ Dysk współdzielony ───────────────────────────┐  │
│ │ Nazwa: Klienci                                  │  │
│ │ ID: 0AF5F7v0YZWQHUk9PVA                       │  │
│ │ [Zmień ▼]                                       │  │
│ └─────────────────────────────────────────────────┘  │
│                                                      │
│ ┌─ Folder szablonów ─────────────────────────────┐  │
│ │ Ścieżka: /Szablony/                            │  │
│ │ Szablonów: 6 plików                            │  │
│ │ [Przeglądaj ▼]                                  │  │
│ └─────────────────────────────────────────────────┘  │
│                                                      │
│ ┌─ Health check ─────────────────────────────────┐  │
│ │ Ostatni test: 30.03.2026 14:22 ✅               │  │
│ │ API dostępne: Tak                               │  │
│ │ Uprawnienia: Odczyt + Zapis                     │  │
│ │ [🔄 Testuj połączenie]                          │  │
│ └─────────────────────────────────────────────────┘  │
│                                                      │
│ [🔌 Rozłącz]  [🔄 Odnów token ręcznie]              │
│                                                      │
│ ⚠️ Stany awaryjne:                                  │
│ • Token wygasł → auto-renew z refresh_token          │
│ • Refresh token unieważniony → banner "Połącz        │
│   ponownie" na dashboardzie + email do admina        │
│ • API niedostępne → retry 3x, potem alert            │
│ • Brak uprawnień do dysku → komunikat z instrukcją   │
└─────────────────────────────────────────────────────┘
```

### 5.3 Stany połączenia i obsługa

| Stan | Ikona | Opis | Akcja automatyczna |
|------|-------|------|-------------------|
| `connected` | ✅ | Token ważny, API dostępne | — |
| `token_expiring` | ⏳ | Access token wygasa w < 5 min | Auto-refresh z refresh_token |
| `refreshing` | 🔄 | Trwa odnawianie tokena | Kolejka operacji czeka |
| `expired` | ⚠️ | Access token wygasł, refresh się udał | Transparentne dla usera |
| `refresh_failed` | 🔴 | Refresh token unieważniony | Banner na dashboardzie: "Połącz ponownie Google Drive" |
| `disconnected` | ⭕ | Brak połączenia | Przycisk "Połącz z Google Drive" |
| `error` | ❌ | API error (500, rate limit) | Retry z exponential backoff, alert po 3 próbach |

### 5.4 Automatyczne odnawianie tokena

- Access token Google trwa ~1h
- System sprawdza `expiresAt` przed każdą operacją na Drive
- Jeśli < 5 min do wygaśnięcia → odśwież proaktywnie
- Jeśli refresh token fail → ustaw status `refresh_failed`, wyślij powiadomienie
- Scheduled job: health check co 30 minut (weryfikuje token + uprawnienia)

---

## 6. Jotform Integration

### 6.1 Pola formularza "Formularz bezpłatnej wyceny" (ID: 260517926002047)

Pełna mapa pól z blueprintu Make.com:

| Pole Jotform | Klucz Make | Typ | Pole w aplikacji |
|---|---|---|---|
| Podaj swoje dane osobowe → Imię | `q8_imieI.first` | text | `firstName` |
| Podaj swoje dane osobowe → Nazwisko | `q8_imieI.last` | text | `lastName` |
| Podaj swój adres e-mail | `q20_podajSwoj` | email | `email` |
| Podaj swój numer telefonu | `q21_podajSwoj21.full` | text | `phone` |
| Miejscowość | `q37_miejscowosc` | text | `city` |
| Jaką usługę chcesz wycenić? | `q33_jakaUsluge33` | array (multi-checkbox) | `services[]` |
| Wybierz kolor okien | `q26_wybierzKolor` | array | `windowColor[]` |
| Wybierz kolor drzwi | `q28_wybierzKolor28` | array | `doorColor[]` |
| Wybierz kolor bramy | `q29_wybierzKolor29` | array | `gateColor[]` |
| Wybierz kolor zabudowy tarasu | `q30_wybierzKolor30` | array | `terraceColor[]` |
| Wybierz kolor konstrukcji aluminiowych | `q31_wybierzKolor31` | array | `constructionColor[]` |
| Wybierz typ systemu przeciwsłonecznego | `q32_wybierzTyp` | array | `sunProtectionType[]` |
| Prześlij pliki z projektem | `q27_przeslijPliki` | URL | `projectFiles` |
| Miejsce na twój komentarz | `q23_miejsceNa` | text | `comment` |
| RODO zgoda | `q35_input35` | text | Nie zapisujemy — czysto informacyjny |

### 6.2 Zachowanie po otrzymaniu webhooka

1. Webhook trafia do aplikacji (`POST /api/webhooks/jotform`)
2. Weryfikacja (shared secret)
3. **Wszystkie dane zapisywane do bazy** — zarówno kontaktowe, jak i zleceniowe
4. Status klienta: `lead`
5. **W UI widoczne tylko dane kontaktowe** (firstName, lastName, email, phone, city)
6. Dane zlecenia (services, colors, comment, files) — **przechowywane ale ukryte w UI**
7. Dopiero zmiana statusu na `measurement` lub dalszy → dane zlecenia pojawiają się w widoku klienta

### 6.3 Opcjonalna synchronizacja z Trello

Na życzenie (toggle w ustawieniach), aplikacja może nadal tworzyć kartę w Trello przy nowym leadzie — dla zachowania kompatybilności w okresie przejściowym. Format karty identyczny jak w obecnym scenariuszu Make:

- Nazwa: `Imię_Nazwisko_Usługi_Miejscowość`
- Opis: Markdown z danymi (tak jak w obecnym scenariuszu)
- Lista: "OFERTY - zapytania"

Docelowo do wyłączenia.

---

## 7. User Stories

### Epic 1: Zarządzanie Leadami

**US-1.1 — Jotform Webhook**
> Jako **system**, po wysłaniu formularza bezpłatnej wyceny na adkokna.pl, chcę automatycznie zapisać WSZYSTKIE dane z formularza do bazy ze statusem "lead", ale wyświetlić użytkownikowi tylko dane kontaktowe.

Acceptance Criteria:
- Endpoint przyjmuje POST z Jotform
- Mapowanie wg tabeli z sekcji 6.1
- Klient tworzony ze statusem "lead"
- Dane zlecenia (usługi, kolory, komentarz, pliki) zapisane w DB ale niewidoczne w UI
- Deduplikacja po email (jeśli istnieje → nowe zgłoszenie dołączane jako event, nie duplikat)
- Event "created" w historii z pełnym payloadem

**US-1.2 — Ręczne dodanie klienta**
> Jako **handlowiec**, chcę dodać klienta ręcznie.

AC: Formularz: Imię*, Nazwisko*, Email, Telefon, Miejscowość. Status: "lead". Source: "manual".

**US-1.3 — Lista klientów z konfigurowalnym widokiem**
> Jako **handlowiec**, chcę widzieć klientów w wybranym przeze mnie układzie (tabela / kanban / karty) z możliwością konfiguracji kolumn, sortowania i filtrów.

AC: Patrz sekcja 9 — Konfigurowalny widok klientów.

### Epic 2: Workflow Statusów

**US-2.1 — Zmiana statusu**
> Jako **handlowiec**, chcę zmienić status klienta zgodnie z dozwolonymi przejściami.

AC:
- Dozwolone przejścia: lead→inquiry|measurement, inquiry→measurement|offer, measurement→offer|contract, offer→contract|lead, contract→production, production→installation, installation→completed, completed→warranty
- Event "status_changed"
- **Zmiana na "measurement" triggeruje:** tworzenie folderu (US-3.1) + odsłonięcie danych zlecenia w UI

**US-2.2 — Odsłonięcie danych zlecenia**
> Jako **handlowiec**, po zmianie statusu na "measurement", chcę zobaczyć pełne dane zlecenia (usługi, kolory, komentarz, pliki), które wcześniej były ukryte.

AC:
- Na stronie klienta pojawia się sekcja "Szczegóły zlecenia"
- Widoczne: usługi (tagi), kolory per kategoria, pliki z projektem (link), komentarz
- Sekcja ta nie istnieje dla klientów w statusie "lead" i "inquiry"
- Dane edytowalne po odsłonięciu

### Epic 3: Google Drive Integration

**US-3.1 — Połączenie z Google Drive (OAuth)**
> Jako **admin**, chcę połączyć aplikację z Google Drive przez OAuth, wybrać dysk współdzielony i folder szablonów, aby system mógł tworzyć foldery i kopiować pliki.

AC:
- Ekran: Ustawienia → Integracje → Google Drive (sekcja 5.2)
- Przycisk "Połącz z Google Drive" → OAuth consent screen
- Po autoryzacji: wybór Shared Drive z listy
- Wybór folderu szablonów (file picker)
- Status połączenia widoczny na dashboardzie (ikona w topbar)
- Tokens encrypted at rest

**US-3.2 — Status połączenia i auto-odnawianie**
> Jako **admin**, chcę widzieć aktualny status połączenia z Google Drive i być powiadamianym gdy połączenie wymaga interwencji.

AC:
- Ikona statusu w topbar: ✅/⚠️/🔴
- Auto-refresh access token przed wygaśnięciem
- Gdy refresh token fail → banner na dashboardzie + email/notyfikacja
- Przycisk "Testuj połączenie" → sprawdza API + uprawnienia
- Health check co 30 min (scheduled)

**US-3.3 — Tworzenie folderu klienta**
> Jako **system**, po zmianie statusu na "measurement", chcę automatycznie utworzyć folder na dysku współdzielonym.

AC:
- Nazwa: `YYYY/MM/DD_Imię_Nazwisko_Miejscowość` (format daty naprawiony — ukośniki zamiast dwukropków)
- Lokalizacja: root Shared Drive "Klienci"
- Idempotentność: jeśli folderId już istnieje → skip
- Wymaga statusu Google Drive: "connected"
- Jeśli Drive niedostępny → kolejka z retry

**US-3.4 — Generowanie dokumentu z szablonu**
> Jako **handlowiec**, po zaznaczeniu checkboxa dokumentu, chcę aby system skopiował szablon do folderu klienta i nadał mu właściwą nazwę.

AC:
- Kopiowanie pliku szablonu (Google Drive API: files.copy)
- Nazwa wg konwencji z sekcji 4.1
- URL zapisywany w rekordzie klienta
- Idempotentność: jeśli URL już istnieje → nie twórz duplikatu
- Iteracja 1: tylko kopiowanie
- Iteracja 2: kopiowanie + podstawienie danych z dynamicznego mappera (sekcja 8)

**US-3.5 — Checkbox "Gwarancja" = 2 pliki**
> Jako **handlowiec**, po zaznaczeniu "Gwarancja", system generuje oba pliki (ALCO + ADK).

AC: Zaznaczenie jednego automatycznie zaznacza drugie. Oba generowane w jednej operacji.

**US-3.6 — Upload karty gwarancyjnej producenta**
> Jako **handlowiec**, chcę wgrać PDF z kartą gwarancyjną producenta do folderu klienta.

AC: Wybór producenta + typu z listy. Upload do folderu klienta. Rekord w warrantyCards.

### Epic 4: Widok Klienta

**US-4.1 — Strona klienta**

```
┌──────────────────────────────────────────────────────────┐
│ ← Lista    Wojciech Zapora                [Status: ▼ 🟡]│
├──────────────────────┬───────────────────────────────────┤
│ DANE KONTAKTOWE      │ DOKUMENTY                         │
│ Imię: Wojciech  [✏️] │ ☑ Pomiar          [📄 Otwórz]    │
│ Nazwisko: Zapora [✏️] │ ☑ Umowa           [📄 Otwórz]    │
│ Email: w@gm...   [✏️] │ ☐ Gwarancja       [—]            │
│ Tel: 123-456     [✏️] │ ☐ Odbiór inwest.  [—]            │
│ Miejscowość: Mińsk   │ ☐ pr. od Montaż.  [—]            │
│ Adres: [dodaj]   [✏️] │ ☐ Faktura         [—]            │
│                      │ ☐ Reklamacja      [—]            │
│ FOLDER               │                                   │
│ [📁 Otwórz folder]   │ KARTY GWARANCYJNE                │
│                      │ WIKĘD (drzwi)     [📄 Otwórz]    │
├──────────────────────┤ [+ Dodaj kartę]                   │
│ SZCZEGÓŁY ZLECENIA   │                                   │
│ ⚡ Widoczne od       ├───────────────────────────────────┤
│   statusu "Pomiar"   │ HISTORIA                          │
│                      │ 🕐 15:15 System: Wygenerowano     │
│ Usługi: Brama,       │   Pomiar                          │
│   Ogrodzenie         │ 🕐 15:10 Jan: Status → pomiar     │
│ Kolor bramy:         │ 🕐 15:10 System: Folder utworzony  │
│   Woodec Oak         │ 🕐 14:22 System: Lead z Jotform   │
│ Kolor konstrukcji:   │                                   │
│   Brązowy            │                                   │
│ Pliki: [📎 link]     │                                   │
│ Komentarz: testowy.. │                                   │
└──────────────────────┴───────────────────────────────────┘
```

Sekcja "SZCZEGÓŁY ZLECENIA" jest ukryta gdy status = lead lub inquiry. Pojawia się od measurement.

**US-4.2 — Edycja inline danych klienta**

AC: Kliknięcie → edycja → autozapis. Event "data_updated". Edycja danych zlecenia dostępna od statusu "measurement".

**US-4.3 — Historia zdarzeń (timeline)**

AC: Chronologiczna lista. Każdy event: data, kto, co. Od najnowszych.

### Epic 5: Integracja Jotform (webhook)

**US-5.1 — Konfiguracja webhooka**
> Jako **admin**, chcę w ustawieniach zobaczyć URL webhooka i secret do wklejenia w Jotform.

AC:
- Ekran: Ustawienia → Integracje → Jotform
- Wyświetla: Webhook URL, Secret key, przycisk "Kopiuj"
- Instrukcja: "Wklej ten URL w Jotform → Settings → Webhooks"
- Log ostatnich webhooków (data, status, submissionId)
- Przycisk "Testuj" → symuluje payload

### Epic 6: Opcjonalna synchronizacja Trello

**US-6.1 — Toggle Trello sync**
> Jako **admin**, chcę włączyć/wyłączyć automatyczne tworzenie kart w Trello dla nowych leadów, aby zachować kompatybilność w okresie przejściowym.

AC:
- Toggle w ustawieniach: Trello sync ON/OFF
- Gdy ON: nowy lead → tworzy kartę w Trello (format jak obecny scenariusz Make)
- Gdy OFF: brak synchronizacji
- Wymaga podania Trello API key + token
- Docelowo: wyłączyć i usunąć

---

## 8. Dynamiczny Mapper Pól w Szablonach

### 8.1 Cel

Umożliwić adminowi konfigurację, które pola z danych klienta mają być podstawiane pod które placeholdery w dokumencie — **bez wdrażania nowej wersji oprogramowania**.

### 8.2 Ekran: Admin → Szablony → Edycja mappera (`/admin/templates/[key]/mapper`)

```
┌─────────────────────────────────────────────────────────┐
│ Szablon: Pomiar 2026/03                                  │
│ Plik: Pomiar_2026_03.docx                                │
│ [📄 Podgląd szablonu]   [⬆️ Upload nowej wersji]        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ WZORZEC NAZWY PLIKU                                      │
│ ┌──────────────────────────────────────────────────┐    │
│ │ Pomiar_[firstName]_[lastName]_[city]              │    │
│ └──────────────────────────────────────────────────┘    │
│ Podgląd: Pomiar_Wojciech_Zapora_Mińsk Mazowiecki        │
│                                                          │
│ MAPOWANIE PÓL W DOKUMENCIE                               │
│                                                          │
│ Placeholder w szablonie    →  Pole danych klienta        │
│ ┌────────────────────────┐   ┌─────────────────────┐    │
│ │ {{imie}}               │ → │ firstName         ▼ │    │
│ └────────────────────────┘   └─────────────────────┘    │
│ ┌────────────────────────┐   ┌─────────────────────┐    │
│ │ {{nazwisko}}           │ → │ lastName          ▼ │    │
│ └────────────────────────┘   └─────────────────────┘    │
│ ┌────────────────────────┐   ┌─────────────────────┐    │
│ │ {{telefon}}            │ → │ phone             ▼ │    │
│ └────────────────────────┘   └─────────────────────┘    │
│ ┌────────────────────────┐   ┌─────────────────────┐    │
│ │ {{email}}              │ → │ email             ▼ │    │
│ └────────────────────────┘   └─────────────────────┘    │
│ ┌────────────────────────┐   ┌─────────────────────┐    │
│ │ {{adres}}              │ → │ address           ▼ │    │
│ └────────────────────────┘   └─────────────────────┘    │
│ ┌────────────────────────┐   ┌─────────────────────┐    │
│ │ {{data}}               │ → │ 🔧 Specjalne: dziś ▼│    │
│ └────────────────────────┘   └─────────────────────┘    │
│                                                          │
│ [+ Dodaj mapowanie]                                      │
│                                                          │
│ Dostępne pola klienta:                                   │
│ firstName, lastName, email, phone, city, address,        │
│ services, windowColor, doorColor, gateColor,             │
│ terraceColor, constructionColor, sunProtectionType,      │
│ comment                                                  │
│                                                          │
│ Wartości specjalne:                                       │
│ 🔧 dziś (DD.MM.YYYY), 🔧 rok, 🔧 pusta wartość         │
│                                                          │
│ [💾 Zapisz]  [🧪 Testuj na danych klienta ▼]            │
└─────────────────────────────────────────────────────────┘
```

### 8.3 Jak to działa

1. Admin otwiera szablon .docx/.doc w aplikacji
2. Wpisuje tekst placeholdera który jest w szablonie (np. `{{imie}}`)
3. Z dropdowna wybiera pole danych klienta (np. `firstName`)
4. Zapisuje mapowanie
5. Przy generowaniu dokumentu, system:
   - Pobiera szablon z Drive
   - Dla każdego mapowania: find `{{imie}}` → replace z wartością `client.firstName`
   - Upload wynikowego pliku do folderu klienta

### 8.4 Korzyści

- **Nowy placeholder w szablonie?** → Admin dodaje mapowanie w UI, nie wymaga deploymentu
- **Nowy szablon?** → Upload pliku + skonfiguruj mappery, gotowe
- **Zmiana nazwy placeholdera w szablonie?** → Zmień w mapperze, nie w kodzie
- **Testowanie** → Przycisk "Testuj" generuje podgląd z danymi wybranego klienta

---

## 9. Konfigurowalny Widok Klientów (CRM)

### 9.1 Tryby widoku

| Tryb | Opis | Kiedy |
|------|------|-------|
| **Tabela** | Klasyczna tabela z kolumnami, sortowaniem, filtrami | Domyślny, zarządzanie dużą ilością klientów |
| **Kanban** | Kolumny = statusy, karty = klienci, drag & drop | Przegląd pipeline'u |
| **Karty** | Grid kart z kluczowymi danymi | Szybki przegląd |

### 9.2 Konfiguracja tabeli

```
┌───────────────────────────────────────────────────────────────┐
│ Klienci               [Tabela ▼] [Kanban] [Karty]  [⚙️]     │
│ [+ Nowy klient]  [🔍 Szukaj...]                              │
├───────────────────────────────────────────────────────────────┤
│ ⚙️ Panel konfiguracji (rozwijany):                            │
│ ┌─ Kolumny (drag & drop kolejność) ──────────────────────┐   │
│ │ ☑ Imię         ☑ Nazwisko      ☑ Miejscowość           │   │
│ │ ☑ Status       ☑ Telefon       ☐ Email                 │   │
│ │ ☑ Dokumenty    ☐ Usługi        ☐ Data utworzenia       │   │
│ │ ☐ Komentarz    ☐ Folder URL    ☑ Ostatnia aktywność   │   │
│ └─────────────────────────────────────────────────────────┘   │
│ ┌─ Filtr ─────────────────────────────────────────────────┐   │
│ │ Status: [Wszystkie ▼]  Miejscowość: [Wszystkie ▼]      │   │
│ │ Usługa: [Wszystkie ▼]  Data od: [___] do: [___]        │   │
│ └─────────────────────────────────────────────────────────┘   │
│ ┌─ Grupowanie ────────────────────────────────────────────┐   │
│ │ Grupuj po: [Brak ▼]  (Status | Miejscowość | Usługa)   │   │
│ └─────────────────────────────────────────────────────────┘   │
│ [💾 Zapisz jako mój domyślny widok]                          │
├───────────────────────────────────────────────────────────────┤
│ Nazwisko ▼ │ Imię     │ Miejscowość │ Status     │ Dok      │
│ Zapora     │ Wojciech │ Mińsk Maz.  │ 🟡 pomiar  │ 📄📄     │
│ Nowak      │ Anna     │ Warszawa    │ 🟢 umowa   │ 📄       │
│ Kowalski   │ Jan      │ Kraków      │ ⚪ lead    │ —        │
└───────────────────────────────────────────────────────────────┘
```

### 9.3 Konfiguracja per user

- Każdy zalogowany użytkownik ma **własny układ** (kolumny, sortowanie, filtry, tryb widoku)
- Układ zapisywany automatycznie
- Admin może ustawić **domyślny układ** dla nowych użytkowników

### 9.4 Kolumna "Dokumenty" w tabeli

Ikony dokumentów w jednej kolumnie:

```
📄📄📄—📄—    = Pomiar✅ Umowa✅ Gwarancja✅ Odbiór❌ Montażysta✅ Faktura❌
```

Tooltip na hover pokazuje szczegóły. Kliknięcie → otwiera stronę klienta na sekcji dokumentów.

---

## 10. Iteracje Wdrożenia

### Iteracja 1 — MVP (3-4 tygodnie)
- Schema danych + CRUD klientów
- Clerk auth
- Webhook Jotform → tworzenie klienta (pełne dane, widoczność wg statusu)
- Lista klientów — tabela z basic filtrami
- Detail klienta z sekcjami (dane + dokumenty + historia)
- Workflow statusów
- Google Drive OAuth — ekran połączenia
- Tworzenie folderu przy zmianie na "measurement"
- Checkboxy → kopiowanie szablonów (bez mail merge)
- Zapis URL-i

### Iteracja 2 — CRM + Mapper (2-3 tygodnie)
- Konfigurowalny widok klientów (kolumny, sortowanie, filtry, per user)
- Kanban view
- Dynamiczny mapper pól w szablonach
- Mail merge (find & replace w .docx)
- Admin panel: zarządzanie szablonami
- Upload kart gwarancyjnych

### Iteracja 3 — Polish (1-2 tygodnie)
- Widok kart (cards view)
- Grupowanie klientów
- Health check Google Drive + auto-recovery
- Opcjonalna synchronizacja Trello (toggle)
- Dashboard ze statystykami
- Powiadomienia (email)
- Responsywność mobile

---

## 11. Wymagania Niefunkcjonalne

| Wymaganie | Wartość |
|-----------|---------|
| Czas odpowiedzi UI | < 500ms |
| Czas generowania dokumentu | < 10s |
| Czas tworzenia folderu | < 5s |
| Bezpieczeństwo | OAuth tokens encrypted, Clerk auth, webhook secrets, HTTPS |
| Google Drive token renewal | Automatyczne, transparentne |
| Backup | Convex automatic |
| Przeglądarki | Chrome, Edge, Safari (2 ostatnie wersje) |
| Responsywność | Mobile-friendly (handlowcy w terenie) |
| Dane formularza | Przechowywane od momentu wpłynięcia, widoczne wg reguły statusu |

---

## 12. Ryzyka i Mitigacje

| Ryzyko | Mitigacja |
|--------|-----------|
| Google OAuth token revoked | Auto-detect + banner + email do admina |
| Google Drive API rate limits | Queue + retry z backoff |
| Jotform zmieni payload | Schema validation + alert na unknown fields |
| Konwersja .doc → .docx utrata formatowania | Testy na wszystkich szablonach przed Go-Live |
| Duża baza klientów (>10k) | Paginacja + indeksy Convex |
| User zapomni podłączyć Drive | Onboarding wizard: krok 1 = połącz Drive |
