# Wrocław Gabaryty (Ekosystem + OSRM)

Komponent integracyjny oraz dedykowana karta Lovelace dla Home Assistant pobierająca harmonogram podstawień kontenerów na odpady wielkogabarytowe we Wrocławiu z oficjalnego serwisu `gabaryty.ekosystem.wroc.pl`.

### Główne cechy:
- 🚛 **Automatyczny harmonogram** – pobiera aktualne punkty podstawienia kontenerów (zarówno planowe, jak i zlecenia dodatkowe).
- 📍 **Filtr promienia od Twojego domu** – domyślnie 5 km (konfigurowalny w UI).
- 🚗 **Wyznaczanie realnej trasy i czasu dojazdu autem** – za pomocą bezpłatnego silnika OSRM (OpenStreetMap Routing Machine) bez konieczności posiadania kluczy API.
- 🗺️ **Bezpośrednie linki nawigacji** – przyciski jednym kliknięciem otwierają trasę z domu do kontenera w Google Maps oraz OpenStreetMap.
- 🖥️ **Wbudowana karta Lovelace** – karta ładuje się automatycznie po instalacji integracji, oferując klikalne sortowanie po dacie lub dystansie, filtr "Tylko aktywne dziś" oraz wyszukiwarkę ulic.

