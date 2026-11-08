"""Inicjalizacja integracji Wrocław Gabaryty (Ekosystem)."""

from __future__ import annotations

import logging
from pathlib import Path
import shutil

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

CARD_URL = "/wroclaw_gabaryty/wroclaw-gabaryty-card.js"

from .const import (
    CONF_DAYS_AHEAD,
    CONF_INCLUDE_ADDITIONAL,
    CONF_LATITUDE,
    CONF_LONGITUDE,
    CONF_MAX_ITEMS,
    CONF_RADIUS_KM,
    DEFAULT_DAYS_AHEAD,
    DEFAULT_INCLUDE_ADDITIONAL,
    DEFAULT_LATITUDE,
    DEFAULT_LONGITUDE,
    DEFAULT_MAX_ITEMS,
    DEFAULT_RADIUS_KM,
    DOMAIN,
)
from .coordinator import WroclawGabarytyCoordinator

PLATFORMS: list[Platform] = [Platform.SENSOR]


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Skonfiguruj integrację Wrocław Gabaryty z wpisu ConfigEntry."""
    hass.data.setdefault(DOMAIN, {})

    cfg = {**entry.data, **entry.options}
    home_lat = float(cfg.get(CONF_LATITUDE) or DEFAULT_LATITUDE)
    home_lng = float(cfg.get(CONF_LONGITUDE) or DEFAULT_LONGITUDE)
    coordinator = WroclawGabarytyCoordinator(
        hass=hass,
        home_lat=home_lat,
        home_lng=home_lng,
        radius_km=float(cfg.get(CONF_RADIUS_KM, DEFAULT_RADIUS_KM)),
        days_ahead=int(cfg.get(CONF_DAYS_AHEAD, DEFAULT_DAYS_AHEAD)),
        max_items=int(cfg.get(CONF_MAX_ITEMS, DEFAULT_MAX_ITEMS)),
        include_additional=bool(
            cfg.get(CONF_INCLUDE_ADDITIONAL, DEFAULT_INCLUDE_ADDITIONAL)
        ),
    )

    await coordinator.async_config_entry_first_refresh()

    hass.data[DOMAIN][entry.entry_id] = coordinator
    entry.async_on_unload(entry.add_update_listener(_async_update_listener))

    await _async_register_frontend(hass)

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def _async_register_frontend(hass: HomeAssistant) -> None:
    """Zarejestruj kartę Lovelace w interfejsie Home Assistant (dla instalacji HACS)."""
    if hass.data.get(DOMAIN, {}).get("_frontend_registered"):
        return

    frontend_dir = Path(__file__).parent / "frontend"
    card_file = frontend_dir / "wroclaw-gabaryty-card.js"

    if card_file.exists():
        try:
            await hass.http.async_register_static_paths(
                [StaticPathConfig(CARD_URL, str(card_file), cache_headers=False)]
            )
        except Exception as err:
            _LOGGER.debug("Ścieżka statyczna karty została już zarejestrowana: %s", err)

        add_extra_js_url(hass, f"{CARD_URL}?v=1.1.0")

        # Kopiuj do /config/www/ dla kompatybilności ze ścieżką /local/
        def _sync_to_www():
            try:
                www_dir = Path(hass.config.path("www"))
                if www_dir.exists():
                    target = www_dir / "wroclaw-gabaryty-card.js"
                    if not target.exists() or target.stat().st_mtime < card_file.stat().st_mtime:
                        shutil.copy2(card_file, target)
            except Exception:
                pass

        await hass.async_add_executor_job(_sync_to_www)

    hass.data.setdefault(DOMAIN, {})["_frontend_registered"] = True


async def _async_update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Przeładuj integrację po zmianie opcji."""
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Usuń wpis integracji."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id, None)
    return unload_ok

