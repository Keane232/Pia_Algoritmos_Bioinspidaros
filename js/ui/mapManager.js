/**
 * Administrador del Mapa con Leaflet.js
 * - Capas base gratuitas: CartoDB Positron y OpenStreetMap.
 * - Marcadores personalizados de estilo logístico (Amazon Station DGD1 + Paradas de entrega).
 * - Renderizado de rutas en vivo para ACO (Cyan) y PSO (Esmeralda).
 * - Interacción para añadir nuevas paradas haciendo clic sobre el mapa.
 */

export class MapManager {
  constructor(mapContainerId, options = {}) {
    this.containerId = mapContainerId;
    this.onAddLocationCallback = options.onAddLocation || null;

    this.map = null;
    this.markersLayer = null;
    this.acoRouteLayer = null;
    this.psoRouteLayer = null;
    this.initialRouteLayer = null;

    this.isAddMode = false;

    this.initMap();
  }

  initMap() {
    // Coordenadas centrales de Guadalajara
    this.map = L.map(this.containerId, {
      center: [20.6650, -103.3800],
      zoom: 12,
      zoomControl: false
    });

    L.control.zoom({ position: 'topright' }).addTo(this.map);

    // Capa base CartoDB Positron (libre, estética y limpia)
    const cartoPositron = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
      }
    ).addTo(this.map);

    const osmStandard = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }
    );

    L.control.layers({
      'CartoDB Voyager': cartoPositron,
      'OpenStreetMap': osmStandard
    }, null, { position: 'topright' }).addTo(this.map);

    // Grupos de capas
    this.markersLayer = L.layerGroup().addTo(this.map);
    this.acoRouteLayer = L.layerGroup().addTo(this.map);
    this.psoRouteLayer = L.layerGroup().addTo(this.map);
    this.initialRouteLayer = L.layerGroup().addTo(this.map);

    // Manejar clics para añadir paradas
    this.map.on('click', (e) => {
      if (this.isAddMode && this.onAddLocationCallback) {
        this.onAddLocationCallback(e.latlng.lat, e.latlng.lng);
      }
    });
  }

  setAddMode(enabled) {
    this.isAddMode = enabled;
    const container = document.getElementById(this.containerId);
    if (enabled) {
      container.style.cursor = 'crosshair';
    } else {
      container.style.cursor = '';
    }
  }

  /**
   * Crea iconos SVG estilizados para el depósito y paradas.
   */
  createCustomIcon(location, index) {
    if (location.type === 'depot') {
      return L.divIcon({
        className: 'custom-depot-pin',
        html: `
          <div class="relative flex items-center justify-center w-10 h-10 bg-slate-900 border-2 border-amber-500 rounded-full shadow-xl shadow-amber-500/30 transform hover:scale-110 transition-transform">
            <svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
            </svg>
            <span class="absolute -bottom-1 -right-1 flex h-3 w-3">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -20]
      });
    }

    const badgeColor = location.isCustom ? 'bg-emerald-600 border-emerald-400' : 'bg-blue-600 border-blue-400';
    return L.divIcon({
      className: 'custom-stop-pin',
      html: `
        <div class="relative flex items-center justify-center w-7 h-7 ${badgeColor} text-white font-bold text-xs rounded-full border-2 shadow-md hover:scale-125 transition-transform">
          <span>${index}</span>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14]
    });
  }

  /**
   * Actualiza los marcadores en el mapa basándose en la lista de ubicaciones activas.
   */
  renderLocations(locations, onToggleStatus, onRemoveLocation) {
    this.markersLayer.clearLayers();

    locations.forEach((loc, idx) => {
      const isDepot = loc.type === 'depot';
      const icon = this.createCustomIcon(loc, idx);

      const marker = L.marker([loc.lat, loc.lng], { icon });

      let popupContent = `
        <div class="p-2 max-w-xs font-sans text-slate-800 text-xs">
          <div class="font-bold text-sm ${isDepot ? 'text-amber-600' : 'text-blue-600'} mb-1">
            ${isDepot ? '📦 ' + loc.name : `#${idx}: ${loc.name}`}
          </div>
          <p class="text-slate-500 mb-2">${loc.address || 'Ubicación en mapa'}</p>
          <div class="flex items-center justify-between text-[11px] text-slate-400 border-t pt-1">
            <span>Lat: ${loc.lat.toFixed(4)}, Lng: ${loc.lng.toFixed(4)}</span>
          </div>
      `;

      if (!isDepot && onToggleStatus) {
        popupContent += `
          <div class="mt-2 flex gap-1">
            <button class="toggle-stop-btn px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium w-full">
              ${loc.active ? 'Desactivar Parada' : 'Activar Parada'}
            </button>
          </div>
        `;
      }

      popupContent += `</div>`;
      marker.bindPopup(popupContent);

      marker.on('popupopen', () => {
        const btn = document.querySelector('.toggle-stop-btn');
        if (btn) {
          btn.onclick = () => {
            onToggleStatus(loc.id);
            marker.closePopup();
          };
        }
      });

      this.markersLayer.addLayer(marker);
    });
  }

  /**
   * Dibuja una ruta para un algoritmo específico.
   * @param {string} algorithm - 'aco' | 'pso' | 'initial'
   * @param {Array} coordinates - Array de pares [lat, lng]
   * @param {object} options - Opciones de estilo
   */
  drawRoute(algorithm, coordinates, options = {}) {
    let layerGroup;
    let color;
    let dashArray = null;
    let weight = 4;
    let opacity = 0.85;

    if (algorithm === 'aco') {
      layerGroup = this.acoRouteLayer;
      color = '#06b6d4'; // Cyan 500
      weight = options.weight || 4.5;
    } else if (algorithm === 'pso') {
      layerGroup = this.psoRouteLayer;
      color = '#10b981'; // Emerald 500
      weight = options.weight || 4.5;
    } else {
      layerGroup = this.initialRouteLayer;
      color = '#94a3b8'; // Slate 400
      dashArray = '5, 8';
      weight = 2.5;
      opacity = 0.6;
    }

    layerGroup.clearLayers();

    if (!coordinates || coordinates.length < 2) return;

    // Línea de resplandor exterior (halo)
    if (algorithm === 'aco' || algorithm === 'pso') {
      const glowLine = L.polyline(coordinates, {
        color: color,
        weight: weight + 4,
        opacity: 0.25,
        lineCap: 'round',
        lineJoin: 'round'
      });
      layerGroup.addLayer(glowLine);
    }

    const polyline = L.polyline(coordinates, {
      color: color,
      weight: weight,
      opacity: opacity,
      dashArray: dashArray,
      lineCap: 'round',
      lineJoin: 'round'
    });

    layerGroup.addLayer(polyline);
  }

  clearRoutes() {
    this.acoRouteLayer.clearLayers();
    this.psoRouteLayer.clearLayers();
    this.initialRouteLayer.clearLayers();
  }

  fitBoundsToLocations(locations) {
    if (!locations || locations.length === 0) return;
    const bounds = L.latLngBounds(locations.map(l => [l.lat, l.lng]));
    this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
  }
}
