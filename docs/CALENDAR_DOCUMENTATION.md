# Kalendarz Montaży — Dokumentacja

> Harmonogram instalacji okien u klientów: planowanie, podgląd i zmiana terminów montaży w widokach kwartalnym, miesięcznym i tygodniowym.

**Status:** produkcyjny · **Wersja dokumentacji:** 2.0 · **Aktualizacja:** 2026-06-17

---

## Spis treści

1. [Szybki start (dla developera)](#1-szybki-start)
2. [Opis biznesowy](#2-opis-biznesowy)
3. [Architektura](#3-architektura)
4. [Model danych](#4-model-danych)
5. [Backend — Convex API](#5-backend--convex-api)
6. [Frontend — logika komponentu](#6-frontend--logika-komponentu)
7. [Konfiguracja widoków](#7-konfiguracja-widoków)
8. [Workflow użytkownika](#8-workflow-użytkownika)
9. [Ograniczenia i znane problemy](#9-ograniczenia-i-znane-problemy)
10. [Roadmapa](#10-roadmapa)

---

## 1. Szybki start

| Co | Gdzie |
|----|-------|
| Strona | `/admin/montaz` |
| Page (wrapper) | `app/admin/montaz/page.tsx` |
| Główny komponent | `app/admin/panel/InstallationCalendar.tsx` |
| Style kalendarza | `app/globals.css` (sekcje `.fc-multimonth*`, `.fc-fullscreen-calendar`, `.calendar-*`) |
| Dane montaży (query) | `convex/orders.ts:890` — `listByCompletionDateRange` |
| Lista zleceń do przypisania | `convex/orders.ts:166` — `listForPicker` |
| Zapis terminu (mutation) | `convex/orders.ts:281` — `update` |
| Czyszczenie terminu | `convex/orders.ts:329` — `clearInstallationDate` |
| Lista pracowników (filtry) | `convex/users.ts:440` — `listAllActive` |

**Kluczowe stałe** (`InstallationCalendar.tsx:34`):
- `DEFAULT_START_HOUR = 8` — godzina przyjmowana, gdy zlecenie nie ma `installationStart`
- `EVENT_DURATION_HOURS = 1` — stały czas trwania bloku montażu (UI nie pozwala go zmienić)

---

## 2. Opis biznesowy

### 2.1 Cel
Wizualizacja i zarządzanie harmonogramem montaży. Pozwala koordynatorowi szybko zobaczyć obłożenie terminów, zmienić datę/godzinę przez przeciągnięcie i przypisać nowe zlecenie do wolnego dnia.

### 2.2 Funkcjonalności
- **Trzy widoki:** kwartalny (4 miesiące, domyślny), miesięczny, tygodniowy.
- **Drag & drop** — przeciągnięcie karty zmienia datę i godzinę montażu (zapis natychmiastowy).
- **Filtrowanie po pracowniku** — chipy z kolorami; wielokrotny wybór; opcja „Bez przypisania”; wybór zapamiętywany per użytkownik w `localStorage`.
- **Przypisywanie terminu** — klik w dzień otwiera modal z wyszukiwarką zleceń.
- **Podgląd zlecenia** — klik w kartę otwiera kartę zlecenia w nowej zakładce.
- **Tooltip** — szczegóły po najechaniu (tylko widok kwartalny, gdzie karty są malutkie).
- **Pełny ekran** — kwartalny widok rozszerzony na całe okno.

### 2.3 Odbiorcy
Koordynatorzy montaży, kierownicy projektów oraz pracownicy terenowi (podgląd, z filtrem na siebie).

---

## 3. Architektura

Stack: **Next.js (App Router) + React + FullCalendar v6 + Convex + TypeScript + Tailwind**.

```
app/admin/montaz/page.tsx          ← trasa /admin/montaz (cienki wrapper)
└── InstallationCalendar.tsx       ← cała logika i UI
    ├── Toolbar                     ← nawigacja (‹ ›, Dzisiaj), przełącznik widoków, ⛶ pełny ekran
    ├── Chipy filtrów pracowników   ← + „Bez przypisania”
    ├── <FullCalendar>              ← widoki: multiMonth4 / dayGridMonth / timeGridWeek
    ├── Tooltip (portal)            ← tylko multiMonth4
    ├── Modal „Przypisz zlecenie”   ← wyszukiwarka + lista (portal)
    └── Modal pełnoekranowy (portal)← druga instancja FullCalendar (multiMonth4)
```

### Pluginy FullCalendar
`dayGridPlugin`, `timeGridPlugin`, `multiMonthPlugin`, `interactionPlugin` (drag & drop, klikalne daty), locale `pl`.

### Uwaga implementacyjna
FullCalendar jest **zawsze zamontowany** (nie warunkowo renderowany), żeby zmiana zakresu/widoku nie resetowała pozycji. Zmiana widoku używa `key={view}`, co celowo przemontowuje instancję. Wskaźnik „Ładowanie…” jest nakładką (`orders === undefined`), żeby nie odmontowywać kalendarza.

---

## 4. Model danych

Montaż = zlecenie z ustawioną datą montażu. Pola tabeli `orders` istotne dla kalendarza:

| Pole | Typ | Znaczenie |
|------|-----|-----------|
| `completionDate` | `number?` | Data montażu — timestamp lokalnej północy. Indeks: `by_completion_date`. |
| `installationStart` | `number?` | Godzina rozpoczęcia w minutach od północy (np. `480` = 08:00). |
| `assignedUserId` | `Id<"users">?` | Przypisany pracownik (filtrowanie + kolor). |
| `status` | `string` | Status zlecenia (kolor zapasowy, gdy brak koloru pracownika). |
| `clientId` | `Id<"clients">` | Klient (do wyświetlenia nazwy i linku). |
| `name` | `string?` | Numer zlecenia. |
| `customText` | `string?` | Dodatkowa notatka na karcie. |
| `investmentCity` | `string?` | Miasto inwestycji. |

Pola pochodne, doliczane przez query (nie ma ich w tabeli): `clientName`, `assignedUserColor`, `assignedUserName`.

> **Konwersja czas ↔ data** (`InstallationCalendar.tsx:37`):
> - `minsToDate(baseDate, mins)` — łączy timestamp dnia z minutami w lokalny `Date`.
> - `dateToMins(date)` — wyciąga godzinę jako minuty od północy.
> - `localMidnight(date)` — północ **lokalna** danego dnia (nie UTC). To celowe — kalendarz operuje w czasie lokalnym użytkownika.

---

## 5. Backend — Convex API

### 5.1 `listByCompletionDateRange` — dane do kalendarza
`convex/orders.ts:890` · query

```ts
args: { startDate: number, endDate: number }
```
- Pobiera zlecenia z indeksu `by_completion_date` w zakresie `[startDate, endDate]`.
- Dla każdego dolicza `clientName` (firma → nazwa firmy, inaczej `firstName lastName`) oraz kolor/nazwę przypisanego pracownika (`assignedUserName` ← `displayName ?? email`).
- Zwraca m.in.: `_id, completionDate, status, clientId, clientName, name, installationStart, customText, assignedUserId, assignedUserColor, assignedUserName, investmentCity, services`.

> ⚠️ **Brak `requireUser`** — ta query nie weryfikuje zalogowania na poziomie funkcji (w przeciwieństwie do `listForPicker`/`update`). Dostęp jest dziś chroniony tylko przez `middleware.ts` / `AccessGuard`. Patrz [§9.2](#92-bezpieczeństwo--dług-techniczny).

### 5.2 `listForPicker` — zlecenia do modalu przypisywania
`convex/orders.ts:166` · query (`requireUser`)

- Bierze **500** ostatnich zleceń (`order("desc").take(500)`) i odfiltrowuje `status === "archived"`.
- `clientName` budowane jako `lastName firstName` (uwaga: odwrotna kolejność niż w `listByCompletionDateRange` — patrz [§9.2](#92-bezpieczeństwo--dług-techniczny)).
- Zwraca: `_id, clientId, name, customText, status, clientName`.

### 5.3 `update` — zapis terminu i innych pól
`convex/orders.ts:281` · mutation (`requireUser`)

Uniwersalna mutacja zlecenia. Z perspektywy kalendarza istotne:
```ts
{ orderId, completionDate?, installationStart? }   // + wiele pól adresowych/usług
```
- Pomija `undefined` (patchuje tylko przekazane pola); jeśli nic nie zostało — `return` bez zapisu.
- **Zapisuje wpis audytowy** do `clientEvents` (`type: "data_updated"`, lista zmienionych pól). To efekt uboczny, o którym warto wiedzieć przy każdym drag&drop / przypisaniu.

### 5.4 `clearInstallationDate` — zdjęcie z kalendarza
`convex/orders.ts:329` · mutation (`requireUser`)

Czyści `completionDate` i `installationStart` (zlecenie znika z kalendarza) i loguje zdarzenie. Obecnie **nie jest wywoływane z UI kalendarza** — dostępne do użycia z karty zlecenia.

### 5.5 `listAllActive` — pracownicy do filtrów
`convex/users.ts:440` · query (`requireUser`)

Zwraca użytkowników spełniających **wszystkie** warunki: `isActive !== false`, `role != null`, `showInPickers !== false`. Każdy z `_id, displayName, login, color, …`.

---

## 6. Frontend — logika komponentu

### 6.1 Zakres pobieranych danych
Stan `visibleRange` jest aktualizowany w `handleDatesSet` (`InstallationCalendar.tsx:182`) na podstawie aktualnie widocznego zakresu FullCalendar i steruje argumentami `listByCompletionDateRange`. Dzięki temu pobierane są tylko zlecenia z widocznego okresu.

### 6.2 Budowa wydarzeń (`events`)
`InstallationCalendar.tsx:118` — `useMemo` zależny od `orders` i `activeUserFilters`:
1. Filtruje po pracownikach (logika niżej).
2. Liczy `start`/`end` z `completionDate` + `installationStart` (lub `DEFAULT_START_HOUR`), długość = `EVENT_DURATION_HOURS`.
3. Tło/obramowanie wydarzenia są przezroczyste — cały wygląd renderuje `renderEventContent` (własna karta).

### 6.3 Filtrowanie po pracownikach
Stan: `activeUserFilters: Set<string>` (`InstallationCalendar.tsx:87`).
- **Pusty zbiór** → pokaż wszystko.
- **ID-ki** → pokaż tylko przypisane do wybranych.
- **Klucz `"__none__"`** → zlecenia bez `assignedUserId`.
- **Persystencja:** `localStorage["montaz_user_filter_<userId>"]` (zapis w `toggleUserFilter`, odczyt w `useEffect` po zalogowaniu).

### 6.4 Kolory wydarzeń
Priorytet (`renderEventContent`, `InstallationCalendar.tsx:241`):
`assignedUserColor` → `STATUS_COLORS[status]` → `#64748b` (szary domyślny).

```ts
const STATUS_COLORS = {
  lead:"#50253F", inquiry:"#50253F", measurement:"#3E5224", offer:"#50253F",
  contract:"#50253F", production:"#164555", installation:"#533F04",
  complaint:"#533F04", completed:"#37471F",
};
```

### 6.5 Drag & drop
`handleEventDrop` (`InstallationCalendar.tsx:158`) zapisuje **oba** pola jednocześnie:
```ts
updateOrder({ orderId, completionDate: localMidnight(newStart), installationStart: dateToMins(newStart) });
```
Zapis obu pól jest konieczny, by przeniesienie między dniami zachowało spójność daty i godziny.

> Kalendarz ma `editable={true}` i `eventDurationEditable={false}`: przeciągać można we **wszystkich** widokach, ale **nie** rozciągać czasu trwania.

### 6.6 Przypisywanie terminu (modal)
1. `handleDateClick` (`:175`) zapisuje klikniętą datę i otwiera modal.
2. Wyszukiwarka filtruje `allOrders` (z `listForPicker`) po `name`, `clientName`, `customText`, max 20 wyników (`filteredOrders`, `:195`).
3. `handleAssignDate` (`:206`) zapisuje `completionDate` + `installationStart` z wybranej daty.

### 6.7 Klik w wydarzenie
`handleEventClick` (`:170`) otwiera w nowej karcie: `/admin/klient/{clientId}/zlecenie/{orderId}`.

---

## 7. Konfiguracja widoków

Wspólne ustawienia `<FullCalendar>` (`InstallationCalendar.tsx:659`): `locale=pl`, `headerToolbar=false` (własny toolbar), `nowIndicator`, `expandRows`, `eventDisplay="block"`, `allDaySlot=false`, sloty 07:00–18:00.

| Widok | Typ | Cechy |
|-------|-----|-------|
| **Kwartał** (`multiMonth4`) | `multiMonth`, `{months:4}` | Siatka 2×2 (`multiMonthMaxColumns:2`), `fixedWeekCount`, `dayMaxEvents:99` (pokaż wszystko), aktywny tooltip i ⛶ pełny ekran. Karty mikro (font ~7px). |
| **Miesiąc** (`dayGridMonth`) | `dayGrid` | `dayMaxEvents:3` → reszta jako „+X więcej”. |
| **Tydzień** (`timeGridWeek`) | `timeGrid` | `slotDuration:01:00:00`, godziny 07–18, pełne karty z godziną/klientem/miastem/pracownikiem. |

> `dayMaxEvents` i `slotDuration` są ustawiane warunkowo zależnie od `view` (`:686`, `:692`).

**Style:** sekcja kalendarza w `app/globals.css` (od ~`:252`) — kompaktowanie kwartału, grube obramowania między miesiącami (`nth-child(2|3|4)`), hover karty (`.calendar-event-card:hover`), hover przycisku widoku (`.calendar-view-btn:hover`), tryb pełnoekranowy (`.fc-fullscreen-calendar`).

---

## 8. Workflow użytkownika

**Przeglądanie:** wejście na `/admin/montaz` → domyślnie kwartał → nawigacja ‹ ›, „Dzisiaj”, przełącznik widoków.

**Filtrowanie:** klik chip pracownika (wielokrotny), „Bez przypisania”; wybór zapamiętany per użytkownik.

**Zmiana terminu:** złap kartę → przeciągnij na inny dzień/godzinę → puść (zapis natychmiastowy, widoczny w czasie rzeczywistym u wszystkich).

**Przypisanie terminu:** klik w dzień → modal → wyszukaj zlecenie → „Przypisz”.

**Szczegóły zlecenia:** klik w kartę → nowa zakładka z kartą zlecenia.

**Pełny ekran:** (tylko kwartał) przycisk ⛶ → modal na całe okno → ✕ zamyka.

---

## 9. Ograniczenia i znane problemy

### 9.1 Ograniczenia funkcjonalne
- **Czas trwania montażu stały 1h** — `EVENT_DURATION_HOURS`, brak edycji z UI.
- **Modal przypisywania:** baza to 500 ostatnich nie-archiwalnych zleceń, lista pokazuje max 20 dopasowań naraz.
- **Filtr tylko po pracowniku** (nie po statusie).
- **Brak walidacji kolizji** — można nałożyć kilka montaży na ten sam dzień/godzinę.
- **Brak powiadomień** dla pracowników o zmianie terminu.
- **Brak eksportu** (PDF/CSV/iCal).

### 9.2 Bezpieczeństwo / dług techniczny
- **`listByCompletionDateRange` nie woła `requireUser`** — w odróżnieniu od pozostałych funkcji kalendarza. Warto dodać dla spójności (ochrona row-level / na poziomie funkcji). Patrz skill `convex-security-check`.
- **Niespójna kolejność nazwiska:** `listForPicker` buduje `clientName` jako `lastName firstName`, a `listByCompletionDateRange` jako `firstName lastName`. Ten sam klient może wyglądać różnie w modalu i na kalendarzu.
- **Współdzielony `calendarRef`:** instancja zwykła i pełnoekranowa przypisują ten sam `useRef`. Przy otwartym pełnym ekranie ref wskazuje ostatnio zamontowany kalendarz — przyciski toolbaru działają na właściwej instancji tylko dzięki kolejności montowania. Przy zmianach uważać na regresje nawigacji.
- **Wydajność:** przy bardzo gęstych miesiącach (setki zleceń) render kart może zwalniać — `listByCompletionDateRange` robi `get` klienta i użytkownika per zlecenie (N+1).

---

## 10. Roadmapa

- [ ] Dodać `requireUser` do `listByCompletionDateRange`.
- [ ] Ujednolicić format `clientName` między query (wspólny helper).
- [ ] Walidacja / ostrzeżenie o kolizji terminów.
- [ ] Konfigurowalny czas trwania montażu.
- [ ] Filtr po statusie zlecenia + szybki widok „moje montaże”.
- [ ] Powiadomienia (email/SMS) o zmianie terminu.
- [ ] Eksport harmonogramu (PDF/CSV/iCal), integracja z Google Calendar.
- [ ] Przycisk „zdejmij z kalendarza” korzystający z istniejącego `clearInstallationDate`.

---

### Utrzymanie
- **Convex Dashboard:** https://dashboard.convex.dev/t/wojtek-zapora/adk — logi w *Functions*, dane w *Data*.
- **Backup:** automatyczny (Convex) + ręczny eksport z *Data → Export*.
- **Debug:** błędy frontendu w konsoli przeglądarki, błędy backendu w logach Convex.

**Projekt:** GRUPA ADK · **Repo:** `/Users/wojtekzapora/Documents/ADK/ADKokna` · **Plik:** `docs/CALENDAR_DOCUMENTATION.md`
