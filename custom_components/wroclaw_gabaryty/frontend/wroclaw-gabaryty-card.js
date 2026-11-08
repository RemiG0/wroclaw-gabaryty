/**
 * Wrocław Gabaryty Card (wroclaw-gabaryty-card.js)
 * Dedykowana karta Lovelace dla Home Assistant prezentująca tabelę miejsc wywozu
 * odpadów wielkogabarytowych we Wrocławiu wg daty i odległości dojazdu autem (OSRM / Google Maps).
 */

const CARD_VERSION = "1.0.0";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

class WroclawGabarytyCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._config = null;
    this._sortBy = "date"; // "date" | "drive" | "straight"
    this._onlyActive = false;
    this._searchQuery = "";
    this._instanceId = `wg-${Math.random().toString(36).slice(2, 8)}`;
  }

  static getConfigElement() {
    return document.createElement("wroclaw-gabaryty-card-editor");
  }

  static getStubConfig(hass) {
    const candidate = Object.keys(hass?.states || {}).find((entityId) =>
      entityId.includes("gabaryty_w_okolicy")
    );
    return {
      entity: candidate || "sensor.gabaryty_w_okolicy",
      title: "Wywóz gabarytów w okolicy",
      default_sort: "date",
    };
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error(
        "Musisz podać encję (np. entity: sensor.gabaryty_w_okolicy)"
      );
    }
    this._config = {
      title: "Wywóz gabarytów w okolicy",
      default_sort: "date",
      ...config,
    };
    this._sortBy = this._config.default_sort || "date";
    this._renderSkeleton();
    this._updateContent();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.shadowRoot.innerHTML) {
      this._renderSkeleton();
    }
    this._updateContent();
  }

  getCardSize() {
    return 6;
  }

  _renderSkeleton() {
    if (!this.shadowRoot) return;
    const searchInputId = `${this._instanceId}-search`;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          color-scheme: light dark;
        }

        .visually-hidden:where(:not(:focus-within, :active)) {
          position: absolute !important;
          clip-path: inset(50%) !important;
          overflow: hidden !important;
          width: 1px !important;
          height: 1px !important;
          margin: -1px !important;
          padding: 0 !important;
          border: 0 !important;
          white-space: nowrap !important;
        }

        :where(a:any-link, button, input):focus-visible {
          outline: 3px solid var(--primary-color, #2e7d13);
          outline-offset: 2px;
        }

        ha-card {
          padding: 1rem;
          background: var(--ha-card-background, var(--card-background-color, #fff));
          color: var(--primary-text-color, #1a1a1a);
          border-radius: var(--ha-card-border-radius, 12px);
          box-sizing: border-box;
        }

        .card-container {
          container-type: inline-size;
        }

        .header {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .header-top {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
        }

        h2 {
          margin: 0;
          font-size: 1.2rem;
          font-weight: 600;
          text-align: start;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .summary-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
          font-size: 0.8rem;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.2rem 0.55rem;
          border-radius: 999px;
          font-weight: 600;
          border: 1px solid rgba(127, 127, 127, 0.35);
          background: rgba(127, 127, 127, 0.1);
        }

        .badge--active {
          background: rgba(46, 125, 19, 0.16);
          border-color: #2e7d13;
          color: var(--primary-text-color, inherit);
        }

        .badge--tomorrow {
          background: rgba(230, 126, 34, 0.18);
          border-color: #d35400;
        }

        .badge--additional {
          background: rgba(243, 156, 18, 0.18);
          border-color: #e67e22;
          font-size: 0.75rem;
        }

        .toolbar {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }

        .controls-group {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.4rem;
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          flex: 1 1 180px;
        }

        .search-box label {
          font-size: 0.82rem;
          font-weight: 600;
          white-space: nowrap;
        }

        .search-box input {
          width: 100%;
          padding: 0.38rem 0.65rem;
          border-radius: 8px;
          border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.45));
          background: var(--card-background-color, transparent);
          color: var(--primary-text-color, inherit);
          font-size: 0.88rem;
        }

        .btn-toggle {
          appearance: none;
          border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.45));
          background: transparent;
          color: var(--primary-text-color, inherit);
          padding: 0.35rem 0.65rem;
          border-radius: 8px;
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.15s ease, border-color 0.15s ease;
        }

        .btn-toggle:hover {
          background: rgba(46, 125, 19, 0.1);
        }

        .btn-toggle[aria-pressed="true"] {
          background: #2e7d13;
          border-color: #2e7d13;
          color: #ffffff;
        }

        .table-scroll {
          width: 100%;
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          text-align: start;
          font-size: 0.9rem;
        }

        th,
        td {
          padding: 0.65rem 0.5rem;
          border-bottom: 1px solid var(--divider-color, rgba(127, 127, 127, 0.25));
          text-align: start;
          vertical-align: middle;
        }

        th {
          font-size: 0.78rem;
          font-weight: 700;
          color: var(--secondary-text-color, #666);
          white-space: nowrap;
        }

        tr.row--active {
          background: rgba(46, 125, 19, 0.08);
        }

        .address-cell {
          font-weight: 600;
        }

        .address-sub {
          font-size: 0.76rem;
          color: var(--secondary-text-color, #666);
          font-weight: 400;
          margin-top: 0.15rem;
        }

        .date-main {
          font-weight: 600;
          white-space: nowrap;
        }

        .date-range {
          font-size: 0.76rem;
          color: var(--secondary-text-color, #666);
          white-space: nowrap;
        }

        .dist-main {
          font-weight: 700;
          white-space: nowrap;
        }

        .dist-sub {
          font-size: 0.76rem;
          color: var(--secondary-text-color, #666);
          white-space: nowrap;
        }

        .col-straight {
          display: none;
        }

        .route-links {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
        }

        .route-link {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.3rem 0.55rem;
          border-radius: 6px;
          font-size: 0.78rem;
          font-weight: 600;
          text-decoration: none;
          border: 1px solid rgba(46, 125, 19, 0.55);
          color: var(--primary-text-color, inherit);
          background: rgba(46, 125, 19, 0.1);
          white-space: nowrap;
        }

        .route-link:hover {
          background: #2e7d13;
          color: #ffffff;
          border-color: #2e7d13;
        }

        .route-link--osm {
          border-color: rgba(52, 152, 219, 0.6);
          background: rgba(52, 152, 219, 0.1);
        }

        .route-link--osm:hover {
          background: #2980b9;
          color: #ffffff;
          border-color: #2980b9;
        }

        .empty-state {
          padding: 1.25rem;
          text-align: center;
          color: var(--secondary-text-color, #666);
          font-size: 0.92rem;
        }

        .footer-meta {
          margin-top: 0.75rem;
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          gap: 0.5rem;
          font-size: 0.75rem;
          color: var(--secondary-text-color, #666);
        }

        /* Fallback dla przeglądarek bez wsparcia container queries */
        @media (min-width: 640px) {
          .toolbar {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
          }
          .col-straight {
            display: table-cell;
          }
        }

        @supports (container-type: inline-size) {
          @media (min-width: 640px) {
            .toolbar {
              flex-direction: column;
              align-items: stretch;
            }
            .col-straight {
              display: none;
            }
          }

          @container (min-width: 520px) {
            .toolbar {
              flex-direction: row;
              align-items: center;
              justify-content: space-between;
            }
            .col-straight {
              display: table-cell;
            }
          }
        }
      </style>

      <ha-card>
        <div class="card-container">
          <header class="header">
            <div class="header-top">
              <h2 id="${this._instanceId}-title">
                <span aria-hidden="true">🚛</span>
                <span class="js-card-title"></span>
              </h2>
              <div class="summary-badges js-summary-badges"></div>
            </div>

            <div class="toolbar">
              <div class="controls-group" role="group" aria-label="Sortowanie i filtrowanie">
                <button type="button" class="btn-toggle js-sort-btn" data-sort="date" aria-pressed="true">
                  Wg daty
                </button>
                <button type="button" class="btn-toggle js-sort-btn" data-sort="drive" aria-pressed="false">
                  Wg trasy autem
                </button>
                <button type="button" class="btn-toggle js-sort-btn" data-sort="straight" aria-pressed="false">
                  W linii prostej
                </button>
                <button type="button" class="btn-toggle js-active-btn" aria-pressed="false">
                  Tylko aktywne dziś
                </button>
                <button type="button" class="btn-toggle js-refresh-btn">
                  <span aria-hidden="true">🔄</span> Odśwież
                </button>
              </div>

              <div class="search-box">
                <label for="${searchInputId}">Ulica:</label>
                <input
                  id="${searchInputId}"
                  class="js-search-input"
                  type="search"
                  placeholder="Filtruj po adresie..."
                  autocomplete="off"
                />
              </div>
            </div>
          </header>

          <div class="table-scroll js-table-container"></div>
          <footer class="footer-meta js-footer-meta"></footer>
        </div>
      </ha-card>
    `;

    this.shadowRoot.querySelectorAll(".js-sort-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        this._sortBy = btn.dataset.sort;
        this._updateControlsState();
        this._updateContent();
      });
    });

    const activeBtn = this.shadowRoot.querySelector(".js-active-btn");
    if (activeBtn) {
      activeBtn.addEventListener("click", () => {
        this._onlyActive = !this._onlyActive;
        this._updateControlsState();
        this._updateContent();
      });
    }

    const refreshBtn = this.shadowRoot.querySelector(".js-refresh-btn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        if (this._hass && typeof this._hass.callService === "function" && this._config?.entity) {
          this._hass.callService("homeassistant", "update_entity", {
            entity_id: this._config.entity,
          });
        }
      });
    }

    const searchInput = this.shadowRoot.querySelector(".js-search-input");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this._searchQuery = (e.target.value || "").trim().toLowerCase();
        this._updateContent();
      });
    }

    this._updateControlsState();
  }

  _updateControlsState() {
    if (!this.shadowRoot) return;
    this.shadowRoot.querySelectorAll(".js-sort-btn").forEach((btn) => {
      const isSelected = btn.dataset.sort === this._sortBy;
      btn.setAttribute("aria-pressed", isSelected ? "true" : "false");
    });
    const activeBtn = this.shadowRoot.querySelector(".js-active-btn");
    if (activeBtn) {
      activeBtn.setAttribute(
        "aria-pressed",
        this._onlyActive ? "true" : "false"
      );
    }
  }

  _updateContent() {
    if (!this.shadowRoot || !this._config) return;

    const titleEl = this.shadowRoot.querySelector(".js-card-title");
    if (titleEl) {
      titleEl.textContent = this._config.title || "Wywóz gabarytów w okolicy";
    }

    const tableContainer = this.shadowRoot.querySelector(".js-table-container");
    const badgesContainer = this.shadowRoot.querySelector(".js-summary-badges");
    const footerMeta = this.shadowRoot.querySelector(".js-footer-meta");

    if (!this._hass) return;

    const stateObj = this._hass.states[this._config.entity];
    if (!stateObj) {
      tableContainer.innerHTML = `
        <div class="empty-state" role="alert">
          <span aria-hidden="true">⚠️</span>
          Nie znaleziono encji <code>${escapeHtml(this._config.entity)}</code>.
          Sprawdź konfigurację integracji <strong>Wrocław Gabaryty</strong>.
        </div>
      `;
      badgesContainer.innerHTML = "";
      footerMeta.innerHTML = "";
      return;
    }

    const attrs = stateObj.attributes || {};
    const rawContainers = Array.isArray(attrs.containers)
      ? [...attrs.containers]
      : [];

    const radiusKm = attrs.radius_km ?? 5;
    const activeCount = attrs.active_count ?? 0;

    badgesContainer.innerHTML = `
      <span class="badge ${activeCount > 0 ? "badge--active" : ""}">
        <span aria-hidden="true">${activeCount > 0 ? "🟢" : "⚪"}</span>
        Stoi teraz: ${escapeHtml(activeCount)}
      </span>
      <span class="badge">
        <span aria-hidden="true">📍</span>
        Promień: ${escapeHtml(radiusKm)} km (${escapeHtml(rawContainers.length)} pkt)
      </span>
    `;

    // Filtrowanie
    let filtered = rawContainers;
    if (this._onlyActive) {
      filtered = filtered.filter((item) => item.status === "active");
    }
    if (this._searchQuery) {
      filtered = filtered.filter((item) =>
        String(item.address || "")
          .toLowerCase()
          .includes(this._searchQuery)
      );
    }

    // Sortowanie
    filtered.sort((a, b) => {
      if (this._sortBy === "drive") {
        const da = a.drive_distance_km ?? a.straight_distance_km ?? 999;
        const db = b.drive_distance_km ?? b.straight_distance_km ?? 999;
        if (da !== db) return da - db;
        return String(a.date_start).localeCompare(String(b.date_start));
      }
      if (this._sortBy === "straight") {
        const sa = a.straight_distance_km ?? 999;
        const sb = b.straight_distance_km ?? 999;
        if (sa !== sb) return sa - sb;
        return String(a.date_start).localeCompare(String(b.date_start));
      }
      // Domyślnie po dacie, a przy tej samej dacie po odległości autem
      const cmpDate = String(a.date_start).localeCompare(String(b.date_start));
      if (cmpDate !== 0) return cmpDate;
      const da = a.drive_distance_km ?? a.straight_distance_km ?? 999;
      const db = b.drive_distance_km ?? b.straight_distance_km ?? 999;
      return da - db;
    });

    if (filtered.length === 0) {
      tableContainer.innerHTML = `
        <div class="empty-state">
          Brak zaplanowanych kontenerów spełniających wybrane kryteria w promieniu ${escapeHtml(radiusKm)} km.
        </div>
      `;
    } else {
      const rowsHtml = filtered
        .map((item) => {
          const isActive = item.status === "active";
          const isTomorrow = item.status === "tomorrow";
          const statusIcon = isActive ? "🟢" : isTomorrow ? "🟡" : "📅";
          const badgeClass = isActive
            ? "badge badge--active"
            : isTomorrow
            ? "badge badge--tomorrow"
            : "badge";

          const driveKm =
            item.drive_distance_km != null
              ? `${Number(item.drive_distance_km).toFixed(2)} km`
              : `${Number(item.straight_distance_km).toFixed(2)} km (prosta)`;
          const driveDuration =
            item.drive_duration_min != null
              ? `~${item.drive_duration_min} min autem`
              : "brak danych OSRM";

          const typeBadge =
            item.type === "Dodatkowy"
              ? `<span class="badge badge--additional"><span aria-hidden="true">➕</span> Dodatkowy</span>`
              : "";

          const labelContext = `${item.address} (${item.date_display})`;

          return `
            <tr class="${isActive ? "row--active" : ""}">
              <td>
                <div class="date-main">${escapeHtml(item.date_display)}</div>
                <div class="date-range">stoi do ${escapeHtml(item.date_end_display)}</div>
              </td>
              <td>
                <span class="${badgeClass}">
                  <span aria-hidden="true">${statusIcon}</span>
                  <span>${escapeHtml(item.status_label)}</span>
                </span>
              </td>
              <td>
                <div class="address-cell">
                  ${escapeHtml(item.address)}
                  ${typeBadge}
                </div>
                <div class="address-sub">
                  W linii prostej: ${escapeHtml(Number(item.straight_distance_km).toFixed(2))} km
                </div>
              </td>
              <td>
                <div class="dist-main">🚗 ${escapeHtml(driveKm)}</div>
                <div class="dist-sub">${escapeHtml(driveDuration)}</div>
              </td>
              <td class="col-straight">
                ${escapeHtml(Number(item.straight_distance_km).toFixed(2))} km
              </td>
              <td>
                <div class="route-links">
                  <a
                    class="route-link"
                    href="${escapeHtml(item.google_maps_url)}"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="${escapeHtml(`Nawiguj w Google Maps do ${labelContext}`)}"
                  >
                    <span aria-hidden="true">🗺️</span> Google
                  </a>
                  <a
                    class="route-link route-link--osm"
                    href="${escapeHtml(item.osm_url)}"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="${escapeHtml(`Wyznacz trasę w OpenStreetMap do ${labelContext}`)}"
                  >
                    <span aria-hidden="true">🧭</span> OSM
                  </a>
                </div>
              </td>
            </tr>
          `;
        })
        .join("");

      tableContainer.innerHTML = `
        <table>
          <caption class="visually-hidden">
            Harmonogram i lokalizacje podstawienia kontenerów na odpady wielkogabarytowe w okolicy wraz z odległością dojazdu autem
          </caption>
          <thead>
            <tr>
              <th scope="col">Termin</th>
              <th scope="col">Status</th>
              <th scope="col">Miejsce (ulica)</th>
              <th scope="col">Dojazd autem (OSRM)</th>
              <th scope="col" class="col-straight">Linia prosta</th>
              <th scope="col">Mapa trasy</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      `;
    }

    const updatedText = attrs.last_updated
      ? new Date(attrs.last_updated).toLocaleString("pl-PL")
      : "przed chwilą";

    footerMeta.innerHTML = `
      <span>Źródło: gabaryty.ekosystem.wroc.pl • Trasy: OSRM (OpenStreetMap)</span>
      <span>Aktualizacja: ${escapeHtml(updatedText)}</span>
    `;
  }
}

class WroclawGabarytyCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _render() {
    if (!this.shadowRoot) return;
    const entity = this._config.entity || "sensor.gabaryty_w_okolicy";
    const title = this._config.title || "Wywóz gabarytów w okolicy";
    const defaultSort = this._config.default_sort || "date";

    this.shadowRoot.innerHTML = `
      <style>
        .editor-form {
          display: grid;
          gap: 0.75rem;
          padding: 0.5rem 0;
        }
        .field {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        label {
          font-size: 0.85rem;
          font-weight: 600;
        }
        input, select {
          padding: 0.45rem 0.6rem;
          border-radius: 6px;
          border: 1px solid rgba(127, 127, 127, 0.4);
          font-size: 0.9rem;
        }
      </style>
      <div class="editor-form">
        <div class="field">
          <label for="wg-editor-entity">Encja sensora</label>
          <input id="wg-editor-entity" type="text" value="${escapeHtml(entity)}" />
        </div>
        <div class="field">
          <label for="wg-editor-title">Tytuł karty</label>
          <input id="wg-editor-title" type="text" value="${escapeHtml(title)}" />
        </div>
        <div class="field">
          <label for="wg-editor-sort">Domyślne sortowanie</label>
          <select id="wg-editor-sort">
            <option value="date" ${defaultSort === "date" ? "selected" : ""}>Wg daty podstawienia</option>
            <option value="drive" ${defaultSort === "drive" ? "selected" : ""}>Wg trasy autem (km)</option>
            <option value="straight" ${defaultSort === "straight" ? "selected" : ""}>W linii prostej (km)</option>
          </select>
        </div>
      </div>
    `;

    this.shadowRoot
      .querySelector("#wg-editor-entity")
      .addEventListener("change", (e) =>
        this._updateConfig("entity", e.target.value)
      );
    this.shadowRoot
      .querySelector("#wg-editor-title")
      .addEventListener("change", (e) =>
        this._updateConfig("title", e.target.value)
      );
    this.shadowRoot
      .querySelector("#wg-editor-sort")
      .addEventListener("change", (e) =>
        this._updateConfig("default_sort", e.target.value)
      );
  }

  _updateConfig(key, value) {
    this._config = { ...this._config, [key]: value };
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: this._config },
        bubbles: true,
        composed: true,
      })
    );
  }
}

if (!customElements.get("wroclaw-gabaryty-card")) {
  customElements.define("wroclaw-gabaryty-card", WroclawGabarytyCard);
}
if (!customElements.get("wroclaw-gabaryty-card-editor")) {
  customElements.define(
    "wroclaw-gabaryty-card-editor",
    WroclawGabarytyCardEditor
  );
}

window.customCards = window.customCards || [];
if (
  !window.customCards.some((card) => card.type === "wroclaw-gabaryty-card")
) {
  window.customCards.push({
    type: "wroclaw-gabaryty-card",
    name: "Wrocław Gabaryty – Tabela w okolicy",
    description:
      "Tabela z miejscami wywozu gabarytów wg daty i odległości dojazdu autem (OSRM / Google Maps).",
    preview: true,
  });
}

console.info(
  `%c WROCLAW-GABARYTY-CARD %c v${CARD_VERSION} `,
  "background:#2e7d13;color:#fff;font-weight:bold;padding:2px 6px;border-radius:4px 0 0 4px",
  "background:#1a1a1a;color:#fff;padding:2px 6px;border-radius:0 4px 4px 0"
);

