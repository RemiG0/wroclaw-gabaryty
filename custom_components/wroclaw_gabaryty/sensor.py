"""Sensory dla integracji Wrocław Gabaryty (Ekosystem)."""

from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import SensorEntity, SensorStateClass
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import WroclawGabarytyCoordinator


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Dodaj encje sensorów Wrocław Gabaryty."""
    coordinator: WroclawGabarytyCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(
        [
            WroclawGabarytyListSensor(coordinator, entry),
            WroclawGabarytyNearestSensor(coordinator, entry),
        ]
    )


class WroclawGabarytyListSensor(
    CoordinatorEntity[WroclawGabarytyCoordinator], SensorEntity
):
    """Główny sensor z tabelą kontenerów w okolicy i obliczonymi trasami autem."""

    _attr_has_entity_name = True
    _attr_icon = "mdi:dump-truck"
    _attr_native_unit_of_measurement = "pkt"
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(
        self, coordinator: WroclawGabarytyCoordinator, entry: ConfigEntry
    ) -> None:
        """Inicjalizacja sensora listy kontenerów."""
        super().__init__(coordinator)
        self._attr_unique_id = f"{entry.entry_id}_okolica"
        self._attr_name = "Gabaryty w okolicy"

    @property
    def native_value(self) -> int:
        """Liczba znalezionych terminów podstawień w zadanym promieniu."""
        if not self.coordinator.data:
            return 0
        return len(self.coordinator.data.get("containers", []))

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Atrybuty wykorzystywane przez dedykowaną kartę JS w Dashboardzie."""
        if not self.coordinator.data:
            return {}
        data = self.coordinator.data
        return {
            "containers": data.get("containers", []),
            "total_in_radius": data.get("total_in_radius", 0),
            "active_count": data.get("active_count", 0),
            "nearest_container": data.get("nearest_container"),
            "home_lat": data.get("home_lat"),
            "home_lng": data.get("home_lng"),
            "radius_km": data.get("radius_km"),
            "days_ahead": data.get("days_ahead"),
            "last_updated": data.get("last_updated"),
        }


class WroclawGabarytyNearestSensor(
    CoordinatorEntity[WroclawGabarytyCoordinator], SensorEntity
):
    """Sensor pokazujący najbliższy punkt wywozu gabarytów (do powiadomień i automatyzacji)."""

    _attr_has_entity_name = True
    _attr_icon = "mdi:map-marker-distance"

    def __init__(
        self, coordinator: WroclawGabarytyCoordinator, entry: ConfigEntry
    ) -> None:
        """Inicjalizacja sensora najbliższego punktu."""
        super().__init__(coordinator)
        self._attr_unique_id = f"{entry.entry_id}_najblizszy"
        self._attr_name = "Najbliższy kontener na gabaryty"

    @property
    def native_value(self) -> str:
        """Zwróć opis najbliższego kontenera (adres + data)."""
        if not self.coordinator.data:
            return "Brak w okolicy"
        nearest = self.coordinator.data.get("nearest_container")
        if not nearest:
            return "Brak w okolicy"
        dist = nearest.get("drive_distance_km") or nearest.get("straight_distance_km")
        return f"{nearest['address']} ({nearest['date_display']}, {dist} km)"

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Szczegóły najbliższego kontenera wraz z linkami do mapy."""
        if not self.coordinator.data:
            return {}
        return self.coordinator.data.get("nearest_container") or {}

