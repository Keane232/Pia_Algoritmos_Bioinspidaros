/**
 * Algoritmo de Optimización por Enjambre de Partículas (Particle Swarm Optimization - PSO)
 * Adaptación Discreta basada en Álgebra de Operadores de Intercambio (Swap Operators / Swap Sequences).
 *
 * Características:
 * - Posición de partícula: Permutación de paradas intermedias [s_1, s_2, ..., s_{n-1}].
 * - Velocidad: Secuencia ordenada de intercambios (Swap Sequence).
 * - Resta de posiciones (A - B): Calcula la secuencia mínima de intercambios para transformar B en A.
 * - Multiplicación escalar (c * SS): Filtro probabilístico sobre la lista de intercambios.
 * - Suma de velocidades: Concatenación de secuencias de intercambios.
 * - Depósito fijo en posición 0 (estación de entrega Amazon) al inicio y final del tour.
 */

export class ParticleSwarmOptimizer {
  constructor(distanceMatrix, options = {}) {
    this.distances = distanceMatrix;
    this.n = distanceMatrix.length; // 0 = Depósito, 1..n-1 = Paradas

    this.numParticles = options.numParticles || 30;
    this.iterations = options.iterations || 50;
    this.w = options.w !== undefined ? options.w : 0.7; // Factor de Inercia
    this.c1 = options.c1 !== undefined ? options.c1 : 1.5; // Coeficiente Cognitivo (PBest)
    this.c2 = options.c2 !== undefined ? options.c2 : 1.8; // Coeficiente Social (GBest)

    this.particles = [];
    this.globalBestTour = null;
    this.globalBestDistance = Infinity;

    this.initSwarm();
  }

  /**
   * Inicializa las partículas con permutaciones aleatorias de las paradas {1..n-1}.
   */
  initSwarm() {
    const stopsCount = this.n - 1;
    const baseStops = [];
    for (let i = 1; i < this.n; i++) baseStops.push(i);

    this.particles = [];
    this.globalBestDistance = Infinity;
    this.globalBestTour = null;

    for (let p = 0; p < this.numParticles; p++) {
      // Barajar paradas (Fisher-Yates)
      const permutation = baseStops.slice();
      for (let i = permutation.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
      }

      // Velocidad inicial: conjunto pequeño de intercambios aleatorios
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
        position: permutation, // Solo paradas intermedias
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

  /**
   * Operador Resta: A - B.
   * Retorna la secuencia mínima de swaps requerida para transformar el arreglo B en el arreglo A.
   */
  getSwapSequence(fromArray, toArray) {
    const swaps = [];
    const temp = fromArray.slice();
    const n = temp.length;

    for (let i = 0; i < n; i++) {
      if (temp[i] !== toArray[i]) {
        // Encontrar dónde está toArray[i] en temp
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

  /**
   * Multiplicación escalar: c * SwapSequence.
   * Filtra probabilísticamente los swaps. Si c >= 1, se conservan con mayor frecuencia.
   */
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

  /**
   * Aplica una secuencia de intercambios a una permutación.
   */
  applySwapSequence(permutation, swapSeq) {
    const copy = permutation.slice();
    for (const [a, b] of swapSeq) {
      [copy[a], copy[b]] = [copy[b], copy[a]];
    }
    return copy;
  }

  /**
   * Refinamiento local 2-opt ligero para diversificar y escapar de mínimos locales.
   */
  applyTwoOpt(permutation) {
    if (permutation.length < 4) return permutation;
    const copy = permutation.slice();
    const i = Math.floor(Math.random() * (copy.length - 2));
    const j = i + 1 + Math.floor(Math.random() * (copy.length - i - 1));

    // Invertir segmento entre i y j
    let left = i;
    let right = j;
    while (left < right) {
      [copy[left], copy[right]] = [copy[right], copy[left]];
      left++;
      right--;
    }
    return copy;
  }

  /**
   * Ejecución asíncrona del enjambre.
   */
  async run(onIteration, cancellationToken = { cancelled: false }) {
    const startTime = performance.now();
    const convergenceHistory = [];

    for (let iter = 1; iter <= this.iterations; iter++) {
      if (cancellationToken.cancelled) break;

      let iterBestDist = Infinity;

      for (let p = 0; p < this.numParticles; p++) {
        const particle = this.particles[p];

        // 1. Componente Inercial: w * V(t)
        const vInertia = this.scaleSwapSequence(particle.velocity, this.w);

        // 2. Componente Cognitivo: c1 * r1 * (PBest - X)
        const diffPBest = this.getSwapSequence(particle.position, particle.pBestPosition);
        const r1 = Math.random();
        const vCognitive = this.scaleSwapSequence(diffPBest, this.c1 * r1);

        // 3. Componente Social: c2 * r2 * (GBest - X)
        // Extraer permutación de paradas intermedias del mejor global
        const gBestPermutation = this.globalBestTour.slice(1, -1);
        const diffGBest = this.getSwapSequence(particle.position, gBestPermutation);
        const r2 = Math.random();
        const vSocial = this.scaleSwapSequence(diffGBest, this.c2 * r2);

        // Concatenar secuencias de intercambios (velocidad resultante)
        const newVelocity = [...vInertia, ...vCognitive, ...vSocial];
        // Limitar longitud de swaps para evitar dispersión caótica excesiva
        if (newVelocity.length > this.n) {
          newVelocity.splice(this.n);
        }

        // 4. Actualizar posición aplicando la velocidad
        let newPosition = this.applySwapSequence(particle.position, newVelocity);

        // Perturbación ocasional (10% prob) para simular búsqueda exploratoria
        if (Math.random() < 0.12) {
          newPosition = this.applyTwoOpt(newPosition);
        }

        const newFullTour = [0, ...newPosition, 0];
        const newDist = this.calculateTourDistance(newFullTour);

        particle.position = newPosition;
        particle.velocity = newVelocity;
        particle.currentDistance = newDist;

        // Actualizar PBest
        if (newDist < particle.pBestDistance) {
          particle.pBestDistance = newDist;
          particle.pBestPosition = newPosition.slice();
        }

        // Actualizar GBest
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
