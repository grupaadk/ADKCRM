# Dokumentacja: Kanban Dashboard (`/admin/dashboard`)

Poniższy dokument stanowi podsumowanie wszystkich ustaleń, funkcjonalności oraz zasad działania tablicy Kanban (Dashboardu Zadań) w aplikacji ADKokna, które zostały zaimplementowane i dopracowane.

## 1. Wygląd i układ
* **Zgodność stylistyczna:** Interfejs został zaprojektowany z zachowaniem 1:1 stylistyki z `/admin/panel` (m.in. kolor główny `#4abbc3`, spójne zaokrąglenia, cienie).
* **Kolumny rozciągnięte w dół:** Kolumny zawsze rozciągają się do samego dołu kontenera (na wysokość najwyższej kolumny), co pozwala na bezproblemowe upuszczanie zadań "w pustej przestrzeni" na dole listy.
* **Nawigacja:** Tablica scrolluje się horyzontalnie, co wspierają przyciski ze strzałkami (`<` i `>`) nad listą.

## 2. Tworzenie i dodawanie zadań
* **Lokalizacja przycisku "Dodaj kartę":** Przycisk oraz pole szybkiego dodawania zadania (inline) znajdują się zawsze **na samej górze** listy – bezpośrednio pod kolorowym nagłówkiem kolumny.
* **Rozwijanie menu (Dropdown):** Menu wyboru typu nowej karty (Do zlecenia / Do szansy / Zadanie) rozwija się w dół (aby nie zasłaniać nagłówka kolumny).
* **Przynależność do kolumny:** Zadanie dodane z menu konkretnej kolumny (zarówno inline „Zadanie", jak i „Do zlecenia"/„Do szansy" przez panel) otrzymuje `columnId` tej kolumny i pojawia się dokładnie w niej (niezależnie od terminu). Dodawanie przez przycisk „Dodaj zadanie" w nagłówku nie ustawia `columnId` — zadanie trafia do kolumny wg terminu (lub „Todo lista", gdy brak terminu).
* **Domyślny użytkownik:** Nowo tworzone zadania bezpośrednio z listy (inline) są z automatu przypisywane do aktualnie zalogowanego użytkownika, który je tworzy.
* **Data wykonania (Termin):** Przy szybkim dodawaniu zadania z poziomu listy, data zadania nie jest ustawiana z góry (wartość domyślna to brak daty). Termin można określić później w szczegółach zadania.
* **Osoby przypisane (UI):** Informacja o osobach przypisanych jest wyraźnie reprezentowana za pomocą większych i wyraźniejszych okrągłych awatarów (inicjałów) na kartach, z widocznym kolorem przypisanym do użytkownika. W razie braku wyświetlana jest szara etykieta "Nieprzypisane".

## 3. Przesuwanie i bezpieczeństwo (Drag & Drop)
* **Zabezpieczenie kolumn:** Zmiana położenia (przesunięcie) całej listy (kolumny) jest domyślnie zablokowana, co zapobiega przypadkowym zmianom układu. Aby przesunąć listę, admin musi ją najpierw odblokować klikając w **ikonkę kłódki** (Lock/Unlock) w prawym górnym rogu nagłówka kolumny.
* **Edycja i usuwanie po odblokowaniu:** Po odblokowaniu listy (kłódka otwarta) admin dodatkowo może:
  * **Zmienić nazwę listy** — tytuł w nagłówku zamienia się w edytowalne pole (zatwierdzenie: Enter lub utrata fokusu, anulowanie: Escape). Backend: `taskColumns.rename`.
  * **Usunąć listę** — przycisk kosza obok kłódki. Usunięcie jest blokowane, jeśli lista zawiera zadania przypisane przez `columnId` (`taskColumns.remove` rzuca błąd). Uwaga: kolumny systemowe (datowe) grupują zadania po dacie, więc ich usunięcie może „osierocić" zadania z danego dnia.
* **Swobodne przesuwanie kart:** Mimo blokady kolumn, same karty z zadaniami mogą być swobodnie przesuwane pomiędzy listami bez żadnych dodatkowych zabezpieczeń (dzięki zatrzymaniu propagacji eventów karty nie porywają za sobą całej kolumny).

## 4. Priorytety Zadań i Sortowanie
* **Sortowanie zadań w listach:** 
  1. W pierwszej kolejności na samej górze listy zawsze znajdują się zadania z priorytetem **Wysokim**.
  2. Następnie zadania są sortowane według terminu (najbliższe na górze). Zadania bez przypisanej daty spadają na dół tej grupy.
* **Zarządzanie priorytetem (Ikona Płomienia 🔥):** 
  * Ikona płomienia znajduje się w prawym górnym rogu każdej karty i działa jako klikalny przełącznik (zawsze widoczny, nie znika).
  * *Brak priorytetu:* Ikonka jest ciemnoszara i wyraźnie widoczna (po najechaniu delikatnie podświetlona).
  * *Wysoki priorytet:* Ikonka zyskuje czerwoną obwódkę oraz pomarańczowe wypełnienie (`#f97316`), co imituje prawdziwy płomień. Po kliknięciu zadanie od razu ląduje na górze listy.
* W edycji zadania (po kliknięciu w kartę) również można przełączać status Wysokiego Priorytetu, używając dedykowanego przycisku obok wyboru statusu kolumny.

## 5. Dostępność skrótów
* Ikonka przejścia do szczegółów ("otwórz" zewnętrzny link m.in. dla zlecenia czy szansy) jest na stałe widoczna obok ikony priorytetu – nie znika w sytuacji, gdy użytkownik zdejmie z niej kursor. 

## 6. Realizacja zadań, Worek i Archiwum
* **Realizacja zadania (ikona ✓):** Każda karta ma w prawym górnym rogu przycisk "Oznacz jako zrealizowane". Po kliknięciu zadanie zmienia status na `done` i znika z listy, trafiając do "Worka" swojej kolumny.
* **Worek (per kolumna):** Na dole każdej kolumny znajduje się zwijana sekcja "Worek (n)" (ikona torby), która zbiera zrealizowane zadania tej kolumny. Najświeżej zamknięte są na górze. Kliknięcie w wiersz otwiera szczegóły zadania.
* **Archiwizacja:** Każde zadanie w Worku ma przycisk archiwizacji (ikona archiwum). Po kliknięciu zadanie znika z tablicy i Worka, trafiając do Archiwum.
* **Widok Archiwum:** Przycisk "Archiwum" w nagłówku (obok "Dodaj zadanie", z ikoną archiwum i licznikiem) przełącza cały ekran `/admin/dashboard` na listę zarchiwizowanych zadań. Z tego widoku można wrócić przyciskiem "Wróć do tablicy", a pojedyncze zadania przywrócić przyciskiem "Przywróć" (wracają wtedy do Worka swojej kolumny).
* **Model danych:** W tabeli `orderTasks` pola `completedAt` (znacznik realizacji), `archived` (flaga) i `archivedAt` (znacznik archiwizacji). Realizacja i archiwizacja obsługiwane przez `orderTasks.update`.
