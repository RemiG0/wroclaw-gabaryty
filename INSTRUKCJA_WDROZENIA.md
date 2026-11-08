# Instrukcja wdrożenia i instalacji integracji Wrocław Gabaryty (HACS & Manualnie)

Niniejszy dokument opisuje kompletną procedurę przygotowania repozytorium GitHub, instalacji komponentu za pomocą **HACS** (Home Assistant Community Store) oraz konfiguracji karty w Dashboardzie Lovelace.

---

## 1. Architektura repozytorium dla HACS

Projekt został przygotowany zgodnie ze standardem HACS dla integracji (`integration`). Struktura plików w repozytorium:

```text
├── .gitignore                          # Ignoruje pliki lokalne (.env, cache, podgląd)
├── hacs.json                           # Metadane informujące HACS o strukturze integracji
├── info.md                             # Krótki opis wyświetlany w HACS
├── README.md                           # Główny opis projektu renderowany w HACS
├── examples_ha.yaml                    # Gotowe przykłady kart i automatyzacji
├── custom_components/
│   └── wroclaw_gabaryty/
│       ├── __init__.py                 # Rejestracja sensora i automatyczne ładowanie karty
│       ├── config_flow.py              # Kreator konfiguracji w UI
│       ├── const.py                    # Stałe (promień, horyzont dni, endpointy)
│       ├── coordinator.py              # Pobieranie danych z Ekosystemu + routing OSRM
│       ├── manifest.json               # Manifest integracji Home Assistant
│       ├── sensor.py                   # Encje sensorów (tabela i najbliższy punkt)
│       ├── frontend/
│       │   └── wroclaw-gabaryty-card.js # Dedykowana karta JS (wbudowana w integrację)
│       └── translations/
│           ├── pl.json                 # Tłumaczenie PL
│           └── en.json                 # Tłumaczenie EN
└── www/
    └── wroclaw-gabaryty-card.js        # Kopia karty dla instalacji manualnych (/local/)
```

> [!NOTE]
> **Dlaczego karta JS znajduje się wewnątrz `custom_components/wroclaw_gabaryty/frontend/`?**
> Standardowo HACS instaluje tylko folder `custom_components/<domena>`. Dzięki umieszczeniu pliku karty wewnątrz integracji oraz zastosowaniu mechanizmu `async_register_static_paths` i `add_extra_js_url` w `__init__.py`, **karta Lovelace ładuje się automatycznie od razu po instalacji integracji z HACS** – bez konieczności ręcznego kopiowania plików do folderu `www` ani ręcznego rejestrowania zasobów w Lovelace.

---

## 2. Publikacja repozytorium na GitHub

Aby móc dodać integrację do HACS jako repozytorium niestandardowe, umieść ten projekt na swoim koncie GitHub:

