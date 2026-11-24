/**
 * Controlador Principal de la Aplicación (app.js)
 * Conecta UI, Servicio OSRM/Haversine, ACO, PSO, Leaflet y Chart.js.
 */

import { INITIAL_LOCATIONS } from './data/locations.js';
import { RoutingService } from './services/routingService.js';
import { AntColonyOptimizer } from './algorithms/aco.js';
import { ParticleSwarmOptimizer } from './algorithms/pso.js';
import { MapManager } from './ui/mapManager.js';
import { ConvergenceChartManager } from './ui/chartManager.js';

class LogisticsApp {
  constructor() {
    this.locations = JSON.parse(JSON.stringify(INITIAL_LOCATIONS));
    this.routingService = new RoutingService();
    this.mapManager = null;
    this.chartManager = null;

    this.distanceMatrix = null;
    this.durationMatrix = null;
    this.activeLocations = [];
    this.matrixHash = '';

    this.isRunning = false;
    this.cancellationToken = { cancelled: false };

    this.acoBest = null;
    this.psoBest = null;
    this.initialTourDistance = 0;

    this.init();
  }

  async init() {
    this.mapManager = new MapManager('mapContainer', {
      onAddLocation: (lat, lng) => this.handleAddNewLocation(lat, lng)
    });

    this.chartManager = new ConvergenceChartManager('convergenceChart');

    this.setupEventListeners();
    this.renderStopsList();
    this.mapManager.renderLocations(
      this.getActiveLocations(),
      (id) => this.toggleLocation(id),
      (id) => this.removeLocation(id)
    );
    this.mapManager.fitBoundsToLocations(this.getActiveLocations());

    // Pre-cargar matriz de distancias
    await this.updateDistanceMatrix();
  }

  getActiveLocations() {
    return this.locations.filter(l => l.active);
  }

  async updateDistanceMatrix() {
    const active = this.getActiveLocations();
    const currentHash = active.map(l => `${l.id}:${l.lat.toFixed(4)},${l.lng.toFixed(4)}`).join('|');

    if (this.matrixHash === currentHash && this.distanceMatrix) {
      return;
    }

    this.updateStatusBadge('Cargando matriz vial OSRM...', 'loading');

    try {
      const res = await this.routingService.getDistanceMatrix(active);
      this.distanceMatrix = res.distances;
      this.durationMatrix = res.durations;
      this.activeLocations = active;
      this.matrixHash = currentHash;

      // Calcular distancia inicial de referencia (orden secuencial)
      const seqTour = [];
      for (let i = 0; i < active.length; i++) seqTour.push(i);
      seqTour.push(0);

      this.initialTourDistance = 0;
      for (let i = 0; i < seqTour.length - 1; i++) {
        this.initialTourDistance += this.distanceMatrix[seqTour[i]][seqTour[i + 1]];
      }

      const initialCoords = seqTour.map(idx => [active[idx].lat, active[idx].lng]);
      this.mapManager.drawRoute('initial', initialCoords);

      if (res.mode === 'osrm') {
        this.updateStatusBadge('Red Vial OSRM (Calles Reales)', 'online');
      } else {
        this.updateStatusBadge('Modo Fallback Haversine (Sin Límites)', 'offline');
      }

      this.updateMetricsDisplay({
        initialDist: this.initialTourDistance
      });
    } catch (err) {
      console.error("Error al actualizar matriz de distancias:", err);
      this.updateStatusBadge('Error al conectar con OSRM', 'error');
    }
  }

