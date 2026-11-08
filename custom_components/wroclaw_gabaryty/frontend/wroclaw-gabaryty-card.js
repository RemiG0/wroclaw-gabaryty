/**
 * Wrocław Gabaryty Card (wroclaw-gabaryty-card.js)
 * Dedykowana, responsywna karta Lovelace dla Home Assistant prezentująca miejsca wywozu
 * odpadów wielkogabarytowych we Wrocławiu wg daty i odległości dojazdu autem (OSRM / Google Maps).
 * Na telefonie (< 600px) automatycznie przełącza się w ergonomiczny widok kompaktowych kart
 * bez przewijania poziomego; na tablecie/komputerze wyświetla pełną tabelę.
 */

const CARD_VERSION = "1.1.0";

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
          padding: 0.85rem;
          background: var(--ha-card-background, var(--card-background-color, #fff));
          color: var(--primary-text-color, #1a1a1a);
          border-radius: var(--ha-card-border-radius, 12px);
          box-sizing: border-box;
          overflow: clip;
        }

        .card-container {
          container: card / inline-size;
          inline-size: 100%;
        }

        .header {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          margin-block-end: 0.85rem;
        }

        .header-top {
          display: flex;
          flex-wrap: wrap;
          align-items: safe center;
          justify-content: space-between;
          gap: 0.45rem;
        }

        h2 {
          margin: 0;
          font-size: clamp(1rem, 4cqi, 1.2rem);
          font-weight: 600;
          text-align: start;
          display: flex;
          align-items: safe center;
          gap: 0.4rem;
          line-height: 1.25;
        }

        .summary-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
          font-size: 0.76rem;
        }

        .badge {
          display: inline-flex;
          align-items: safe center;
          gap: 0.25rem;
          padding: 0.18rem 0.5rem;
          border-radius: 999px;
          font-weight: 600;
          font-size: 0.75rem;
          border: 1px solid rgba(127, 127, 127, 0.35);
          background: rgba(127, 127, 127, 0.1);
          white-space: nowrap;
        }

        .badge--active {
          background: rgba(46, 125, 19, 0.18);
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
          font-size: 0.7rem;
          padding: 0.1rem 0.4rem;
        }

        .toolbar {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .controls-group {
          display: flex;
          flex-wrap: wrap;
          align-items: safe center;
          gap: 0.35rem;
        }

        .btn-toggle {
          appearance: none;
          flex: 1 1 auto;
          display: inline-flex;
          align-items: safe center;
          justify-content: center;
          gap: 0.25rem;
          border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.4));
          background: rgba(127, 127, 127, 0.06);
          color: var(--primary-text-color, inherit);
          padding: 0.42rem 0.55rem;
          border-radius: 8px;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: background-color 0.15s ease, border-color 0.15s ease;
        }

        .btn-toggle:hover {
          background: rgba(46, 125, 19, 0.12);
        }

        .btn-toggle[aria-pressed="true"] {
          background: #2e7d13;
          border-color: #2e7d13;
          color: #ffffff;
        }

        .btn-refresh {
          flex: 0 0 auto;
          margin-inline-start: auto;
        }

        .label-wide {
          display: none;
        }

        .search-box {
          display: flex;
          align-items: safe center;
          gap: 0.4rem;
          inline-size: 100%;
        }

        .search-box label {
          font-size: 0.8rem;
          font-weight: 600;
          white-space: nowrap;
        }

        .search-box input {
          inline-size: 100%;
          padding: 0.42rem 0.65rem;
          border-radius: 8px;
          border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.4));
          background: var(--card-background-color, transparent);
          color: var(--primary-text-color, inherit);
          font-size: 0.86rem;
          box-sizing: border-box;
        }

        /* =========================================================
         * DOMYŚLNY WIDOK MOBILNY (Ergonomiczne karty Grid bez scrolla)
         * ========================================================= */
        .table-wrapper {
          inline-size: 100%;
        }

        table,
        tbody {
          display: block;
          inline-size: 100%;
        }

        thead {
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

        tbody tr {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          grid-template-areas:
            "address status"
            "date    actions"
            "drive   actions";
          gap: 0.22rem 0.5rem;
          align-items: safe center;
          padding: 0.7rem 0.75rem;
          margin-block-end: 0.5rem;
          border-radius: 10px;
          border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.25));
          background: rgba(127, 127, 127, 0.04);
          box-sizing: border-box;
        }

        tbody tr.row--active {
          background: rgba(46, 125, 19, 0.1);
          border-color: rgba(46, 125, 19, 0.55);
        }

        tbody td {
          display: block;
          padding: 0;
          border: 0;
          text-align: start;
          min-inline-size: 0;
        }

        td.cell-address {
          grid-area: address;
        }

        td.cell-status {
          grid-area: status;
          justify-self: end;
        }

        td.cell-date {
          grid-area: date;
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          gap: 0.35rem;
        }

        td.cell-drive {
          grid-area: drive;
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          gap: 0.35rem;
        }

        td.cell-straight {
          display: none;
        }

        td.cell-actions {
          grid-area: actions;
          justify-self: end;
          align-self: end;
        }

        .address-cell {
          font-weight: 700;
          font-size: 0.96rem;
          line-height: 1.25;
          display: flex;
          flex-wrap: wrap;
          align-items: safe center;
          gap: 0.35rem;
          overflow-wrap: anywhere;
        }

        .address-sub {
          display: none;
        }

        .date-main {
          font-weight: 600;
          font-size: 0.83rem;
          white-space: nowrap;
        }

        .date-range {
          font-size: 0.76rem;
          color: var(--secondary-text-color, #888);
          white-space: nowrap;
        }

        .dist-main {
          font-weight: 700;
          font-size: 0.85rem;
          white-space: nowrap;
        }

        .dist-sub {
          font-size: 0.76rem;
          color: var(--secondary-text-color, #888);
          white-space: nowrap;
        }

        .mobile-straight {
          font-size: 0.74rem;
          color: var(--secondary-text-color, #888);
          white-space: nowrap;
        }

        .route-links {
          display: flex;
          flex-wrap: nowrap;
          gap: 0.35rem;
        }

        .route-link {
          display: inline-flex;
          align-items: safe center;
          justify-content: center;
          gap: 0.22rem;
          padding: 0.38rem 0.58rem;
          border-radius: 8px;
          font-size: 0.78rem;
          font-weight: 600;
          text-decoration: none;
          border: 1px solid rgba(46, 125, 19, 0.6);
          color: var(--primary-text-color, inherit);
          background: rgba(46, 125, 19, 0.12);
          white-space: nowrap;
        }

        .route-link:hover {
          background: #2e7d13;
          color: #ffffff;
          border-color: #2e7d13;
        }

        .route-link--osm {
          border-color: rgba(52, 152, 219, 0.6);
          background: rgba(52, 152, 219, 0.12);
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
          font-size: 0.9rem;
        }

        .footer-meta {
          margin-block-start: 0.65rem;
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          gap: 0.35rem;
          font-size: 0.72rem;
          color: var(--secondary-text-color, #666);
        }

        /* Na bardzo wąskich ekranach (< 350px) przyciski mapy przechodzą w pełny dolny wiersz */
        @container card (max-width: 350px) {
          tbody tr {
            grid-template-columns: minmax(0, 1fr) auto;
            grid-template-areas:
              "address status"
              "date    date"
              "drive   drive"
              "actions actions";
          }
          td.cell-actions {
            justify-self: stretch;
            margin-block-start: 0.25rem;
          }
          .route-links {
            inline-size: 100%;
          }
          .route-link {
            flex: 1 1 50%;
          }
        }

        /* =========================================================
         * WIDOK TABLETOWY / DESKTOPOWY (Pełna tabela >= 600px)
         * ========================================================= */
        @media (min-width: 680px) {
          ha-card {
            padding: 1rem;
          }
          .toolbar {
            flex-direction: row;
            align-items: safe center;
            justify-content: space-between;
          }
          .btn-toggle {
            flex: 0 0 auto;
          }
          .label-wide {
            display: inline;
          }
          .search-box {
            inline-size: auto;
            min-inline-size: 210px;
          }
          table {
            display: table;
            border-collapse: collapse;
            font-size: 0.88rem;
          }
          thead {
            position: static !important;
            clip-path: none !important;
            overflow: visible !important;
            width: auto !important;
            height: auto !important;
            margin: 0 !important;
            white-space: normal !important;
            display: table-header-group;
          }
          tbody {
            display: table-row-group;
          }
          tbody tr {
            display: table-row;
            padding: 0;
            margin: 0;
            border: 0;
            border-radius: 0;
            background: transparent;
          }
          tbody td,
          thead th {
            display: table-cell;
            padding: 0.6rem 0.5rem;
            border-block-end: 1px solid var(--divider-color, rgba(127, 127, 127, 0.22));
            vertical-align: middle;
            text-align: start;
          }
          thead th {
            font-size: 0.76rem;
            font-weight: 700;
            color: var(--secondary-text-color, #666);
            white-space: nowrap;
          }
          .address-sub {
            display: block;
            font-size: 0.75rem;
            color: var(--secondary-text-color, #666);
            font-weight: 400;
            margin-block-start: 0.12rem;
          }
          .mobile-straight {
            display: none;
          }
        }

        @supports (container-type: inline-size) {
          @media (min-width: 680px) {
            /* Reset media query, aby decydowała szerokość samej karty (@container) */
            .toolbar {
              flex-direction: column;
              align-items: stretch;
            }
            .btn-toggle {
              flex: 1 1 auto;
            }
            .label-wide {
              display: none;
            }
            .search-box {
              inline-size: 100%;
            }
            table,
            tbody {
              display: block;
            }
            thead {
              position: absolute !important;
              clip-path: inset(50%) !important;
              overflow: hidden !important;
              width: 1px !important;
              height: 1px !important;
            }
            tbody tr {
              display: grid;
              padding: 0.7rem 0.75rem;
              margin-block-end: 0.5rem;
              border-radius: 10px;
              border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.25));
            }
            tbody td {
              display: block;
              padding: 0;
              border: 0;
            }
            td.cell-date,
            td.cell-drive {
              display: flex;
            }
            td.cell-straight {
              display: none;
            }
            .address-sub {
              display: none;
            }
            .mobile-straight {
              display: inline;
            }
          }

          @container card (min-width: 600px) {
            .toolbar {
              flex-direction: row;
              align-items: safe center;
              justify-content: space-between;
            }
            .btn-toggle {
              flex: 0 0 auto;
            }
            .label-wide {
              display: inline;
            }
            .search-box {
              inline-size: auto;
              min-inline-size: 200px;
              max-inline-size: 260px;
            }
            table {
              display: table;
              border-collapse: collapse;
              font-size: 0.88rem;
            }
            thead {
              position: static !important;
              clip-path: none !important;
              overflow: visible !important;
              width: auto !important;
              height: auto !important;
              margin: 0 !important;
              white-space: normal !important;
              display: table-header-group;
            }
            tbody {
              display: table-row-group;
            }
            tbody tr {
              display: table-row;
              padding: 0;
              margin: 0;
              border: 0;
              border-radius: 0;
              background: transparent;
            }
            tbody td,
            thead th {
              display: table-cell;
              padding: 0.6rem 0.5rem;
              border-block-end: 1px solid var(--divider-color, rgba(127, 127, 127, 0.22));
              vertical-align: middle;
              text-align: start;
            }
            thead th {
              font-size: 0.76rem;
              font-weight: 700;
              color: var(--secondary-text-color, #666);
              white-space: nowrap;
            }
            .address-sub {
              display: block;
              font-size: 0.75rem;
              color: var(--secondary-text-color, #666);
              font-weight: 400;
              margin-block-start: 0.12rem;
            }
            .mobile-straight {
              display: none;
            }
          }

          @container card (min-width: 760px) {
            td.cell-straight,
            th.col-straight {
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
                  <span aria-hidden="true">📅</span>
                  <span><span class="label-wide">Wg </span>Data</span>
                </button>
                <button type="button" class="btn-toggle js-sort-btn" data-sort="drive" aria-pressed="false">
                  <span aria-hidden="true">🚗</span>
                  <span><span class="label-wide">Wg </span>Autem</span>
                </button>
                <button type="button" class="btn-toggle js-sort-btn" data-sort="straight" aria-pressed="false">
                  <span aria-hidden="true">📏</span>
                  <span>Prosta</span>
                </button>
                <button type="button" class="btn-toggle js-active-btn" aria-pressed="false">
                  <span aria-hidden="true">🟢</span>
                  <span>Dziś</span>
                </button>
                <button type="button" class="btn-toggle btn-refresh js-refresh-btn" aria-label="Odśwież dane">
                  <span aria-hidden="true">🔄</span>
                  <span class="label-wide">Odśwież</span>
                </button>
              </div>

              <div class="search-box">
                <label for="${searchInputId}">Ulica:</label>
                <input
                  id="${searchInputId}"
                  class="js-search-input"
                  type="search"
                  placeholder="Szukaj ulicy..."
                  autocomplete="off"
                />
              </div>
            </div>
          </header>

          <div class="table-wrapper js-table-container"></div>
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
        if (
          this._hass &&
          typeof this._hass.callService === "function" &&
          this._config?.entity
        ) {
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
        Stoi dziś: ${escapeHtml(activeCount)}
      </span>
      <span class="badge">
        <span aria-hidden="true">📍</span>
        ${escapeHtml(radiusKm)} km (${escapeHtml(rawContainers.length)})
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

          const straightFormatted = `${Number(item.straight_distance_km).toFixed(2)} km`;
          const driveKm =
            item.drive_distance_km != null
              ? `${Number(item.drive_distance_km).toFixed(2)} km`
              : `${straightFormatted} (prosta)`;
          const driveDuration =
            item.drive_duration_min != null
              ? `~${item.drive_duration_min} min`
              : "";

          const typeBadge =
            item.type === "Dodatkowy"
              ? `<span class="badge badge--additional"><span aria-hidden="true">➕</span> Dodatkowy</span>`
              : "";

          const labelContext = `${item.address} (${item.date_display})`;

          return `
            <tr class="${isActive ? "row--active" : ""}">
              <td class="cell-date">
                <span class="date-main"><span aria-hidden="true">📅</span> ${escapeHtml(item.date_display)}</span>
                <span class="date-range">(do ${escapeHtml(item.date_end_display)})</span>
              </td>
              <td class="cell-status">
                <span class="${badgeClass}">
                  <span aria-hidden="true">${statusIcon}</span>
                  <span>${escapeHtml(item.status_label)}</span>
                </span>
              </td>
              <td class="cell-address">
                <div class="address-cell">
                  <span>${escapeHtml(item.address)}</span>
                  ${typeBadge}
                </div>
                <div class="address-sub">
                  W linii prostej: ${escapeHtml(straightFormatted)}
                </div>
              </td>
              <td class="cell-drive">
                <span class="dist-main"><span aria-hidden="true">🚗</span> ${escapeHtml(driveKm)}</span>
                ${driveDuration ? `<span class="dist-sub">(${escapeHtml(driveDuration)})</span>` : ""}
                <span class="mobile-straight">• 📏 ${escapeHtml(straightFormatted)}</span>
              </td>
              <td class="cell-straight">
                ${escapeHtml(straightFormatted)}
              </td>
              <td class="cell-actions">
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
      <span>Źródło: Ekosystem Wrocław • Trasy: OSRM</span>
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
