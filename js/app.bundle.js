/**
 * AMZL Last-Mile Route Optimizer (Bundle Completo para Ejecución Local y Web)
 * Guadalajara (ZMG), México.
 *
 * Contiene:
 * 1. INITIAL_LOCATIONS (Depósito DGD1 + 14 Paradas)
 * 2. RoutingService (OSRM Table & Route API + Fallback Haversine)
 * 3. AntColonyOptimizer (ACO para TSP con depósito)
 * 4. ParticleSwarmOptimizer (Swap Sequence PSO para TSP)
 * 5. MapManager (Leaflet.js)
 * 6. ConvergenceChartManager (Chart.js)
 * 7. LogisticsApp (Controlador e Interfaz)
 */

(function () {
  'use strict';

  // ==========================================
  // 1. DATOS GEOGRÁFICOS DE GUADALAJARA
  // ==========================================
  const INITIAL_LOCATIONS = [
    {
      id: 0,
      name: "Estación de Entrega Amazon DGD1 (Zona Industrial)",
      lat: 20.6350,
      lng: -103.3578,
      type: "depot",
      address: "Calle Héroes Ferrocarrileros, Zona Industrial, Guadalajara",
      active: true
    },
    {
      id: 1,
      name: "Expo Guadalajara",
      lat: 20.6534,
      lng: -103.3917,
      type: "delivery",
      address: "Av. Mariano Otero 1499, Verde Valle",
      active: true
    },
    {
      id: 2,
      name: "Glorieta Minerva",
      lat: 20.6744,
      lng: -103.3874,
      type: "delivery",
      address: "Av. Adolfo López Mateos Nte., Vallarta Poniente",
      active: true
    },
    {
      id: 3,
      name: "Catedral / Centro Histórico GDL",
      lat: 20.6770,
      lng: -103.3470,
      type: "delivery",
      address: "Av. Fray Antonio Alcalde 10, Centro",
      active: true
    },
    {
      id: 4,
      name: "Plaza Patria",
      lat: 20.7107,
      lng: -103.3768,
      type: "delivery",
      address: "Av. Patria y Av. Américas, Zapopan",
      active: true
    },
    {
      id: 5,
      name: "Andares Mall (Puerta de Hierro)",
      lat: 20.7099,
      lng: -103.4140,
      type: "delivery",
      address: "Blvd. Puerta de Hierro 4965, Zapopan",
      active: true
    },
    {
      id: 6,
      name: "Estadio Akron (El Bajío)",
      lat: 20.6817,
      lng: -103.4628,
      type: "delivery",
      address: "Circuito JVC 2800, El Bajío, Zapopan",
      active: true
    },
    {
      id: 7,
      name: "Tlaquepaque Centro (El Parián)",
      lat: 20.6402,
      lng: -103.3135,
      type: "delivery",
      address: "Calle Juárez 68, Centro, San Pedro Tlaquepaque",
      active: true
    },
    {
      id: 8,
      name: "Parque Metropolitano",
      lat: 20.6698,
      lng: -103.4443,
      type: "delivery",
      address: "Av. Ludwig van Beethoven 5800, La Estancia",
      active: true
    },
    {
      id: 9,
      name: "ITESO Universidad",
      lat: 20.6079,
      lng: -103.4150,
      type: "delivery",
      address: "Periférico Sur Manuel Gómez Morín 8585, Tlaquepaque",
      active: true
    },
    {
      id: 10,
      name: "CUCEI Universidad de Guadalajara",
      lat: 20.6570,
      lng: -103.3262,
      type: "delivery",
      address: "Blvd. Marcelino García Barragán 1421, Olímpica",
      active: true
    },
    {
      id: 11,
      name: "Plaza del Sol",
      lat: 20.6508,
      lng: -103.4005,
      type: "delivery",
      address: "Av. Mariano Otero y Av. López Mateos, Chapalita",
      active: true
    },
    {
      id: 12,
      name: "Zapopan Centro (Basílica)",
      lat: 20.7214,
      lng: -103.3922,
      type: "delivery",
      address: "Calle Eva Briseño 152, Zapopan Centro",
      active: true
    },
    {
      id: 13,
      name: "Chapultepec / Zona Rosa",
      lat: 20.6738,
      lng: -103.3688,
      type: "delivery",
      address: "Av. Chapultepec y Av. Vallarta, Americana",
      active: true
    },
    {
      id: 14,
      name: "Tonalá Centro (Andador Artesanal)",
      lat: 20.6247,
      lng: -103.2425,
      type: "delivery",
      address: "Av. Tonaltecas y Av. Juárez, Centro, Tonalá",
      active: true
    }
  ];

  // ==========================================
  // 2. SERVICIO DE RUTEO (OSRM + HAVERSINE)
  // ==========================================
  class RoutingService {
    constructor() {
      this.osrmBaseUrl = 'https://router.project-osrm.org';
      this.matrixCache = new Map();
      this.routeCache = new Map();
      this.lastMode = 'osrm';
    }

    static haversineDistance(lat1, lon1, lat2, lon2) {
      const R = 6371;
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLon = (lon2 - lon1) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
          Math.cos(lat2 * (Math.PI / 180)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    }

    calculateHaversineMatrix(locations) {
      const n = locations.length;
      const distances = Array.from({ length: n }, () => new Float64Array(n));
      const durations = Array.from({ length: n }, () => new Float64Array(n));
      const urbanTortuosityFactor = 1.32;
      const avgSpeedKmH = 26.0;

      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (i === j) {
            distances[i][j] = 0;
            durations[i][j] = 0;
          } else {
            const directKm = RoutingService.haversineDistance(
              locations[i].lat, locations[i].lng,
              locations[j].lat, locations[j].lng
            );
            const streetKm = directKm * urbanTortuosityFactor;
            distances[i][j] = streetKm;
            durations[i][j] = (streetKm / avgSpeedKmH) * 3600;
          }
        }
      }
      return { distances, durations, mode: 'haversine' };
    }

    async getDistanceMatrix(locations) {
      if (!locations || locations.length < 2) {
        throw new Error("Se requieren al menos 2 ubicaciones para calcular la matriz.");
      }

      const cacheKey = locations.map(l => `${l.id}:${l.lat.toFixed(4)},${l.lng.toFixed(4)}`).join('|');
      if (this.matrixCache.has(cacheKey)) {
        return this.matrixCache.get(cacheKey);
      }

      const coordsParam = locations.map(l => `${l.lng},${l.lat}`).join(';');
      const url = `${this.osrmBaseUrl}/table/v1/driving/${coordsParam}?annotations=distance,duration`;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3800);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`OSRM HTTP ${response.status}`);

        const data = await response.json();
        if (data.code !== 'Ok' || !data.distances) {
          throw new Error(`Respuesta OSRM no válida: ${data.code}`);
        }

        const n = locations.length;
        const distances = Array.from({ length: n }, () => new Float64Array(n));
        const durations = Array.from({ length: n }, () => new Float64Array(n));

        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            if (data.distances[i][j] === null || data.distances[i][j] === undefined) {
              const fbDist = RoutingService.haversineDistance(
                locations[i].lat, locations[i].lng,
                locations[j].lat, locations[j].lng
              ) * 1.35;
              distances[i][j] = fbDist;
              durations[i][j] = (fbDist / 25) * 3600;
            } else {
              distances[i][j] = data.distances[i][j] / 1000.0;
              durations[i][j] = data.durations ? data.durations[i][j] : (distances[i][j] / 25) * 3600;
            }
          }
        }

        const result = { distances, durations, mode: 'osrm' };
        this.lastMode = 'osrm';
        this.matrixCache.set(cacheKey, result);
        return result;
      } catch (err) {
        console.warn("Fallo o timeout en OSRM Table API. Usando matriz Haversine:", err.message);
        const fallbackResult = this.calculateHaversineMatrix(locations);
        this.lastMode = 'haversine';
        this.matrixCache.set(cacheKey, fallbackResult);
        return fallbackResult;
      }
    }

    async getRouteGeometry(tourLocations) {
      if (!tourLocations || tourLocations.length < 2) return null;

      const cacheKey = tourLocations.map(l => l.id).join('->');
      if (this.routeCache.has(cacheKey)) {
        return this.routeCache.get(cacheKey);
      }

      const coordsParam = tourLocations.map(l => `${l.lng},${l.lat}`).join(';');
      const url = `${this.osrmBaseUrl}/route/v1/driving/${coordsParam}?overview=full&geometries=geojson`;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4500);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`OSRM Route HTTP ${response.status}`);

        const data = await response.json();
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const latLngs = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
          const totalDistanceKm = data.routes[0].distance / 1000.0;
          const totalDurationSec = data.routes[0].duration;

          const result = {
            coordinates: latLngs,
            distanceKm: totalDistanceKm,
            durationSec: totalDurationSec,
            isRealStreet: true
          };
          this.routeCache.set(cacheKey, result);
          return result;
        }
      } catch (err) {
        console.warn("Fallo al obtener geometría de ruta OSRM:", err.message);
      }

      const directCoords = tourLocations.map(l => [l.lat, l.lng]);
      let directDistKm = 0;
      for (let i = 0; i < tourLocations.length - 1; i++) {
        directDistKm += RoutingService.haversineDistance(
          tourLocations[i].lat, tourLocations[i].lng,
          tourLocations[i + 1].lat, tourLocations[i + 1].lng
        );
      }

      return {
        coordinates: directCoords,
        distanceKm: directDistKm * 1.32,
        durationSec: ((directDistKm * 1.32) / 25) * 3600,
        isRealStreet: false
      };
    }
  }

  // ==========================================
  // 3. ANT COLONY OPTIMIZATION (ACO)
  // ==========================================
  class AntColonyOptimizer {
    constructor(distanceMatrix, options = {}) {
      this.distances = distanceMatrix;
      this.n = distanceMatrix.length;

      this.numAnts = options.numAnts || 30;
      this.iterations = options.iterations || 50;
      this.alpha = options.alpha !== undefined ? options.alpha : 1.2;
      this.beta = options.beta !== undefined ? options.beta : 3.5;
      this.rho = options.rho !== undefined ? options.rho : 0.15;
      this.q = options.q !== undefined ? options.q : 100.0;
      this.elitistWeight = options.elitistWeight !== undefined ? options.elitistWeight : 2.0;

      this.tauMin = 0.001;
      this.tauMax = 100.0;

      this.pheromones = null;
      this.heuristic = null;
      this.globalBestTour = null;
      this.globalBestDistance = Infinity;

      this.initMatrices();
    }

    initMatrices() {
      const n = this.n;
      this.heuristic = Array.from({ length: n }, () => new Float64Array(n));
      this.pheromones = Array.from({ length: n }, () => new Float64Array(n));

      const greedyDist = this.calculateGreedyTourDistance();
      const tau0 = this.numAnts / Math.max(1, greedyDist);

      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (i !== j) {
            const d = Math.max(this.distances[i][j], 0.0001);
            this.heuristic[i][j] = 1.0 / d;
            this.pheromones[i][j] = tau0;
          } else {
            this.heuristic[i][j] = 0;
            this.pheromones[i][j] = 0;
          }
        }
      }
    }

    calculateGreedyTourDistance() {
      const visited = new Uint8Array(this.n);
      let curr = 0;
      visited[0] = 1;
      let dist = 0;

      for (let step = 1; step < this.n; step++) {
        let next = -1;
        let minD = Infinity;
        for (let j = 1; j < this.n; j++) {
          if (!visited[j] && this.distances[curr][j] < minD) {
            minD = this.distances[curr][j];
            next = j;
          }
        }
        if (next === -1) break;
        visited[next] = 1;
        dist += minD;
        curr = next;
      }
      dist += this.distances[curr][0];
      return dist;
    }

    calculateTourDistance(tour) {
      let total = 0;
      for (let i = 0; i < tour.length - 1; i++) {
        total += this.distances[tour[i]][tour[i + 1]];
      }
      return total;
    }

    constructAntTour() {
      const n = this.n;
      const tour = new Int32Array(n + 1);
      const visited = new Uint8Array(n);

      tour[0] = 0;
      visited[0] = 1;
      let current = 0;
      const weights = new Float64Array(n);

      for (let step = 1; step < n; step++) {
        let sumWeights = 0;

        for (let candidate = 1; candidate < n; candidate++) {
          if (!visited[candidate]) {
            const tau = this.pheromones[current][candidate];
            const eta = this.heuristic[current][candidate];
            const weight = Math.pow(tau, this.alpha) * Math.pow(eta, this.beta);
            weights[candidate] = weight;
            sumWeights += weight;
          } else {
            weights[candidate] = 0;
          }
        }

        let chosen = -1;
        if (sumWeights > 0) {
          let rand = Math.random() * sumWeights;
          for (let candidate = 1; candidate < n; candidate++) {
            if (!visited[candidate]) {
              rand -= weights[candidate];
              if (rand <= 0) {
                chosen = candidate;
                break;
              }
            }
          }
        }

        if (chosen === -1) {
          for (let candidate = 1; candidate < n; candidate++) {
            if (!visited[candidate]) {
              chosen = candidate;
              break;
            }
          }
        }

        tour[step] = chosen;
        visited[chosen] = 1;
        current = chosen;
      }

      tour[n] = 0;
      return Array.from(tour);
    }

    updatePheromones(tours, tourDistances) {
      const n = this.n;
      const retention = 1.0 - this.rho;

      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (i !== j) {
            this.pheromones[i][j] = Math.max(this.tauMin, this.pheromones[i][j] * retention);
          }
        }
      }

      for (let k = 0; k < tours.length; k++) {
        const tour = tours[k];
        const dist = tourDistances[k];
        const deltaTau = this.q / dist;

        for (let i = 0; i < tour.length - 1; i++) {
          const u = tour[i];
          const v = tour[i + 1];
          this.pheromones[u][v] = Math.min(this.tauMax, this.pheromones[u][v] + deltaTau);
          this.pheromones[v][u] = Math.min(this.tauMax, this.pheromones[v][u] + deltaTau);
        }
      }

      if (this.globalBestTour && this.elitistWeight > 0) {
        const elitistDelta = (this.elitistWeight * this.q) / this.globalBestDistance;
        for (let i = 0; i < this.globalBestTour.length - 1; i++) {
          const u = this.globalBestTour[i];
          const v = this.globalBestTour[i + 1];
          this.pheromones[u][v] = Math.min(this.tauMax, this.pheromones[u][v] + elitistDelta);
          this.pheromones[v][u] = Math.min(this.tauMax, this.pheromones[v][u] + elitistDelta);
        }
      }
    }

    async run(onIteration, cancellationToken = { cancelled: false }) {
      const startTime = performance.now();
      const convergenceHistory = [];

      for (let iter = 1; iter <= this.iterations; iter++) {
        if (cancellationToken.cancelled) break;

        const tours = [];
        const distances = [];
        let iterBestDist = Infinity;

        for (let k = 0; k < this.numAnts; k++) {
          const tour = this.constructAntTour();
          const dist = this.calculateTourDistance(tour);
          tours.push(tour);
          distances.push(dist);

          if (dist < iterBestDist) iterBestDist = dist;
          if (dist < this.globalBestDistance) {
            this.globalBestDistance = dist;
            this.globalBestTour = tour.slice();
          }
        }

        this.updatePheromones(tours, distances);
        convergenceHistory.push({ iteration: iter, distance: this.globalBestDistance });

        if (onIteration) {
          onIteration({
            iteration: iter,
            totalIterations: this.iterations,
            bestTour: this.globalBestTour,
            bestDistance: this.globalBestDistance,
            iterBestDistance: iterBestDist,
            history: convergenceHistory
          });
        }

        await new Promise(r => setTimeout(r, 12));
      }

      const totalTimeMs = performance.now() - startTime;
      return {
        bestTour: this.globalBestTour,
        bestDistance: this.globalBestDistance,
        convergenceHistory,
        totalTimeMs
      };
    }
  }

  // ==========================================
  // 4. PARTICLE SWARM OPTIMIZATION (PSO)
  // ==========================================
  class ParticleSwarmOptimizer {
    constructor(distanceMatrix, options = {}) {
      this.distances = distanceMatrix;
      this.n = distanceMatrix.length;

      this.numParticles = options.numParticles || 30;
      this.iterations = options.iterations || 50;
      this.w = options.w !== undefined ? options.w : 0.7;
      this.c1 = options.c1 !== undefined ? options.c1 : 1.5;
      this.c2 = options.c2 !== undefined ? options.c2 : 1.8;

      this.particles = [];
      this.globalBestTour = null;
      this.globalBestDistance = Infinity;

      this.initSwarm();
    }

    initSwarm() {
      const stopsCount = this.n - 1;
      const baseStops = [];
      for (let i = 1; i < this.n; i++) baseStops.push(i);

      this.particles = [];
      this.globalBestDistance = Infinity;
      this.globalBestTour = null;

      for (let p = 0; p < this.numParticles; p++) {
        const permutation = baseStops.slice();
        for (let i = permutation.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
        }

        const initialVelocity = [];
        const numInitialSwaps = Math.floor(Math.random() * 3) + 1;
        for (let s = 0; s < numInitialSwaps; s++) {
          const a = Math.floor(Math.random() * stopsCount);
          const b = Math.floor(Math.random() * stopsCount);
          if (a !== b) initialVelocity.push([a, b]);
        }

        const fullTour = [0, ...permutation, 0];
        const dist = this.calculateTourDistance(fullTour);

        const particle = {
          position: permutation,
          velocity: initialVelocity,
          pBestPosition: permutation.slice(),
          pBestDistance: dist,
          currentDistance: dist
        };

        this.particles.push(particle);

        if (dist < this.globalBestDistance) {
          this.globalBestDistance = dist;
          this.globalBestTour = fullTour.slice();
        }
      }
    }

    calculateTourDistance(fullTour) {
      let total = 0;
      for (let i = 0; i < fullTour.length - 1; i++) {
        total += this.distances[fullTour[i]][fullTour[i + 1]];
      }
      return total;
    }

    getSwapSequence(fromArray, toArray) {
      const swaps = [];
      const temp = fromArray.slice();
      const n = temp.length;

      for (let i = 0; i < n; i++) {
        if (temp[i] !== toArray[i]) {
          let targetIdx = -1;
          for (let j = i + 1; j < n; j++) {
            if (temp[j] === toArray[i]) {
              targetIdx = j;
              break;
            }
          }
          if (targetIdx !== -1) {
            swaps.push([i, targetIdx]);
            [temp[i], temp[targetIdx]] = [temp[targetIdx], temp[i]];
          }
        }
      }
      return swaps;
    }

    scaleSwapSequence(swapSeq, factor) {
      const result = [];
      const threshold = Math.min(1.0, Math.max(0.0, factor * 0.45));
      for (const swap of swapSeq) {
        if (Math.random() < threshold) {
          result.push(swap);
        }
      }
      return result;
    }

    applySwapSequence(permutation, swapSeq) {
      const copy = permutation.slice();
      for (const [a, b] of swapSeq) {
        [copy[a], copy[b]] = [copy[b], copy[a]];
      }
      return copy;
    }

    applyTwoOpt(permutation) {
      if (permutation.length < 4) return permutation;
      const copy = permutation.slice();
      const i = Math.floor(Math.random() * (copy.length - 2));
      const j = i + 1 + Math.floor(Math.random() * (copy.length - i - 1));

      let left = i;
      let right = j;
      while (left < right) {
        [copy[left], copy[right]] = [copy[right], copy[left]];
        left++;
        right--;
      }
      return copy;
    }

    async run(onIteration, cancellationToken = { cancelled: false }) {
      const startTime = performance.now();
      const convergenceHistory = [];

      for (let iter = 1; iter <= this.iterations; iter++) {
        if (cancellationToken.cancelled) break;

        let iterBestDist = Infinity;

        for (let p = 0; p < this.numParticles; p++) {
          const particle = this.particles[p];

          const vInertia = this.scaleSwapSequence(particle.velocity, this.w);
          const diffPBest = this.getSwapSequence(particle.position, particle.pBestPosition);
          const vCognitive = this.scaleSwapSequence(diffPBest, this.c1 * Math.random());

          const gBestPermutation = this.globalBestTour.slice(1, -1);
          const diffGBest = this.getSwapSequence(particle.position, gBestPermutation);
          const vSocial = this.scaleSwapSequence(diffGBest, this.c2 * Math.random());

          const newVelocity = [...vInertia, ...vCognitive, ...vSocial];
          if (newVelocity.length > this.n) {
            newVelocity.splice(this.n);
          }

          let newPosition = this.applySwapSequence(particle.position, newVelocity);

          if (Math.random() < 0.12) {
            newPosition = this.applyTwoOpt(newPosition);
          }

          const newFullTour = [0, ...newPosition, 0];
          const newDist = this.calculateTourDistance(newFullTour);

          particle.position = newPosition;
          particle.velocity = newVelocity;
          particle.currentDistance = newDist;

          if (newDist < particle.pBestDistance) {
            particle.pBestDistance = newDist;
            particle.pBestPosition = newPosition.slice();
          }

          if (newDist < this.globalBestDistance) {
            this.globalBestDistance = newDist;
            this.globalBestTour = newFullTour.slice();
          }

          if (newDist < iterBestDist) {
            iterBestDist = newDist;
          }
        }

        convergenceHistory.push({ iteration: iter, distance: this.globalBestDistance });

        if (onIteration) {
          onIteration({
            iteration: iter,
            totalIterations: this.iterations,
            bestTour: this.globalBestTour,
            bestDistance: this.globalBestDistance,
            iterBestDistance: iterBestDist,
            history: convergenceHistory
          });
        }

        await new Promise(r => setTimeout(r, 12));
      }

      const totalTimeMs = performance.now() - startTime;
      return {
        bestTour: this.globalBestTour,
        bestDistance: this.globalBestDistance,
        convergenceHistory,
        totalTimeMs
      };
    }
  }

  // ==========================================
  // 5. ADMINISTRADOR DEL MAPA (LEAFLET.JS)
  // ==========================================
  class MapManager {
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
      this.map = L.map(this.containerId, {
        center: [20.6650, -103.3800],
        zoom: 12,
        zoomControl: false
      });

      L.control.zoom({ position: 'topright' }).addTo(this.map);

      const cartoPositron = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        {
          attribution: '&copy; OpenStreetMap &copy; CARTO',
          subdomains: 'abcd',
          maxZoom: 19
        }
      ).addTo(this.map);

      const osmStandard = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      });

      L.control.layers({
        'CartoDB Voyager': cartoPositron,
        'OpenStreetMap': osmStandard
      }, null, { position: 'topright' }).addTo(this.map);

      this.markersLayer = L.layerGroup().addTo(this.map);
      this.acoRouteLayer = L.layerGroup().addTo(this.map);
      this.psoRouteLayer = L.layerGroup().addTo(this.map);
      this.initialRouteLayer = L.layerGroup().addTo(this.map);

      this.map.on('click', (e) => {
        if (this.isAddMode && this.onAddLocationCallback) {
          this.onAddLocationCallback(e.latlng.lat, e.latlng.lng);
        }
      });
    }

    setAddMode(enabled) {
      this.isAddMode = enabled;
      const container = document.getElementById(this.containerId);
      if (container) {
        container.style.cursor = enabled ? 'crosshair' : '';
      }
    }

    createCustomIcon(location, index) {
      if (location.type === 'depot') {
        return L.divIcon({
          className: 'custom-depot-pin',
          html: `
            <div class="relative flex items-center justify-center w-10 h-10 bg-slate-900 border-2 border-amber-500 rounded-full shadow-xl shadow-amber-500/30">
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
          <div class="relative flex items-center justify-center w-7 h-7 ${badgeColor} text-white font-bold text-xs rounded-full border-2 shadow-md">
            <span>${index}</span>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14]
      });
    }

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

    drawRoute(algorithm, coordinates, options = {}) {
      let layerGroup;
      let color;
      let dashArray = null;
      let weight = 4.5;
      let opacity = 0.85;

      if (algorithm === 'aco') {
        layerGroup = this.acoRouteLayer;
        color = '#06b6d4';
      } else if (algorithm === 'pso') {
        layerGroup = this.psoRouteLayer;
        color = '#10b981';
      } else {
        layerGroup = this.initialRouteLayer;
        color = '#94a3b8';
        dashArray = '5, 8';
        weight = 2.5;
        opacity = 0.6;
      }

      layerGroup.clearLayers();
      if (!coordinates || coordinates.length < 2) return;

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

  // ==========================================
  // 6. ADMINISTRADOR DE GRÁFICA (CHART.JS)
  // ==========================================
  class ConvergenceChartManager {
    constructor(canvasId) {
      this.canvasId = canvasId;
      this.chart = null;
      this.initChart();
    }

    initChart() {
      const ctx = document.getElementById(this.canvasId);
      if (!ctx) return;

      this.chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: [],
          datasets: [
            {
              label: 'ACO (Colonia de Hormigas)',
              data: [],
              borderColor: '#06b6d4',
              backgroundColor: 'rgba(6, 182, 212, 0.1)',
              borderWidth: 2.5,
              pointRadius: 1.5,
              pointHoverRadius: 5,
              tension: 0.25,
              fill: false
            },
            {
              label: 'PSO (Enjambre de Partículas)',
              data: [],
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              borderWidth: 2.5,
              pointRadius: 1.5,
              pointHoverRadius: 5,
              tension: 0.25,
              fill: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 100 },
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              position: 'top',
              labels: {
                boxWidth: 12,
                color: '#94a3b8',
                font: { family: 'Inter, system-ui', size: 11, weight: '600' }
              }
            },
            tooltip: {
              backgroundColor: '#0f172a',
              titleColor: '#f8fafc',
              bodyColor: '#cbd5e1',
              borderColor: '#334155',
              borderWidth: 1,
              callbacks: {
                label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)} km`
              }
            }
          },
          scales: {
            x: {
              title: { display: true, text: 'Iteración', color: '#64748b', font: { size: 11, weight: '600' } },
              grid: { color: 'rgba(51, 65, 85, 0.25)' },
              ticks: { color: '#94a3b8', maxTicksLimit: 12 }
            },
            y: {
              title: { display: true, text: 'Distancia de Ruta (km)', color: '#64748b', font: { size: 11, weight: '600' } },
              grid: { color: 'rgba(51, 65, 85, 0.25)' },
              ticks: { color: '#94a3b8', callback: (val) => `${val.toFixed(0)} km` }
            }
          }
        }
      });
    }

    addDataPoint(algorithm, iteration, distance) {
      if (!this.chart) return;
      const datasetIndex = algorithm === 'aco' ? 0 : 1;
      const labelStr = `${iteration}`;

      if (!this.chart.data.labels.includes(labelStr)) {
        this.chart.data.labels.push(labelStr);
      }

      this.chart.data.datasets[datasetIndex].data.push(distance);
      this.chart.update('none');
    }

    reset() {
      if (!this.chart) return;
      this.chart.data.labels = [];
      this.chart.data.datasets[0].data = [];
      this.chart.data.datasets[1].data = [];
      this.chart.update();
    }
  }

  // ==========================================
  // 7. CONTROLADOR PRINCIPAL DE LA APLICACIÓN
  // ==========================================
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

        this.updateMetricsDisplay({ initialDist: this.initialTourDistance });
      } catch (err) {
        console.error("Error al actualizar matriz de distancias:", err);
        this.updateStatusBadge('Error al conectar con OSRM', 'error');
      }
    }

    setupEventListeners() {
      const acoInputs = ['acoAnts', 'acoIterations', 'acoAlpha', 'acoBeta', 'acoRho', 'acoQ'];
      acoInputs.forEach(id => {
        const el = document.getElementById(id);
        const valEl = document.getElementById(`${id}Val`);
        if (el && valEl) {
          el.addEventListener('input', () => { valEl.textContent = el.value; });
        }
      });

      const psoInputs = ['psoParticles', 'psoIterations', 'psoW', 'psoC1', 'psoC2'];
      psoInputs.forEach(id => {
        const el = document.getElementById(id);
        const valEl = document.getElementById(`${id}Val`);
        if (el && valEl) {
          el.addEventListener('input', () => { valEl.textContent = el.value; });
        }
      });

      document.getElementById('btnRunAco')?.addEventListener('click', () => this.runSingleAlgorithm('aco'));
      document.getElementById('btnRunPso')?.addEventListener('click', () => this.runSingleAlgorithm('pso'));
      document.getElementById('btnRunComparison')?.addEventListener('click', () => this.runComparison());
      document.getElementById('btnStop')?.addEventListener('click', () => this.stopExecution());
      document.getElementById('btnReset')?.addEventListener('click', () => this.resetSimulation());

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
            btnAddStop.textContent = '❌ Cancelar Modo Añadir (Haz clic en mapa)';
            this.mapManager.setAddMode(true);
          }
        });
      }

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
      this.updateStatusBadge('Optimización detenida por el usuario', 'offline');
    }

    resetSimulation() {
      this.stopExecution();
      this.chartManager.reset();
      this.mapManager.clearRoutes();
      this.acoBest = null;
      this.psoBest = null;

      const seqTour = [];
      for (let i = 0; i < this.activeLocations.length; i++) seqTour.push(i);
      seqTour.push(0);
      const initialCoords = seqTour.map(idx => [this.activeLocations[idx].lat, this.activeLocations[idx].lng]);
      this.mapManager.drawRoute('initial', initialCoords);

      this.updateMetricsDisplay({
        bestDist: 0,
        timeMs: 0,
        improvementPct: 0,
        currentIter: 0,
        totalIter: 0,
        algoName: 'Restablecido'
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
        this.chartManager.addDataPoint('aco', data.iteration, data.bestDistance);

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

      if (!this.cancellationToken.cancelled) {
        this.updateStatusBadge('Trazando geometría vial exacta con OSRM...', 'loading');
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
        this.chartManager.addDataPoint('pso', data.iteration, data.bestDistance);

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
        this.updateStatusBadge('Trazando geometría vial exacta con OSRM...', 'loading');
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
        this.updateStatusBadge(`Comparativa finalizada: ${winner} fue más eficiente por ${diffKm} km`, 'online');
      }

      this.isRunning = false;
      this.setButtonsDisabled(false);
    }

    updateMetricsDisplay(data) {
      if (data.bestDist !== undefined && data.bestDist > 0) {
        const distEl = document.getElementById('metricDistance');
        if (distEl) distEl.textContent = `${data.bestDist.toFixed(2)} km`;

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

  // Inicialización automática al cargar el DOM
  window.addEventListener('DOMContentLoaded', () => {
    window.app = new LogisticsApp();
  });

})();
