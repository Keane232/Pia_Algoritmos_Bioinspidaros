# AMZL Last-Mile Route Optimizer (Guadalajara, México)
### Optimización de Rutas de Última Milla con Ant Colony Optimization (ACO) y Particle Swarm Optimization (PSO)

Una aplicación web interactiva, moderna y **100% gratuita** diseñada para simular, comparar y optimizar rutas de entrega de última milla inspiradas en la logística de **Amazon Logistics (AMZL)** en la Zona Metropolitana de Guadalajara (ZMG), México.

---

## 🌟 Características Principales

1. **Arquitectura 100% Client-Side y Gratuita:**
   - Sin servidores de backend ni bases de datos de pago.
   - Sin claves de API que requieran tarjeta de crédito.
   - Totalmente compatible con **GitHub Pages**, **Vercel** o **Netlify**.
2. **Escenario Real en Guadalajara, Jalisco:**
   - **Depósito Central:** Estación de Entrega Amazon DGD1 (Zona Industrial GDL, `20.6350, -103.3578`).
   - **14 Puntos Estratégicos:** Expo Guadalajara, Glorieta Minerva, Centro Histórico, Plaza Patria, Andares, Estadio Akron, Tlaquepaque, Parque Metropolitano, ITESO, CUCEI, Plaza del Sol, Zapopan Centro, Chapultepec y Tonalá.
   - Activación/desactivación dinámica de paradas y modo para **añadir nuevas paradas haciendo clic directamente en el mapa**.
3. **Ruteo Real sobre Calles con OSRM:**
   - Integra la API pública gratuita de **OSRM** (`https://router.project-osrm.org`) para calcular matrices reales de distancia métrica y trazar la geometría exacta sobre las avenidas principales.
   - **Fallback Automático a Distancia Geodésica (Haversine):** Si la API pública de OSRM tarda o sufre limitación de peticiones, el sistema conmuta instantáneamente al cálculo Haversine para garantizar ejecución continua sin bloqueos.
4. **Metaheurísticas Avanzadas con Control en Vivo:**
   - **Ant Colony Optimization (ACO):** Número de hormigas ($m$), iteraciones, peso de feromona ($\alpha$), peso heurístico ($\beta$), tasa de evaporación ($\rho$) y constante de depósito ($Q$).
   - **Particle Swarm Optimization (PSO):** Adaptación discreta de permutaciones mediante secuencias de operadores de intercambio (*Swap Operators & Swap Sequences* de Clerc) con control de inercia ($w$), componente cognitivo ($c_1$) y componente social ($c_2$).
5. **Analítica y Comparativa Visual:**
   - Animación fluida de la mejor ruta sobre el mapa en cada iteración.
   - Gráfica de convergencia en tiempo real con **Chart.js** (distancia en km vs. iteración).
   - Métricas clave: distancia total (km), tiempo estimado de ruta y entrega, y porcentaje de mejora respecto al recorrido inicial.
   - Pestaña modal con las notas de investigación y formulaciones matemáticas completas.

---

## 🚀 Guía de Despliegue 100% Gratis en GitHub Pages

Para publicar esta aplicación y compartirla con cualquier usuario en internet sin pagar un solo centavo:

### Paso 1: Inicializar el repositorio Git local
Abre tu terminal en la carpeta del proyecto y ejecuta:

```bash
git init
git add .
git commit -m "feat: Amazon Last-Mile Route Optimizer con ACO y PSO"
```

### Paso 2: Crear el repositorio en GitHub
1. Ingresa a [GitHub](https://github.com) e inicia sesión con tu cuenta gratuita.
2. Crea un nuevo repositorio (por ejemplo, `amzl-route-optimizer`).
3. Elige que sea **Público** (*Public*) y no inicialices con README (ya lo tienes creado).

### Paso 3: Conectar el repositorio local con GitHub y subir los archivos
Copia las instrucciones de GitHub o ejecuta:

```bash
git branch -M main
git remote add origin https://github.com/TU_USUARIO/amzl-route-optimizer.git
git push -u origin main
```

### Paso 4: Activar GitHub Pages
1. En la página de tu repositorio en GitHub, dirígete a la pestaña **Settings** (Configuración).
2. En el menú lateral izquierdo, selecciona **Pages** (dentro de la sección *Code and automation*).
3. En **Build and deployment**:
   - **Source:** Selecciona `Deploy from a branch`.
   - **Branch:** Selecciona `main` y la carpeta `/ (root)`.
   - Haz clic en **Save** (Guardar).
4. Espera entre 30 y 60 segundos. GitHub te proporcionará una URL pública gratuita con certificado SSL automático:
   ```
   https://TU_USUARIO.github.io/amzl-route-optimizer/
   ```

---

## 🌐 Alternativas de Despliegue Inmediato (1 Clic)

* **Vercel:** Simplemente importa tu repositorio de GitHub en [vercel.com](https://vercel.com). Detectará automáticamente los archivos estáticos (`index.html`) y desplegará en segundos.
* **Netlify:** Arrastra y suelta la carpeta del proyecto directamente en el panel de [app.netlify.com/drop](https://app.netlify.com/drop).

---

## 🛠️ Estructura del Código

```
├── index.html                   # Interfaz de usuario principal (Tailwind + Leaflet + Chart.js)
├── css/
│   └── styles.css               # Estilos personalizados, animaciones y temas
├── js/
│   ├── app.js                   # Orquestador principal y gestor de eventos
│   ├── data/
│   │   └── locations.js         # Depósito Amazon DGD1 y 14 ubicaciones de Guadalajara
│   ├── services/
│   │   └── routingService.js    # Cliente OSRM con fallback automático a Haversine
│   ├── algorithms/
│   │   ├── aco.js               # Algoritmo Ant Colony System
│   │   └── pso.js               # Algoritmo Discrete Swap Sequence PSO
│   └── ui/
│       ├── mapManager.js        # Integración con Leaflet y trazado de geometrías
│       └── chartManager.js      # Gráfica de convergencia interactiva
├── RESEARCH_NOTES.md            # Documento técnico detallado y formulaciones matemáticas
└── README.md                    # Documentación y guía de despliegue
```

---

## 🔬 Referencias Algorítmicas y Matemáticas
* **ACO:** Dorigo, M., & Gambardella, L. M. (1997). *Ant colony system: a cooperative learning approach to the traveling salesman problem*. IEEE Transactions on Evolutionary Computation.
* **Discrete PSO:** Clerc, M. (2004). *Discrete Particle Swarm Optimization, illustrated by the Travelling Salesman Problem*. New Optimization Techniques in Engineering.
* **OSRM Project:** Luxen, D., & Vetter, C. (2011). *Real-time routing with OpenStreetMap data*. ACM SIGSPATIAL.
