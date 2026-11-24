/**
 * Algoritmo de Optimización por Colonia de Hormigas (Ant Colony Optimization - ACO)
 * Adaptado para el Problema del Viajante de Comercio (TSP) con Depósito Fijo (Última Milla).
 *
 * Características:
 * - Regla de transición probabilística proporcional a [tau]^alpha * [eta]^beta.
 * - Evaporación de feromona con factor rho.
 * - Depósito de feromona global y elitista (Q / L_k).
 * - Ejecución asíncrona no bloqueante con callbacks por iteración para animación en vivo.
 */

export class AntColonyOptimizer {
  constructor(distanceMatrix, options = {}) {
    this.distances = distanceMatrix;
    this.n = distanceMatrix.length; // 0 = Depósito, 1..n-1 = Paradas

    this.numAnts = options.numAnts || 30;
    this.iterations = options.iterations || 50;
    this.alpha = options.alpha !== undefined ? options.alpha : 1.2;
    this.beta = options.beta !== undefined ? options.beta : 3.5;
    this.rho = options.rho !== undefined ? options.rho : 0.15;
    this.q = options.q !== undefined ? options.q : 100.0;
    this.elitistWeight = options.elitistWeight !== undefined ? options.elitistWeight : 2.0;

    // Límites de feromona para evitar desbordamiento y estancamiento
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

    // Estimar longitud de recorrido voraz para fijar tau0
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
    dist += this.distances[curr][0]; // Retorno al depósito
    return dist;
  }

  calculateTourDistance(tour) {
    let total = 0;
    for (let i = 0; i < tour.length - 1; i++) {
      total += this.distances[tour[i]][tour[i + 1]];
    }
    return total;
  }

  /**
   * Construye un recorrido completo para una hormiga individual.
   * La hormiga parte del depósito (0), visita todas las paradas {1..n-1} y regresa a 0.
   */
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
        // Ruleta proporcional
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

      // Si por imprecisión numérica no se eligió, tomar el primer no visitado
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

    tour[n] = 0; // Regreso obligatorio a la estación de entrega
    return Array.from(tour);
  }

  /**
   * Evapora y actualiza las feromonas tras un ciclo.
   */
  updatePheromones(tours, tourDistances) {
    const n = this.n;

    // 1. Evaporación
    const retention = 1.0 - this.rho;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          this.pheromones[i][j] = Math.max(this.tauMin, this.pheromones[i][j] * retention);
        }
      }
    }

    // 2. Depósito de feromona por cada hormiga
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

    // 3. Depósito adicional Elitista en la mejor ruta global
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

  /**
   * Ejecución asíncrona de la colonia.
   * Invoca onIteration({ iteration, bestTour, bestDistance, iterationBestDistance }) en cada ciclo.
   */
  async run(onIteration, cancellationToken = { cancelled: false }) {
    const startTime = performance.now();
    const convergenceHistory = [];

    for (let iter = 1; iter <= this.iterations; iter++) {
      if (cancellationToken.cancelled) break;

      const tours = [];
      const distances = [];
      let iterBestTour = null;
      let iterBestDist = Infinity;

      for (let k = 0; k < this.numAnts; k++) {
        const tour = this.constructAntTour();
        const dist = this.calculateTourDistance(tour);
        tours.push(tour);
        distances.push(dist);

        if (dist < iterBestDist) {
          iterBestDist = dist;
          iterBestTour = tour;
        }

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

      // Ceder el hilo para mantener la UI 60fps responsiva
      await new Promise(r => setTimeout(r, 16));
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
