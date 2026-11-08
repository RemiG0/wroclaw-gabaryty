"""Config flow dla integracji Wrocław Gabaryty (Ekosystem)."""

from __future__ import annotations

from typing import Any
import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.data_entry_flow import FlowResult
import homeassistant.helpers.config_validation as cv

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
    DEFAULT_NAME,
    DEFAULT_RADIUS_KM,
    DOMAIN,
)


def _resolve_default_coords(hass) -> tuple[float, float]:
    """Pobierz współrzędne domu z zone.home lub konfiguracji HA (z pominięciem 0,0)."""
    zone_home = hass.states.get("zone.home") if hass and hass.states else None
    if zone_home:
        z_lat = zone_home.attributes.get("latitude")
        z_lng = zone_home.attributes.get("longitude")
        if z_lat and z_lng:
            return float(z_lat), float(z_lng)
    if hass and hass.config.latitude and hass.config.longitude:
        return float(hass.config.latitude), float(hass.config.longitude)
    return DEFAULT_LATITUDE, DEFAULT_LONGITUDE


class WroclawGabarytyConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Obsługa kreatora konfiguracji dla Wrocław Gabaryty."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Pierwszy krok konfiguracji przez użytkownika."""
        if user_input is not None:
            await self.async_set_unique_id(
                f"{user_input[CONF_LATITUDE]:.4f}_{user_input[CONF_LONGITUDE]:.4f}"
            )
            self._abort_if_unique_id_configured()
            return self.async_create_entry(
                title=DEFAULT_NAME,
                data=user_input,
            )

        default_lat, default_lng = _resolve_default_coords(self.hass)

        schema = vol.Schema(
            {
                vol.Required(CONF_LATITUDE, default=default_lat): cv.latitude,
                vol.Required(CONF_LONGITUDE, default=default_lng): cv.longitude,
                vol.Required(CONF_RADIUS_KM, default=DEFAULT_RADIUS_KM): vol.All(
                    vol.Coerce(float), vol.Range(min=0.5, max=25.0)
                ),
                vol.Required(CONF_DAYS_AHEAD, default=DEFAULT_DAYS_AHEAD): vol.All(
                    vol.Coerce(int), vol.Range(min=1, max=90)
                ),
                vol.Required(CONF_MAX_ITEMS, default=DEFAULT_MAX_ITEMS): vol.All(
                    vol.Coerce(int), vol.Range(min=5, max=100)
                ),
                vol.Required(
                    CONF_INCLUDE_ADDITIONAL, default=DEFAULT_INCLUDE_ADDITIONAL
                ): cv.boolean,
            }
        )

        return self.async_show_form(step_id="user", data_schema=schema)

    @staticmethod
    @callback
    def async_get_options_flow(
        config_entry: config_entries.ConfigEntry,
    ) -> config_entries.OptionsFlow:
        """Zwróć obsługę opcji integracji."""
        return WroclawGabarytyOptionsFlow()


class WroclawGabarytyOptionsFlow(config_entries.OptionsFlow):
    """Obsługa zmiany parametrów integracji Wrocław Gabaryty."""

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Edycja opcji promienia, dni i limitu wyników."""
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        current = {**self.config_entry.data, **self.config_entry.options}
        default_lat, default_lng = _resolve_default_coords(self.hass)

        schema = vol.Schema(
            {
                vol.Required(
                    CONF_LATITUDE,
                    default=current.get(CONF_LATITUDE, default_lat),
                ): cv.latitude,
                vol.Required(
                    CONF_LONGITUDE,
                    default=current.get(CONF_LONGITUDE, default_lng),
                ): cv.longitude,
                vol.Required(
                    CONF_RADIUS_KM,
                    default=current.get(CONF_RADIUS_KM, DEFAULT_RADIUS_KM),
                ): vol.All(vol.Coerce(float), vol.Range(min=0.5, max=25.0)),
                vol.Required(
                    CONF_DAYS_AHEAD,
                    default=current.get(CONF_DAYS_AHEAD, DEFAULT_DAYS_AHEAD),
                ): vol.All(vol.Coerce(int), vol.Range(min=1, max=90)),
                vol.Required(
                    CONF_MAX_ITEMS,
                    default=current.get(CONF_MAX_ITEMS, DEFAULT_MAX_ITEMS),
                ): vol.All(vol.Coerce(int), vol.Range(min=5, max=100)),
                vol.Required(
                    CONF_INCLUDE_ADDITIONAL,
                    default=current.get(
                        CONF_INCLUDE_ADDITIONAL, DEFAULT_INCLUDE_ADDITIONAL
                    ),
                ): cv.boolean,
            }
        )

        return self.async_show_form(step_id="init", data_schema=schema)

