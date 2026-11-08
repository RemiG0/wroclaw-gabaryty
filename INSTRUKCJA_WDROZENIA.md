# Instrukcja wdrożenia i instalacji: Wrocław Gabaryty (GitLab & HACS)

Projekt został zainicjalizowany i opublikowany w Twoim serwisie GitLab pod adresem:
👉 **[https://gitlab.gasiorowscy.pl/Remi/wroclaw-gabaryty](https://gitlab.gasiorowscy.pl/Remi/wroclaw-gabaryty)**

---

## 1. Ważna informacja o HACS a własnym serwerze GitLab

Home Assistant Community Store (**HACS**) wewnętrznie korzysta z biblioteki `aiogithubapi` i do pobierania niestandardowych repozytoriów (*Custom Repositories*) wymaga adresu w formacie API GitHub (`https://github.com/owner/repo`). HACS nie potrafi odpytywać API prywatnych/samodzielnie hostowanych instancji GitLab o wydania i archiwa zip.

### Rozwiązanie idealne (GitLab jako główne źródło + Mirror do GitHub dla HACS):
Nie musisz rezygnować ze swojego GitLaba! Standardową i najwygodniejszą praktyką jest:
1. Pracujesz i wysyłasz commity (`git push`) wyłącznie na swój **GitLab** (`gitlab.gasiorowscy.pl`).
2. Włączasz w GitLabie funkcję **Repository Mirroring** (automatyczne lustro), która natychmiast kopiuje każdą zmianę na darmowe repozytorium GitHub.
3. W **HACS** wskazujesz link do GitHuba – dzięki temu instalacja i aktualizacje jednym kliknięciem działają perfekcyjnie.

---

## 2. Stan repozytorium na Twoim GitLabie

Repozytorium jest już utworzone, zawiera pierwszy commit oraz otagowaną wersję **v1.0.0**:

- **URL projektu w przeglądarce:** `https://gitlab.gasiorowscy.pl/Remi/wroclaw-gabaryty`
- **Klonowanie HTTPS:** `https://gitlab.gasiorowscy.pl/Remi/wroclaw-gabaryty.git`
- **Klonowanie SSH:** `ssh://git@gitlab.gasiorowscy.pl:2222/Remi/wroclaw-gabaryty.git`

Plik `.gitignore` automatycznie wyklucza pliki `.env`, dane testowe i lokalne logi, dzięki czemu Twoje hasła i dane logowania **nie zostały** wysłane do repozytorium.

---

## 3. Konfiguracja automatycznego lustra GitLab ➔ GitHub (dla HACS)

Aby HACS mógł instalować komponent z Twojego repozytorium:

### Krok 3.1: Utworzenie pustego repozytorium na GitHub
1. Zaloguj się na [GitHub](https://github.com) i kliknij **New repository**.
2. Nazwij je np. `wroclaw-gabaryty` i ustaw jako **Public**.
3. **Nie** dodawaj README ani innych plików (repozytorium musi być puste).

### Krok 3.2: Wygenerowanie tokenu Personal Access Token na GitHub
1. Na GitHubie wejdź w **Settings → Developer Settings → Personal access tokens → Tokens (classic)**.
2. Kliknij **Generate new token (classic)**, nazwij go np. `GitLab Mirror`, zaznacz uprawnienie **`repo`** (pełny dostęp do repozytoriów) i zapisz wygenerowany token.

### Krok 3.3: Włączenie Mirroringu w GitLabie
1. Wejdź do swojego projektu na GitLabie:
   `https://gitlab.gasiorowscy.pl/Remi/wroclaw-gabaryty/-/settings/repository`
2. Rozwiń sekcję **Mirroring repositories**.
3. Wypełnij pola:
   - **Git repository URL:** `https://TWÓJ_LOGIN_GITHUB@github.com/TWÓJ_LOGIN_GITHUB/wroclaw-gabaryty.git`
   - **Mirror direction:** `Push`
   - **Authentication method:** `Password`
   - **Password:** wklej token wygenerowany w kroku 3.2.
4. Kliknij **Mirror repository**.

Od tego momentu każdy `git push` na `gitlab.gasiorowscy.pl` automatycznie zsynchronizuje się z GitHubem!

---

## 4. Dodanie i instalacja w HACS

Gdy repozytorium jest zsynchronizowane z GitHubem:

1. W Home Assistant otwórz **HACS**.
2. W prawym górnym rogu kliknij **trzy kropki** → **Niestandardowe repozytoria** (*Custom repositories*).
3. Podaj adres: `https://github.com/TWÓJ_LOGIN_GITHUB/wroclaw-gabaryty` i wybierz kategorię **Integracja** (*Integration*).
4. Kliknij **Dodaj**, znajdź integrację na liście i kliknij **Pobierz** (*Download*).
5. Zrestartuj Home Assistant (**Ustawienia → System → Uruchom ponownie**).

> [!TIP]
> **Automatyczne ładowanie karty JS:**
> Integracja ma wbudowaną kartę `wroclaw-gabaryty-card.js` wewnątrz folderu `custom_components/wroclaw_gabaryty/frontend/` i automatycznie rejestruje ją w zasobach Lovelace (`add_extra_js_url`). Po instalacji przez HACS nie musisz kopiować żadnych plików do katalogu `www` ani dodawać ręcznie zasobów w ustawieniach dashboardu!

---

## 5. Dodanie karty na Dashboard

W swoim dashboardzie dodaj kartę jako **Ręczna (Manual)** lub wybierz z listy:

```yaml
type: custom:wroclaw-gabaryty-card
entity: sensor.gabaryty_w_okolicy
title: Wywóz gabarytów w okolicy (5 km)
default_sort: date
```

---

## 6. Alternatywa: Aktualizacja bezpośrednio z GitLaba (bez GitHuba i HACS)

Jeśli wolisz całkowicie pominąć GitHub i HACS, możesz aktualizować komponent bezpośrednio z Twojego serwera GitLab za pomocą prostego polecenia w Home Assistant (lub GitLab CI/CD):

Na serwerze Home Assistant (`10.11.0.44`):
```bash
# Klonowanie / aktualizacja bezpośrednio z Twojego GitLaba
git clone https://gitlab.gasiorowscy.pl/Remi/wroclaw-gabaryty.git /tmp/gabaryty_repo
cp -r /tmp/gabaryty_repo/custom_components/wroclaw_gabaryty /config/custom_components/
rm -rf /tmp/gabaryty_repo
ha core restart
```
Można to również podpiąć jako skrypt shell w Home Assistant (`shell_command`) lub pipeline `.gitlab-ci.yml`.