### Krok 2.1: Utworzenie nowego repozytorium na GitHub
1. Zaloguj się na [GitHub](https://github.com).
2. Kliknij **New repository** (lub `+` w prawym górnym rogu).
3. Nazwij repozytorium, np. `wroclaw-gabaryty` (lub `ha-wroclaw-gabaryty`).
4. Ustaw repozytorium jako **Public** (HACS wymaga publicznego repozytorium do pobierania wydań).
5. **Nie** zaznaczaj opcji dodawania README, .gitignore ani licencji (pliki te znajdują się już w projekcie).
6. Kliknij **Create repository**.

### Krok 2.2: Wypchnięcie plików z lokalnego katalogu
Otwórz terminal w katalogu projektu (`/Users/remi/Library/CloudStorage/OneDrive-Osobisty/Dokumenty/Esens/Gabaryty`) i wykonaj polecenia:

```bash
# 1. Inicjalizacja repozytorium git
git init

# 2. Dodanie plików (plik .gitignore zabezpiecza przed dodaniem .env)
git add .

# 3. Pierwszy commit
git commit -m "Initial commit: Wroclaw Gabaryty HA integration and Lovelace card"

# 4. Ustawienie głównej gałęzi
git branch -M main

# 5. Podpięcie Twojego zdalnego repozytorium (zamień YOUR_USERNAME i REPO_NAME)
git remote add origin https://github.com/YOUR_USERNAME/wroclaw-gabaryty.git

# 6. Wypchnięcie do GitHub
git push -u origin main
```

### Krok 2.3: Utworzenie pierwszego wydania (Release) na GitHub
HACS rekomenduje wersjonowanie wydań:
1. W swoim repozytorium na GitHubie kliknij po prawej stronie **Releases** → **Create a new release**.
2. W polu **Choose a tag** wpisz: `v1.0.0` (i kliknij *Create new tag*).
3. Jako **Release title** wpisz: `v1.0.0 – Pierwsze wydanie`.
4. Kliknij **Publish release**.

---

## 3. Instalacja przez HACS w Home Assistant

Gdy repozytorium znajduje się na GitHubie:

1. Otwórz swój Home Assistant i przejdź do zakładki **HACS**.
2. Kliknij **trzy kropki** w prawym górnym rogu ekranu i wybierz **Niestandardowe repozytoria** (*Custom repositories*).
3. W formularzu:
   - **Repozytorium:** wklej adres URL swojego repozytorium, np. `https://github.com/YOUR_USERNAME/wroclaw-gabaryty`
   - **Typ / Kategoria:** wybierz **Integracja** (*Integration*)
4. Kliknij **Dodaj** (*Add*).
5. Znajdź nowo dodaną pozycję **Wrocław Gabaryty (Ekosystem)** na liście HACS i kliknij **Pobierz** (*Download*).
6. Po pobraniu zrestartuj Home Assistant (**Ustawienia → System → Uruchom ponownie**).

---

## 4. Konfiguracja integracji w Home Assistant

Po restarcie Home Assistanta:

1. Przejdź do **Ustawienia → Urządzenia oraz usługi → Dodaj integrację**.
2. Wyszukaj **Wrocław Gabaryty (Ekosystem)**.
3. W formularzu konfiguracji:
   - **Szerokość i długość geograficzna:** domyślnie podstawią się współrzędne Twojego domu zdefiniowane w strefie `zone.home`.
   - **Promień wyszukiwania wokół domu (km):** domyślnie `5.0` km (możesz zmienić np. na `3.0` lub `10.0`).
   - **Zakres dni w przód:** domyślnie `30` dni.
   - **Maksymalna liczba punktów w tabeli:** domyślnie `30`.
   - **Uwzględnij podstawienia dodatkowe:** zaznaczone (`Tak`).
4. Kliknij **Zatwierdź**.

### Utworzone encje:
- `sensor.gabaryty_w_okolicy` – główny sensor przechowujący liczbę punktów oraz pełną listę z odległościami dojazdu autem i linkami do map.
- `sensor.najblizszy_kontener_na_gabaryty` – sensor ze stanem wskazującym najbliższy kontener (do powiadomień i automatyzacji).

---

## 5. Dodanie karty tabeli do Dashboardu Lovelace

Dzięki wbudowanemu loaderowi frontendowemu, karta jest rejestrowana automatycznie.

1. Przejdź do swojego Dashboardu i kliknij **Edytuj dashboard** (ołówek lub trzy kropki → Edytuj).
2. Kliknij **+ Dodaj kartę**.
3. Wyszukaj na liście kartę **Wrocław Gabaryty – Tabela w okolicy** lub na samym dole wybierz **Ręczna (Manual)** i wklej poniższy kod YAML:

```yaml
type: custom:wroclaw-gabaryty-card
entity: sensor.gabaryty_w_okolicy
title: Wywóz gabarytów w okolicy (5 km)
default_sort: date
```

### Opcje karty:
- `title` – nagłówek wyświetlany na karcie (domyślnie: *Wywóz gabarytów w okolicy*).
- `default_sort` – domyślne sortowanie przy otwarciu karty:
  - `date` – wg terminu podstawienia (aktywne dziś na samej górze),
  - `drive` – wg najkrótszej trasy dojazdu autem (OSRM),
  - `straight` – wg odległości w linii prostej.

---

## 6. Zapasowa procedura wdrożenia manualnego (bez HACS)

Gdybyś chciał wdrożyć integrację na innym Home Assistancie bez użycia HACS:

1. **Skopiowanie plików integracji:**
   Skopiuj katalog `custom_components/wroclaw_gabaryty` na serwer HA do:
   `/config/custom_components/wroclaw_gabaryty/`
2. **Skopiowanie pliku karty JS:**
   Skopiuj `www/wroclaw-gabaryty-card.js` do:
   `/config/www/wroclaw-gabaryty-card.js`
3. **Rejestracja zasobu (jeśli nie ładuje się automatycznie):**
   W HA przejdź do **Ustawienia → Dashboardy → Trzy kropki → Zasoby → Dodaj zasób**:
   - URL: `/local/wroclaw-gabaryty-card.js?v=1.0.0`
   - Typ zasobu: `Moduł JavaScript`
4. **Restart Home Assistant Core:**
   Zrestartuj HA i dodaj integrację w *Urządzenia oraz usługi*.