  setupEventListeners() {
    // Sliders de ACO
    const acoInputs = ['acoAnts', 'acoIterations', 'acoAlpha', 'acoBeta', 'acoRho', 'acoQ'];
    acoInputs.forEach(id => {
      const el = document.getElementById(id);
      const valEl = document.getElementById(`${id}Val`);
      if (el && valEl) {
        el.addEventListener('input', () => {
          valEl.textContent = el.value;
        });
      }
    });

    // Sliders de PSO
    const psoInputs = ['psoParticles', 'psoIterations', 'psoW', 'psoC1', 'psoC2'];
    psoInputs.forEach(id => {
      const el = document.getElementById(id);
      const valEl = document.getElementById(`${id}Val`);
      if (el && valEl) {
        el.addEventListener('input', () => {
          valEl.textContent = el.value;
        });
      }
    });

    // Botones de ejecución
    document.getElementById('btnRunAco')?.addEventListener('click', () => this.runSingleAlgorithm('aco'));
    document.getElementById('btnRunPso')?.addEventListener('click', () => this.runSingleAlgorithm('pso'));
    document.getElementById('btnRunComparison')?.addEventListener('click', () => this.runComparison());
    document.getElementById('btnStop')?.addEventListener('click', () => this.stopExecution());
    document.getElementById('btnReset')?.addEventListener('click', () => this.resetSimulation());

    // Botón agregar parada
    const btnAddStop = document.getElementById('btnAddStopMode');
    if (btnAddStop) {
      btnAddStop.addEventListener('click', () => {
        const isCurrentlyAdd = btnAddStop.classList.contains('bg-amber-600');
        if (isCurrentlyAdd) {
          btnAddStop.classList.remove('bg-amber-600', 'text-white');
          btnAddStop.classList.add('bg-slate-800', 'text-slate-300');
          btnAddStop.textContent = '📍 Clic en Mapa para Añadir Parada';
          this.mapManager.setAddMode(false);
        } else {
          btnAddStop.classList.add('bg-amber-600', 'text-white');
          btnAddStop.classList.remove('bg-slate-800', 'text-slate-300');
          btnAddStop.textContent = '❌ Cancelar Modo Añadir (Haz clic en el mapa)';
          this.mapManager.setAddMode(true);
        }
      });
    }

    // Modal de Notas de Investigación
    const modalBtn = document.getElementById('btnOpenResearchModal');
    const modal = document.getElementById('researchModal');
    const closeBtn = document.getElementById('btnCloseResearchModal');

    if (modalBtn && modal && closeBtn) {
      modalBtn.addEventListener('click', () => modal.classList.remove('hidden'));
      closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
      });
    }

    // Presets rápidos
    document.querySelectorAll('[data-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.getAttribute('data-preset');
        this.applyParameterPreset(preset);
      });
    });
  }

  applyParameterPreset(preset) {
    if (preset === 'balanced') {
      this.setInputValue('acoAnts', 30);
      this.setInputValue('acoIterations', 50);
      this.setInputValue('acoAlpha', 1.2);
      this.setInputValue('acoBeta', 3.5);
      this.setInputValue('acoRho', 0.15);
      this.setInputValue('acoQ', 100);

      this.setInputValue('psoParticles', 30);
      this.setInputValue('psoIterations', 50);
      this.setInputValue('psoW', 0.7);
      this.setInputValue('psoC1', 1.5);
      this.setInputValue('psoC2', 1.8);
    } else if (preset === 'exploration') {
      this.setInputValue('acoAnts', 45);
      this.setInputValue('acoIterations', 60);
      this.setInputValue('acoAlpha', 0.8);
      this.setInputValue('acoBeta', 5.0);
      this.setInputValue('acoRho', 0.35);
      this.setInputValue('acoQ', 150);

      this.setInputValue('psoParticles', 50);
      this.setInputValue('psoIterations', 60);
      this.setInputValue('psoW', 0.85);
      this.setInputValue('psoC1', 1.0);
      this.setInputValue('psoC2', 2.4);
    } else if (preset === 'fast') {
      this.setInputValue('acoAnts', 20);
      this.setInputValue('acoIterations', 30);
      this.setInputValue('acoAlpha', 2.0);
      this.setInputValue('acoBeta', 2.5);
      this.setInputValue('acoRho', 0.08);
      this.setInputValue('acoQ', 80);

      this.setInputValue('psoParticles', 20);
      this.setInputValue('psoIterations', 30);
      this.setInputValue('psoW', 0.5);
      this.setInputValue('psoC1', 2.0);
      this.setInputValue('psoC2', 1.2);
    }
  }

  setInputValue(id, val) {
    const el = document.getElementById(id);
    const valEl = document.getElementById(`${id}Val`);
    if (el) {
      el.value = val;
      if (valEl) valEl.textContent = val;
    }
  }

  renderStopsList() {
    const container = document.getElementById('stopsListContainer');
    if (!container) return;

    container.innerHTML = '';
    const activeCountEl = document.getElementById('activeStopsCount');
    const activeLocs = this.getActiveLocations();
    if (activeCountEl) {
      activeCountEl.textContent = `${activeLocs.length - 1} paradas activas`;
    }

    this.locations.forEach((loc, idx) => {
      const isDepot = loc.type === 'depot';
      const item = document.createElement('div');
      item.className = `flex items-center justify-between p-2 rounded text-xs transition-colors ${
        loc.active ? 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200' : 'bg-slate-900/40 text-slate-500'
      } border border-slate-700/40 mb-1.5`;

      item.innerHTML = `
        <div class="flex items-center gap-2 overflow-hidden">
          <input type="checkbox" id="stop_${loc.id}" ${loc.active ? 'checked' : ''} ${isDepot ? 'disabled' : ''}
            class="rounded border-slate-600 text-amber-500 focus:ring-0 ${isDepot ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}">
          <label for="stop_${loc.id}" class="truncate cursor-pointer">
            <span class="font-bold ${isDepot ? 'text-amber-400' : 'text-cyan-400'}">
              ${isDepot ? 'Depósito DGD1' : `#${idx}`}
            </span>
            <span class="ml-1 text-slate-300">${loc.name}</span>
          </label>
        </div>
        ${!isDepot && loc.isCustom ? `
          <button class="delete-custom-stop text-rose-400 hover:text-rose-300 p-1" data-id="${loc.id}" title="Eliminar parada">
            &times;
          </button>
        ` : ''}
      `;

      const checkbox = item.querySelector('input[type="checkbox"]');
      if (checkbox && !isDepot) {
        checkbox.addEventListener('change', () => this.toggleLocation(loc.id));
      }

      const delBtn = item.querySelector('.delete-custom-stop');
      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.removeLocation(loc.id);
        });
      }

      container.appendChild(item);
    });
  }

  async toggleLocation(id) {
    if (this.isRunning) return;
    const loc = this.locations.find(l => l.id === id);
    if (!loc || loc.type === 'depot') return;

    loc.active = !loc.active;
    this.renderStopsList();
    this.mapManager.renderLocations(
      this.getActiveLocations(),
      (locId) => this.toggleLocation(locId),
      (locId) => this.removeLocation(locId)
    );
    await this.updateDistanceMatrix();
  }

  async removeLocation(id) {
    if (this.isRunning) return;
    this.locations = this.locations.filter(l => l.id !== id);
    this.renderStopsList();
    this.mapManager.renderLocations(
      this.getActiveLocations(),
      (locId) => this.toggleLocation(locId),
      (locId) => this.removeLocation(locId)
    );
    await this.updateDistanceMatrix();
  }

  async handleAddNewLocation(lat, lng) {
    const nextId = Math.max(...this.locations.map(l => l.id), 0) + 1;
    const newLoc = {
      id: nextId,
      name: `Parada Personalizada #${nextId}`,
      lat: lat,
      lng: lng,
      type: 'delivery',
      address: `Coordenadas: ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      active: true,
      isCustom: true
    };

    this.locations.push(newLoc);
    this.renderStopsList();
    this.mapManager.renderLocations(
      this.getActiveLocations(),
      (id) => this.toggleLocation(id),
      (id) => this.removeLocation(id)
    );
    await this.updateDistanceMatrix();
  }

  updateStatusBadge(text, type = 'online') {
    const badge = document.getElementById('statusBadge');
    if (!badge) return;

    badge.className = 'px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ';
    if (type === 'online') {
      badge.className += 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-400';
      badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> ${text}`;
    } else if (type === 'offline') {
      badge.className += 'bg-amber-950/80 border border-amber-500/50 text-amber-400';
      badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400"></span> ${text}`;
    } else if (type === 'loading') {
      badge.className += 'bg-cyan-950/80 border border-cyan-500/50 text-cyan-400';
      badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span> ${text}`;
    } else {
      badge.className += 'bg-rose-950/80 border border-rose-500/50 text-rose-400';
      badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-rose-400"></span> ${text}`;
    }
  }

  getAcoOptions() {
    return {
      numAnts: parseInt(document.getElementById('acoAnts')?.value || 30),
      iterations: parseInt(document.getElementById('acoIterations')?.value || 50),
      alpha: parseFloat(document.getElementById('acoAlpha')?.value || 1.2),
      beta: parseFloat(document.getElementById('acoBeta')?.value || 3.5),
      rho: parseFloat(document.getElementById('acoRho')?.value || 0.15),
      q: parseFloat(document.getElementById('acoQ')?.value || 100),
      elitistWeight: 2.0
    };
  }

  getPsoOptions() {
    return {
      numParticles: parseInt(document.getElementById('psoParticles')?.value || 30),
      iterations: parseInt(document.getElementById('psoIterations')?.value || 50),
      w: parseFloat(document.getElementById('psoW')?.value || 0.7),
      c1: parseFloat(document.getElementById('psoC1')?.value || 1.5),
      c2: parseFloat(document.getElementById('psoC2')?.value || 1.8)
    };
  }

  setButtonsDisabled(disabled) {
    ['btnRunAco', 'btnRunPso', 'btnRunComparison'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = disabled;
    });
    const stopBtn = document.getElementById('btnStop');
    if (stopBtn) stopBtn.disabled = !disabled;
  }

  stopExecution() {
    this.cancellationToken.cancelled = true;
    this.isRunning = false;
    this.setButtonsDisabled(false);
    this.updateStatusBadge('Optimización pausada por el usuario', 'offline');
  }

  resetSimulation() {
    this.stopExecution();
    this.chartManager.reset();
    this.mapManager.clearRoutes();
    this.acoBest = null;
    this.psoBest = null;

    // Volver a trazar la ruta secuencial inicial
    const seqTour = [];
    for (let i = 0; i < this.activeLocations.length; i++) seqTour.push(i);
    seqTour.push(0);
    const initialCoords = seqTour.map(idx => [this.activeLocations[idx].lat, this.activeLocations[idx].lng]);
    this.mapManager.drawRoute('initial', initialCoords);

    this.updateMetricsDisplay({
      bestDist: 0,
      timeMs: 0,
      improvementPct: 0,
      estimatedHours: 0
    });
  }

  async runSingleAlgorithm(algo) {
    if (this.isRunning) return;
    await this.updateDistanceMatrix();

    this.isRunning = true;
    this.cancellationToken = { cancelled: false };
    this.setButtonsDisabled(true);

    if (algo === 'aco') {
      await this.executeACO();
    } else {
      await this.executePSO();
    }

    this.isRunning = false;
    this.setButtonsDisabled(false);
  }

  async executeACO() {
    const options = this.getAcoOptions();
    const optimizer = new AntColonyOptimizer(this.distanceMatrix, options);
    this.updateStatusBadge(`Ejecutando ACO (${options.iterations} iteraciones)...`, 'loading');

    const result = await optimizer.run((data) => {
      // Callback por iteración
      this.chartManager.addDataPoint('aco', data.iteration, data.bestDistance);

      // Dibujar ruta actual en mapa (líneas rectas intermedias para velocidad fluida)
      const tourCoords = data.bestTour.map(idx => [this.activeLocations[idx].lat, this.activeLocations[idx].lng]);
      this.mapManager.drawRoute('aco', tourCoords);

      const imp = ((this.initialTourDistance - data.bestDistance) / this.initialTourDistance) * 100;
      this.updateMetricsDisplay({
        bestDist: data.bestDistance,
        improvementPct: imp,
        currentIter: data.iteration,
        totalIter: options.iterations,
        algoName: 'ACO'
      });
    }, this.cancellationToken);

    this.acoBest = result;

    // Obtener geometría detallada sobre calles con OSRM para la ruta final
    if (!this.cancellationToken.cancelled) {
      this.updateStatusBadge('Trazando geometría vial exacta...', 'loading');
      const orderedLocs = result.bestTour.map(idx => this.activeLocations[idx]);
      const streetGeo = await this.routingService.getRouteGeometry(orderedLocs);
      if (streetGeo && streetGeo.coordinates) {
        this.mapManager.drawRoute('aco', streetGeo.coordinates);
      }
      this.updateStatusBadge(`ACO completado: ${result.bestDistance.toFixed(2)} km en ${result.totalTimeMs.toFixed(0)} ms`, 'online');
    }

    return result;
  }

  async executePSO() {
    const options = this.getPsoOptions();
    const optimizer = new ParticleSwarmOptimizer(this.distanceMatrix, options);
    this.updateStatusBadge(`Ejecutando PSO (${options.iterations} iteraciones)...`, 'loading');

    const result = await optimizer.run((data) => {
      // Callback por iteración
      this.chartManager.addDataPoint('pso', data.iteration, data.bestDistance);

      // Dibujar ruta actual en mapa
      const tourCoords = data.bestTour.map(idx => [this.activeLocations[idx].lat, this.activeLocations[idx].lng]);
      this.mapManager.drawRoute('pso', tourCoords);

      const imp = ((this.initialTourDistance - data.bestDistance) / this.initialTourDistance) * 100;
      this.updateMetricsDisplay({
        bestDist: data.bestDistance,
        improvementPct: imp,
        currentIter: data.iteration,
        totalIter: options.iterations,
        algoName: 'PSO'
      });
    }, this.cancellationToken);

    this.psoBest = result;

    if (!this.cancellationToken.cancelled) {
      this.updateStatusBadge('Trazando geometría vial exacta...', 'loading');
      const orderedLocs = result.bestTour.map(idx => this.activeLocations[idx]);
      const streetGeo = await this.routingService.getRouteGeometry(orderedLocs);
      if (streetGeo && streetGeo.coordinates) {
        this.mapManager.drawRoute('pso', streetGeo.coordinates);
      }
      this.updateStatusBadge(`PSO completado: ${result.bestDistance.toFixed(2)} km en ${result.totalTimeMs.toFixed(0)} ms`, 'online');
    }

    return result;
  }

  async runComparison() {
    if (this.isRunning) return;
    await this.updateDistanceMatrix();

    this.isRunning = true;
    this.cancellationToken = { cancelled: false };
    this.setButtonsDisabled(true);
    this.chartManager.reset();
    this.mapManager.clearRoutes();

    this.updateStatusBadge('Fase 1/2: Ejecutando Ant Colony Optimization...', 'loading');
    const acoRes = await this.executeACO();

    if (this.cancellationToken.cancelled) {
      this.isRunning = false;
      this.setButtonsDisabled(false);
      return;
    }

    this.updateStatusBadge('Fase 2/2: Ejecutando Particle Swarm Optimization...', 'loading');
    const psoRes = await this.executePSO();

    if (!this.cancellationToken.cancelled) {
      // Mostrar ambas rutas en mapa para comparación visual
      const acoLocs = acoRes.bestTour.map(idx => this.activeLocations[idx]);
      const psoLocs = psoRes.bestTour.map(idx => this.activeLocations[idx]);

      const [acoGeo, psoGeo] = await Promise.all([
        this.routingService.getRouteGeometry(acoLocs),
        this.routingService.getRouteGeometry(psoLocs)
      ]);

      if (acoGeo) this.mapManager.drawRoute('aco', acoGeo.coordinates);
      if (psoGeo) this.mapManager.drawRoute('pso', psoGeo.coordinates);

      const winner = acoRes.bestDistance < psoRes.bestDistance ? 'ACO' : 'PSO';
      const diffKm = Math.abs(acoRes.bestDistance - psoRes.bestDistance).toFixed(2);
      this.updateStatusBadge(`Comparativa lista: Ganador ${winner} por ${diffKm} km de ventaja`, 'online');
    }

    this.isRunning = false;
    this.setButtonsDisabled(false);
  }

  updateMetricsDisplay(data) {
    if (data.bestDist !== undefined) {
      const distEl = document.getElementById('metricDistance');
      if (distEl) distEl.textContent = `${data.bestDist.toFixed(2)} km`;

      // Tiempo estimado: duración de ruta vial (promedio 25 km/h) + 5 min descarga por parada
      const stops = this.activeLocations.length - 1;
      const driveMinutes = (data.bestDist / 25.0) * 60;
      const deliveryMinutes = stops * 5;
      const totalMinutes = Math.round(driveMinutes + deliveryMinutes);
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;

      const timeEl = document.getElementById('metricTime');
      if (timeEl) timeEl.textContent = `${hours}h ${mins}m`;
    }

    if (data.improvementPct !== undefined) {
      const impEl = document.getElementById('metricImprovement');
      if (impEl) impEl.textContent = `${Math.max(0, data.improvementPct).toFixed(1)}%`;
    }

    if (data.currentIter && data.totalIter) {
      const iterEl = document.getElementById('metricIteration');
      if (iterEl) iterEl.textContent = `${data.currentIter}/${data.totalIter} (${data.algoName || ''})`;
    }
  }
}

// Inicializar al cargar el DOM
window.addEventListener('DOMContentLoaded', () => {
  window.app = new LogisticsApp();
});
