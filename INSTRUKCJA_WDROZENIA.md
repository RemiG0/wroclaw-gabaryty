# Instrukcja wdrożenia i instalacji: Wrocław Gabaryty (GitHub / HACS)

Projekt jest dostępny w repozytorium GitHub:
👉 **[https://github.com/RemiG0/wroclaw-gabaryty](https://github.com/RemiG0/wroclaw-gabaryty)**

oraz w Twoim lokalnym GitLabie:
👉 **[https://gitlab.gasiorowscy.pl/Remi/wroclaw-gabaryty](https://gitlab.gasiorowscy.pl/Remi/wroclaw-gabaryty)**

---

## 1. Jak zainstalować integrację za pomocą HACS

1. Otwórz swój Home Assistant i przejdź do zakładki **HACS**.
2. Kliknij **trzy kropki** w prawym górnym rogu ekranu i wybierz **Niestandardowe repozytoria** (*Custom repositories*).
3. W formularzu:
   - **Repozytorium:** wklej adres `https://github.com/RemiG0/wroclaw-gabaryty`
   - **Typ / Kategoria:** wybierz **Integracja** (*Integration*)
4. Kliknij **Dodaj** (*Add*).
5. Znajdź pozycję **Wrocław Gabaryty (Ekosystem)** na liście i kliknij **Pobierz** (*Download*).
6. Po pobraniu zrestartuj Home Assistant (**Ustawienia → System → Uruchom ponownie**).

> [!TIP]
> **Karta Lovelace ładuje się automatycznie!**
> Karta `wroclaw-gabaryty-card.js` jest wbudowana w integrację (`frontend/wroclaw-gabaryty-card.js`) i rejestruje się sama w interfejsie HA. Nie trzeba ręcznie kopiować żadnych plików ani dodawać wpisów w zasobach Lovelace!

---

## 2. Konfiguracja w Home Assistant

1. Po restarcie przejdź do **Ustawienia → Urządzenia oraz usługi → Dodaj integrację**.
2. Wyszukaj **Wrocław Gabaryty (Ekosystem)**.
3. Współrzędne Twojego domu pobiorą się automatycznie z Home Assistant (`zone.home`), a promień domyślnie ustawi się na **5 km**.
4. Utworzą się dwie encje:
   - `sensor.gabaryty_w_okolicy` – lista zaplanowanych kontenerów wraz z odległościami dojazdu autem (OSRM) i linkami do tras w Google Maps / OSM.
   - `sensor.najblizszy_kontener_na_gabaryty` – najbliższy kontener od domu.

---

## 3. Dodanie karty na Dashboard

Wklej w edytorze karty (lub wybierz z listy wizualnej):

```yaml
type: custom:wroclaw-gabaryty-card
entity: sensor.gabaryty_w_okolicy
title: Wywóz gabarytów w okolicy (5 km)
default_sort: date
```
