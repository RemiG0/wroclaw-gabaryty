# Wrocław Gabaryty (Ekosystem + OSRM) dla Home Assistant

Niestandardowa integracja (`custom_components/wroclaw_gabaryty`) oraz dedykowana karta Lovelace (`www/wroclaw-gabaryty-card.js`) dla Home Assistant. Pobiera aktualny harmonogram podstawień kontenerów na odpady wielkogabarytowe z `https://gabaryty.ekosystem.wroc.pl`, filtruje punkty w promieniu **5 km** od domu, oblicza realny dystans oraz czas dojazdu autem za pomocą darmowego **OSRM (OpenStreetMap)** i generuje bezpośrednie linki do nawigacji w **Google Maps** oraz **OpenStreetMap**.

---

## Zawartość projektu

```text
Gabaryty/
├── custom_components/
│   └── wroclaw_gabaryty/          # Integracja backendowa dla Home Assistant
│       ├── __init__.py
│       ├── config_flow.py         # Konfiguracja z poziomu UI (promień 5 km, dni, współrzędne)
│       ├── const.py
│       ├── coordinator.py         # Pobieranie z Ekosystemu + wyznaczanie trasy w OSRM
│       ├── manifest.json
│       ├── sensor.py              # Encje sensorów z listą kontenerów i najbliższym punktem
│       └── translations/
│           ├── pl.json
│           └── en.json
├── www/
│   └── wroclaw-gabaryty-card.js   # Dedykowana karta tabeli dla Dashboardu Lovelace
├── test_gabaryty.py               # Skrypt testowy + generator podglądu HTML
└── preview.html                   # Wygenerowany podgląd działania karty na żywych danych
```

---

## Instrukcja instalacji w Home Assistant

### Krok 1: Skopiowanie integracji backendowej
1. Skopiuj katalog `custom_components/wroclaw_gabaryty` do katalogu `/config/custom_components/wroclaw_gabaryty` na swoim serwerze Home Assistant.
2. Zrestartuj Home Assistant (**Ustawienia → System → Uruchom ponownie**).

### Krok 2: Dodanie integracji w interfejsie Home Assistant
1. Przejdź do **Ustawienia → Urządzenia oraz usługi → Dodaj integrację**.
2. Wyszukaj **Wrocław Gabaryty (Ekosystem)**.
3. W formularzu domyślnie podstawią się współrzędne Twojego domu z Home Assistant (`zone.home`) oraz promień **5.0 km**:
   - **Szerokość / długość geograficzna domu**: współrzędne GPS Twojego domu.
   - **Promień wyszukiwania wokół domu (km)**: `5.0` (możesz zmienić w dowolnym momencie w *Konfiguruj*).
   - **Zakres dni w przód**: `30`.
   - **Maksymalna liczba punktów w tabeli**: `30`.
   - **Uwzględnij podstawienia dodatkowe**: `Tak`.
4. Po zatwierdzeniu utworzą się dwie encje:
   - `sensor.wroclaw_gabaryty_w_okolicy_gabaryty_w_okolicy` (lub `sensor.gabaryty_w_okolicy` – główny sensor z atrybutem `containers` dla karty tabeli).
   - `sensor.wroclaw_gabaryty_w_okolicy_najblizszy_kontener_na_gabaryty` (sensor tekstowy z najbliższym punktem – przydatny do automatyzacji i powiadomień na telefon).

### Krok 3: Instalacja dedykowanej karty JS (`wroclaw-gabaryty-card.js`)
1. Skopiuj plik `www/wroclaw-gabaryty-card.js` do katalogu `/config/www/wroclaw-gabaryty-card.js` w Home Assistant.
2. Zarejestruj zasób w Lovelace:
   - Przejdź do **Ustawienia → Dashboardy → (trzy kropki w prawym górnym rogu) → Zasoby → Dodaj zasób**.
   - **Adres URL:** `/local/wroclaw-gabaryty-card.js?v=1.0.0`
   - **Typ zasobu:** `Moduł JavaScript`
3. Odśwież przeglądarkę (`Ctrl+F5` / `Cmd+Shift+R`).

### Krok 4: Dodanie karty do Dashboardu
Możesz wybrać kartę **Wrocław Gabaryty – Tabela w okolicy** z wizualnego selektora kart lub wkleić konfigurację YAML:

```yaml
type: custom:wroclaw-gabaryty-card
entity: sensor.wroclaw_gabaryty_w_okolicy_gabaryty_w_okolicy
title: Wywóz gabarytów w okolicy (5 km)
default_sort: date
```

*(Sprawdź dokładny identyfikator utworzonej encji w **Narzędzia deweloperskie → Stany**, wpisując `gabaryty`).*

---

## Funkcje karty `wroclaw-gabaryty-card.js`
- **Przełączanie sortowania jednym kliknięciem:**
  - **Wg daty** – najpierw kontenery aktualnie stojące i z najbliższą datą podstawienia, a w ramach tej samej daty posortowane od najbliższego dojazdu autem.
  - **Wg trasy autem** – od najkrótszej trasy drogowej wyliczonej przez OSRM.
  - **W linii prostej** – od najmniejszej odległości geograficznej w linii prostej.
- **Filtr „Tylko aktywne dziś”** – pokazuje wyłącznie kontenery, które aktualnie stoją (pamiętając o zasadzie Ekosystemu, że kontener stoi przez **3 dni** od daty podstawienia).
- **Wyszukiwarka ulic** – błyskawiczne filtrowanie tabeli po nazwie ulicy.
- **Bezpośrednie przyciski nawigacji:**
  - `🗺️ Google` – otwiera wyznaczoną trasę samochodową z domu do kontenera w Google Maps.
  - `🧭 OSM` – otwiera wyznaczoną trasę samochodową w OpenStreetMap (OSRM Car).

---

## Test lokalny bez Home Assistant
W katalogu projektu znajduje się skrypt `test_gabaryty.py`, który możesz uruchomić dla dowolnych współrzędnych GPS swojego domu:

```bash
python3 test_gabaryty.py --lat 51.1079 --lng 17.0385 --radius 5.0 --cache ""
```

Skrypt pobierze świeże dane z `gabaryty.ekosystem.wroc.pl`, wyliczy trasy przez OSRM i zaktualizuje plik `preview.html`, który możesz otworzyć bezpośrednio w przeglądarce.

