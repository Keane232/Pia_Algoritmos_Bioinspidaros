/**
 * Servicio de ruteo y cálculo de distancias.
 * - Integra la API pública gratuita de OSRM (Open Source Routing Machine).
 * - Provee fallback automático a distancias geodésicas (Haversine) si la API falla o limita peticiones.
 * - Cacha matrices y geometrías para optimizar desempeño y respetar límites públicos.
 */

export class RoutingService {
  constructor() {
    this.osrmBaseUrl = 'https://router.project-osrm.org';
    this.matrixCache = new Map();
    this.routeCache = new Map();
    this.lastMode = 'osrm'; // 'osrm' | 'haversine'
  }

  /**
   * Calcula la distancia geodésica entre dos puntos usando la fórmula del Semiverseno (Haversine).
   * @returns Distancia en kilómetros.
   */
  static haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radio medio de la Tierra en km
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

  /**
   * Genera matriz de distancias y tiempos de respaldo mediante Haversine.
   * Asume una velocidad urbana promedio de 25 km/h en Guadalajara (con factor vial de 1.35 por trazado de calles).
   */
  calculateHaversineMatrix(locations) {
    const n = locations.length;
    const distances = Array.from({ length: n }, () => new Float64Array(n));
    const durations = Array.from({ length: n }, () => new Float64Array(n));
    const urbanTortuosityFactor = 1.32; // Factor de tortuosidad vial promedio en Guadalajara
    const avgSpeedKmH = 26.0;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          distances[i][j] = 0;
          durations[i][j] = 0;
        } else {
          const directKm = RoutingService.haversineDistance(
            locations[i].lat,
            locations[i].lng,
            locations[j].lat,
            locations[j].lng
          );
          const streetKm = directKm * urbanTortuosityFactor;
          distances[i][j] = streetKm;
          durations[i][j] = (streetKm / avgSpeedKmH) * 3600; // segundos
        }
      }
    }

    return { distances, durations, mode: 'haversine' };
  }

  /**
   * Obtiene la matriz completa NxN de distancias (en km) y duraciones (en segundos).
   * Primero intenta OSRM Table API; si falla o tarda más de 3.5s, conmuta a Haversine.
   */
  async getDistanceMatrix(locations) {
    if (!locations || locations.length < 2) {
      throw new Error("Se requieren al menos 2 ubicaciones para calcular la matriz.");
    }

    const cacheKey = locations.map(l => `${l.id}:${l.lat.toFixed(4)},${l.lng.toFixed(4)}`).join('|');
    if (this.matrixCache.has(cacheKey)) {
      return this.matrixCache.get(cacheKey);
    }

    // OSRM espera coordenadas en formato: lon,lat;lon,lat;...
    const coordsParam = locations.map(l => `${l.lng},${l.lat}`).join(';');
    const url = `${this.osrmBaseUrl}/table/v1/driving/${coordsParam}?annotations=distance,duration`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3800); // 3.8s timeout

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`OSRM HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.code !== 'Ok' || !data.distances) {
        throw new Error(`Respuesta OSRM no válida: ${data.code}`);
      }

      // Convertir distancias de metros a kilómetros
      const n = locations.length;
      const distances = Array.from({ length: n }, () => new Float64Array(n));
      const durations = Array.from({ length: n }, () => new Float64Array(n));

      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          // Si OSRM devuelve null por calle inaccesible, usar fallback para ese par
          if (data.distances[i][j] === null || data.distances[i][j] === undefined) {
            const fbDist = RoutingService.haversineDistance(
              locations[i].lat, locations[i].lng,
              locations[j].lat, locations[j].lng
            ) * 1.35;
            distances[i][j] = fbDist;
            durations[i][j] = (fbDist / 25) * 3600;
          } else {
            distances[i][j] = data.distances[i][j] / 1000.0; // km
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

  /**
   * Obtiene la geometría real de calles (GeoJSON) para un recorrido ordenado.
   * @param {Array} tourLocations - Lista ordenada de objetos de ubicación [depot, s1, s2, ..., depot]
   */
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
        // GeoJSON viene en [lng, lat]; Leaflet requiere [lat, lng]
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

    // Fallback: Líneas rectas entre nodos sucesivos
    const directCoords = tourLocations.map(l => [l.lat, l.lng]);
    let directDistKm = 0;
    for (let i = 0; i < tourLocations.length - 1; i++) {
      directDistKm += RoutingService.haversineDistance(
        tourLocations[i].lat, tourLocations[i].lng,
        tourLocations[i + 1].lat, tourLocations[i + 1].lng
      );
    }

    const fallbackResult = {
      coordinates: directCoords,
      distanceKm: directDistKm * 1.32,
      durationSec: ((directDistKm * 1.32) / 25) * 3600,
      isRealStreet: false
    };
    return fallbackResult;
  }
}
