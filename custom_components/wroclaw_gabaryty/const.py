"""Stałe dla integracji Wrocław Gabaryty (Ekosystem)."""

from datetime import timedelta

DOMAIN = "wroclaw_gabaryty"
DEFAULT_NAME = "Wrocław Gabaryty w okolicy"

# Endpoint Ekosystem Wrocław
EKOSYSTEM_AJAX_URL = "https://gabaryty.ekosystem.wroc.pl/wp-admin/admin-ajax.php"

# Endpoint OSRM (OpenStreetMap Routing Machine) - darmowe wyznaczanie trasy autem
OSRM_TABLE_URL = "https://router.project-osrm.org/table/v1/driving"

# Domyślne wartości konfiguracyjne
DEFAULT_LATITUDE = 51.160227
DEFAULT_LONGITUDE = 16.873181
DEFAULT_RADIUS_KM = 5.0
DEFAULT_DAYS_AHEAD = 30
DEFAULT_MAX_ITEMS = 30
DEFAULT_INCLUDE_ADDITIONAL = True

# Kontener stoi na miejscu przez 3 dni od daty podstawienia (zgodnie z map.js Ekosystemu)
CONTAINER_ACTIVE_DAYS = 3

# Częstotliwość odświeżania danych (co 6 godzin)
SCAN_INTERVAL = timedelta(hours=6)

# Klucze konfiguracji
CONF_LATITUDE = "latitude"
CONF_LONGITUDE = "longitude"
CONF_RADIUS_KM = "radius_km"
CONF_DAYS_AHEAD = "days_ahead"
CONF_MAX_ITEMS = "max_items"
CONF_INCLUDE_ADDITIONAL = "include_additional"

