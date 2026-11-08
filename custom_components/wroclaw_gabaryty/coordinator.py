"""DataUpdateCoordinator dla integracji Wrocław Gabaryty (Ekosystem + OSRM)."""

from __future__ import annotations

from datetime import date, datetime, timedelta
import json
import logging
import math
from typing import Any

import aiohttp

from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
from homeassistant.util import dt as dt_util

from .const import (
    CONTAINER_ACTIVE_DAYS,
    DOMAIN,
    EKOSYSTEM_AJAX_URL,
    OSRM_TABLE_URL,
    SCAN_INTERVAL,
)

_LOGGER = logging.getLogger(__name__)


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Oblicz odległość w linii prostej (w km) pomiędzy dwoma punktami GPS."""
    radius_earth_km = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return radius_earth_km * c


def build_google_maps_url(
    home_lat: float, home_lng: float, dest_lat: float, dest_lng: float
) -> str:
    """Wygeneruj bezpośredni link do trasy samochodowej w Google Maps."""
    return (
        f"https://www.google.com/maps/dir/?api=1"
        f"&origin={home_lat:.6f},{home_lng:.6f}"
        f"&destination={dest_lat:.6f},{dest_lng:.6f}"
        f"&travelmode=driving"
    )


def build_osm_directions_url(
    home_lat: float, home_lng: float, dest_lat: float, dest_lng: float
) -> str:
    """Wygeneruj bezpośredni link do trasy samochodowej w OpenStreetMap (OSRM)."""
    return (
        f"https://www.openstreetmap.org/directions?engine=fossgis_osrm_car"
        f"&route={home_lat:.6f}%2C{home_lng:.6f}%3B{dest_lat:.6f}%2C{dest_lng:.6f}"
    )


class WroclawGabarytyCoordinator(DataUpdateCoordinator[dict[str, Any]]):
    """Koordynator pobierający harmonogram gabarytów i wyliczający trasy dojazdu autem."""

    def __init__(
        self,
        hass: HomeAssistant,
        home_lat: float,
        home_lng: float,
        radius_km: float,
        days_ahead: int,
        max_items: int,
        include_additional: bool,
    ) -> None:
        """Inicjalizacja koordynatora."""
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=SCAN_INTERVAL,
        )
        self.home_lat = home_lat
        self.home_lng = home_lng
        self.radius_km = radius_km
        self.days_ahead = days_ahead
        self.max_items = max_items
        self.include_additional = include_additional

    async def _async_update_data(self) -> dict[str, Any]:
        """Pobierz dane z Ekosystemu i oblicz trasy przez OSRM."""
        # Serwer gabaryty.ekosystem.wroc.pl posiada niepełny łańcuch certyfikatów SSL,
        # dlatego dla tego zapytania używamy sesji z verify_ssl=False.
        session_no_ssl = async_get_clientsession(self.hass, verify_ssl=False)
        session_default = async_get_clientsession(self.hass)

        try:
            raw_data = await self._fetch_ekosystem_points(session_no_ssl)
        except Exception as err:
            raise UpdateFailed(
                f"Błąd pobierania danych z gabaryty.ekosystem.wroc.pl: {err}"
            ) from err

        today = dt_util.now().date()
        all_candidates = self._filter_and_expand_points(raw_data, today)

        # Wybieramy pulę najlepszych kandydatów (najbliższe geograficznie + najbliższe czasowo),
        # aby zmieścić się w 1 zapytaniu do publicznego OSRM Table API (max ~80 punktów)
        # oraz poniżej limitu 16 KB atrybutów w bazie Home Assistant Recorder.
        by_date = sorted(
            all_candidates,
            key=lambda item: (item["date_start"], item["straight_distance_km"]),
        )[: self.max_items]
        by_dist = sorted(
            all_candidates,
            key=lambda item: (item["straight_distance_km"], item["date_start"]),
        )[: self.max_items]

        merged_map: dict[tuple[str, str], dict[str, Any]] = {}
        for item in by_date + by_dist:
            merged_map[(item["address"], item["date_start"])] = item
        candidates = list(merged_map.values())

        # Oblicz dystans drogowy i czas jazdy autem za pomocą darmowego OSRM Table API
        if candidates:
            await self._enrich_with_osrm_routes(session_default, candidates)

        # Sortowanie: aktywne i najbliższe terminy, a w ramach terminu po odległości autem
        candidates.sort(
            key=lambda item: (
                item["date_start"],
                item.get("drive_distance_km")
                if item.get("drive_distance_km") is not None
                else item["straight_distance_km"],
            )
        )

        # Ogranicz liczbę wyników do max_items
        limited = candidates[: self.max_items]

        active_containers = [c for c in all_candidates if c["status"] == "active"]
        nearest_container = min(
            candidates,
            key=lambda c: (
                c.get("drive_distance_km")
                if c.get("drive_distance_km") is not None
                else c["straight_distance_km"]
            ),
            default=None,
        )

        return {
            "containers": limited,
            "total_in_radius": len(all_candidates),
            "active_count": len(active_containers),
            "nearest_container": nearest_container,
            "home_lat": self.home_lat,
            "home_lng": self.home_lng,
            "radius_km": self.radius_km,
            "days_ahead": self.days_ahead,
            "last_updated": dt_util.now().isoformat(),
        }

    async def _fetch_ekosystem_points(
        self, session: aiohttp.ClientSession
    ) -> dict[str, Any]:
        """Wykonaj zapytanie POST do endpointu AJAX Ekosystemu."""
        payload = {
            "action": "get-points",
            "opt1": "false",
            "opt2": "true",
            "opt3": "true" if self.include_additional else "false",
            "noFit": "0",
            "selectedM": "0",
        }
        headers = {
            "User-Agent": "Mozilla/5.0 (compatible; HomeAssistant-WroclawGabaryty/1.0)",
            "Referer": "https://gabaryty.ekosystem.wroc.pl/",
        }
        timeout = aiohttp.ClientTimeout(total=25)
        async with session.post(
            EKOSYSTEM_AJAX_URL, data=payload, headers=headers, timeout=timeout
        ) as resp:
            resp.raise_for_status()
            text = await resp.text()
            return json.loads(text)

    def _filter_and_expand_points(
        self, raw_data: dict[str, Any], today: date
    ) -> list[dict[str, Any]]:
        """Przefiltruj punkty po odległości Haversine i rozwiń terminy podstawień."""
        markers = list(raw_data.get("markers") or [])
        if self.include_additional:
            markers.extend(raw_data.get("additionalMarkers") or [])

        max_future_date = today + timedelta(days=self.days_ahead)
        results: list[dict[str, Any]] = []
        seen_keys: set[tuple[str, str]] = set()

        for marker in markers:
            try:
                lat = float(marker["lat"])
                lng = float(marker["lng"])
            except (KeyError, TypeError, ValueError):
                continue

            straight_km = haversine_km(self.home_lat, self.home_lng, lat, lng)
            if straight_km > self.radius_km:
                continue

            title = str(marker.get("title", "")).strip()
            point_id = str(marker.get("point_id", ""))
            marker_type = str(marker.get("type", "Harmonogram"))
            raw_dates = str(marker.get("dates", ""))

            for date_token in raw_dates.split(","):
                date_str = date_token.strip()
                if not date_str:
                    continue
                try:
                    start_date = datetime.strptime(date_str, "%d-%m-%Y").date()
                except ValueError:
                    continue

                # Kontener jest dostępny od dnia podstawienia przez CONTAINER_ACTIVE_DAYS (3 dni)
                end_date = start_date + timedelta(days=CONTAINER_ACTIVE_DAYS)

                # Pomijamy terminy, które już się zakończyły lub są zbyt daleko w przyszłości
                if end_date < today or start_date > max_future_date:
                    continue

                dedup_key = (title, start_date.isoformat())
                if dedup_key in seen_keys:
                    continue
                seen_keys.add(dedup_key)

                is_active = start_date <= today <= end_date
                days_until = (start_date - today).days

                if is_active:
                    status = "active"
                    status_label = "Stoi teraz"
                elif days_until == 1:
                    status = "tomorrow"
                    status_label = "Jutro"
                else:
                    status = "upcoming"
                    status_label = f"Za {days_until} dni"

                results.append(
                    {
                        "point_id": point_id,
                        "address": title,
                        "type": marker_type,
                        "date_start": start_date.isoformat(),
                        "date_end": end_date.isoformat(),
                        "date_display": start_date.strftime("%d.%m.%Y"),
                        "date_end_display": end_date.strftime("%d.%m"),
                        "status": status,
                        "status_label": status_label,
                        "days_until": days_until,
                        "lat": round(lat, 6),
                        "lng": round(lng, 6),
                        "straight_distance_km": round(straight_km, 2),
                        "drive_distance_km": None,
                        "drive_duration_min": None,
                        "google_maps_url": build_google_maps_url(
                            self.home_lat, self.home_lng, lat, lng
                        ),
                        "osm_url": build_osm_directions_url(
                            self.home_lat, self.home_lng, lat, lng
                        ),
                    }
                )

        return results

    async def _enrich_with_osrm_routes(
        self, session: aiohttp.ClientSession, items: list[dict[str, Any]]
    ) -> None:
        """Pobierz dystans drogowy i czas przejazdu autem z OSRM Table API."""
        # Grupujemy unikalne współrzędne (jeden punkt może mieć kilka dat)
        unique_coords: list[tuple[float, float]] = []
        coord_to_index: dict[tuple[float, float], int] = {}

        for item in items:
            coord = (item["lat"], item["lng"])
            if coord not in coord_to_index:
                coord_to_index[coord] = len(unique_coords)
                unique_coords.append(coord)

        # Przetwarzamy w paczkach po maksymalnie 80 punktów na jedno zapytanie OSRM
        batch_size = 80
        coord_metrics: dict[tuple[float, float], tuple[float | None, int | None]] = {}

        for start_idx in range(0, len(unique_coords), batch_size):
            batch = unique_coords[start_idx : start_idx + batch_size]
            coords_parts = [f"{self.home_lng:.6f},{self.home_lat:.6f}"]
            coords_parts.extend(f"{lng:.6f},{lat:.6f}" for lat, lng in batch)
            coords_str = ";".join(coords_parts)

            url = (
                f"{OSRM_TABLE_URL}/{coords_str}"
                f"?sources=0&annotations=distance,duration"
            )
            try:
                timeout = aiohttp.ClientTimeout(total=15)
                async with session.get(url, timeout=timeout) as resp:
                    if resp.status != 200:
                        _LOGGER.warning(
                            "OSRM Table API zwróciło status %s", resp.status
                        )
                        continue
                    data = await resp.json()
                    if data.get("code") != "Ok":
                        continue

                    distances = (data.get("distances") or [[]])[0]
                    durations = (data.get("durations") or [[]])[0]

                    for idx, coord in enumerate(batch, start=1):
                        dist_m = distances[idx] if idx < len(distances) else None
                        dur_s = durations[idx] if idx < len(durations) else None
                        dist_km = (
                            round(float(dist_m) / 1000.0, 2)
                            if dist_m is not None
                            else None
                        )
                        dur_min = (
                            max(1, round(float(dur_s) / 60.0))
                            if dur_s is not None
                            else None
                        )
                        coord_metrics[coord] = (dist_km, dur_min)
            except Exception as err:  # noqa: BLE001
                _LOGGER.warning("Nie udało się pobrać tras z OSRM: %s", err)

        for item in items:
            coord = (item["lat"], item["lng"])
            if coord in coord_metrics:
                dist_km, dur_min = coord_metrics[coord]
                item["drive_distance_km"] = dist_km
                item["drive_duration_min"] = dur_min
