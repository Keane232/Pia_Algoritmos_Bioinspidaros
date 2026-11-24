# Fundamentos de Optimización de Rutas de Última Milla (TSP/VRP)
## Inspirado en Redes Logísticas Estilo Amazon: Modelado con ACO y PSO

---

## 1. Contexto y Principios de Última Milla en Redes Tipo Amazon

La logística de última milla representa entre el **40% y el 53% del costo total de transporte** en cadenas de suministro de comercio electrónico. En la red de última milla de Amazon (operada mediante *Amazon Logistics* o AMZL), la entrega sigue un flujo jerárquico:

1. **Centros de Distribución / Cumplimiento (Fulfillment Centers - FC):** Almacenamiento masivo y empaquetado.
2. **Centros de Clasificación (Sort Centers - SC):** Agrupación por códigos postales.
3. **Estaciones de Entrega (Delivery Stations - DS):** Nodos locales (como la estación *DGD1* en la Zona Industrial de Guadalajara) donde los paquetes se cargan en vehículos de última milla (*Amazon Delivery Vans* o repartidores *Flex*).

### Desafíos Clave de Optimización
* **Consolidación de Paradas y Densidad:** Minimizar el tiempo muerto entre paradas adyacentes maximizando el número de entregas por hora (*Stops Per On-Road Hour - SPH*).
* **Restricción de Ventanas de Tiempo y Tráfico:** La distancia en línea recta (euclidiana o geodésica) difiere dramáticamente de la red vial urbana real, sujeta a sentidos de circulación, semaforización y congestión.
* **Problema del Viajante de Comercio (TSP) y Ruteo de Vehículos (VRP):** Para una ruta individual asignada a una furgoneta desde una estación de entrega con $N$ paquetes, el problema base se modela como un TSP cerrado:
  $$\min \sum_{i=1}^{N} \sum_{j=1}^{N} d_{ij} x_{ij}$$
  Sujeto a que cada nodo sea visitado exactamente una vez y el vehículo retorne al depósito. Siendo un problema NP-hard ($O(N!)$ rutas posibles), las técnicas exactas (como Branch and Bound o programación entera mixta) se vuelven intratables para $N \ge 25$ en tiempo interactivo en el navegador, justificando el uso de metaheurísticas poblacionales.
* **Exploración vs. Explotación:** 
  - *Explotación (Intensificación):* Refinar los subcaminos cortos ya descubiertos.
  - *Exploración (Diversificación):* Probar órdenes de entrega alternativos para escapar de mínimos locales causados por barreras geográficas (ej. vías de tren, barrancas o calzadas congestionadas).

---

## 2. Arquitectura de la Solución 100% Estática (Client-Side)

Para garantizar **cero costos de infraestructura, cero tokens de pago y cero API keys con tarjeta**, la aplicación se diseña como una **Single Page Application (SPA)** serverless desplegable en GitHub Pages, Netlify o Vercel:

```
┌─────────────────────────────────────────────────────────────┐
│                       Navegador Web                         │
├──────────────────────────────┬──────────────────────────────┤
│     Interfaz de Usuario      │      Capa de Algoritmos      │
│  - Tailwind CSS / DaisyUI    │  - Motor ACO (Ant Colony)    │
│  - Leaflet.js (Mapas)        │  - Motor PSO (Particle Swarm)│
│  - Chart.js (Convergencia)   │  - Generadores asíncronos    │
├──────────────────────────────┴──────────────────────────────┤
│                   Capa de Datos y Ruteo                     │
│  - Nodos Guadalajara (Depósito Amazon + 14 Paradas)         │
│  - OSRM Public API (router.project-osrm.org)                │
│    * /table/v1/driving (Matriz real NxN metros y segundos)  │
│    * /route/v1/driving (Polilínea GeoJSON sobre calles)     │
│  - Fallback Automático: Matriz Geodésica Haversine          │
└─────────────────────────────────────────────────────────────┘
```

### Estrategia de Ruteo Real sin API Keys:
1. **OSRM Table API:** Permite solicitar la matriz de distancias real $\mathbf{D}_{N \times N}$ en una sola llamada HTTP `GET`.
2. **OSRM Route API:** Permite obtener el trazado exacto de las calles (*geometry overview full*) para pintar la ruta final sobre las avenidas principales de Guadalajara (ej. Av. Mariano Otero, Lázaro Cárdenas, López Mateos, Vallarta).
3. **Mecanismo de Resiliencia (Fallback Haversine):** Si la API pública de OSRM sufre limitación de peticiones (*rate-limiting* o timeout $> 4$ segundos), el sistema calcula inmediatamente la distancia geodésica mediante la fórmula del semiverseno (*Haversine*), garantizando que la optimización nunca se interrumpa.

$$\text{hav}(\theta) = \sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)$$
$$d = 2 R \cdot \arcsin\left(\sqrt{\text{hav}(\theta)}\right)$$

---

## 3. Formulación Matemática de Ant Colony Optimization (ACO)

Inspirado en el comportamiento forrajero de las hormigas reales (Dorigo et al., 1996), los agentes depositan feromona $\tau$ sobre los tramos (*edges*) y utilizan información heurística local $\eta$ (visibilidad inversa a la distancia real de la calle).

### 3.1. Regla de Transición Probabilística (Ant System / ACS)
La probabilidad $P_{ij}^k$ de que la hormiga $k$ situada en la parada $i$ elija moverse a la parada no visitada $j \in \mathcal{N}_i^k$ es:

$$P_{ij}^k = \frac{[\tau_{ij}]^\alpha \cdot [\eta_{ij}]^\beta}{\sum_{l \in \mathcal{N}_i^k} [\tau_{il}]^\alpha \cdot [\eta_{il}]^\beta}$$

Donde:
* $\tau_{ij}$: Concentración de feromona en la conexión entre la parada $i$ y la parada $j$.
* $\eta_{ij} = \frac{1}{d_{ij}}$: Información heurística (deseabilidad local inversamente proporcional a la distancia métrica real obtenida por OSRM).
* $\alpha \ge 0$: Parámetro de control del rastro de feromona (**explotación** del conocimiento histórico acumulado por la colonia). Si $\alpha = 0$, la búsqueda se vuelve puramente voraz (*greedy*).
* $\beta \ge 1$: Parámetro de control de la visibilidad heurística (**exploración** inmediata guiada por proximidad física).
* $\mathcal{N}_i^k$: Conjunto de paradas viables aún no visitadas por la hormiga $k$.

### 3.2. Evaporación de Feromonas
Para prevenir la convergencia prematura hacia un mínimo local y permitir el olvido de malas decisiones pasadas, la feromona se evapora tras cada ciclo:

$$\tau_{ij} \leftarrow (1 - \rho) \cdot \tau_{ij}, \quad \forall (i, j)$$

Donde $\rho \in (0, 1]$ es el coeficiente de evaporación (ej. $\rho = 0.1$ a $0.3$).

### 3.3. Depósito de Feromonas (Actualización de Rastros)
Cada una de las $m$ hormigas completa un recorrido completo de longitud total $L_k$. La feromona depositada por la hormiga $k$ es:

$$\Delta \tau_{ij}^k = \begin{cases} \frac{Q}{L_k} & \text{si el tramo } (i, j) \in \text{recorrido de la hormiga } k \\ 0 & \text{en caso contrario} \end{cases}$$

$$\tau_{ij} \leftarrow \tau_{ij} + \sum_{k=1}^m \Delta \tau_{ij}^k$$

Donde $Q > 0$ es la constante de depósito de feromona. Para mejorar la convergencia, se incluye una variante *Elitista*: la mejor hormiga global deposita una cantidad adicional $e \cdot \frac{Q}{L_{\text{best}}}$.

---

## 4. Adaptación Discreta de Particle Swarm Optimization (PSO) para TSP

El algoritmo clásico de Enjambre de Partículas (Kennedy & Eberhart, 1995) fue concebido para espacios continuos $\mathbb{R}^D$:
$$\mathbf{v}_i(t+1) = w \mathbf{v}_i(t) + c_1 r_1 (\mathbf{pbest}_i - \mathbf{x}_i(t)) + c_2 r_2 (\mathbf{gbest} - \mathbf{x}_i(t))$$
$$\mathbf{x}_i(t+1) = \mathbf{x}_i(t) + \mathbf{v}_i(t+1)$$

Dado que una ruta logística es una **permutación discreta de paradas** $\pi = \langle 0, s_1, s_2, \dots, s_N, 0 \rangle$, el álgebra continua clásica produciría índices duplicados o inválidos. Para resolver esto con máxima elegancia y fidelidad algorítmica, se modelan dos enfoques:

### Enfoque A: Álgebra Discreta de Operadores de Intercambio (*Swap Operators & Swap Sequences*) — Clerc (2004)
1. **Posición de una Partícula ($\mathbf{x}_i$):** Es una permutación ordenada de los índices de parada.
2. **Operador de Intercambio ($SO(a, b)$):** Acción que intercambia los elementos en las posiciones $a$ y $b$ de la permutación:
   $$SO(a, b) \circ \mathbf{x} = \mathbf{x}'$$
3. **Secuencia de Intercambio ($SS$):** Lista ordenada de operadores de intercambio $SS = \langle SO_1, SO_2, \dots, SO_k \rangle$. La "velocidad" $\mathbf{v}_i$ de la partícula es precisamente una secuencia de intercambios.
4. **Resta de Posiciones ($\mathbf{x}_A - \mathbf{x}_B$):** Genera la secuencia mínima de intercambios requerida para transformar la ruta $\mathbf{x}_B$ en la ruta $\mathbf{x}_A$.
5. **Multiplicación Escalar ($c \otimes SS$):** Se interpreta de forma probabilística: cada intercambio $SO_k \in SS$ se conserva con probabilidad $c \in [0, 1]$.
6. **Suma de Velocidades ($\oplus$):** Concatenación de secuencias de intercambio:
   $$\mathbf{v}_i(t+1) = (w \otimes \mathbf{v}_i(t)) \oplus (c_1 r_1 \otimes (\mathbf{pbest}_i - \mathbf{x}_i(t))) \oplus (c_2 r_2 \otimes (\mathbf{gbest} - \mathbf{x}_i(t)))$$
   $$\mathbf{x}_i(t+1) = \mathbf{v}_i(t+1) \circ \mathbf{x}_i(t)$$

### Enfoque B: Claves Aleatorias (*Random Keys PSO*)
Cada parada $j$ tiene asignada una clave real continua $X_{ij} \in [0, 1]$. La posición de la partícula es un vector continuo sobre el cual operan fielmente las ecuaciones canónicas de PSO ($w, c_1, c_2$). La ruta de entrega se obtiene ordenando los identificadores de parada según el valor ascendente de sus claves reales (`argsort`).

*Selección de Implementación:* Se implementa el **Enfoque A (Swap Sequence PSO)** por su correspondencia directa con la estructura combinatoria del problema de ruteo, complementado con un operador de perturbación local (2-opt selectivo) para evitar el estancamiento prematuro característico de PSO en grafos no euclidianos.

---

## 5. Parámetros de Comparación y Métricas de Desempeño

| Métrica | Definición en la Aplicación |
| :--- | :--- |
| **Distancia Total (km)** | Longitud acumulada sobre la red vial real (o Haversine en fallback) del circuito cerrado. |
| **Tiempo Estimado de Viaje** | Suma de duraciones en tráfico de OSRM ($t_{\text{viaje}}$) más tiempo estándar de descarga por paquete (5 min/parada). |
| **Tiempo de Cómputo (ms)** | Tiempo de CPU consumido por el navegador en milisegundos (`performance.now()`). |
| **Tasa de Mejora (%)** | Disminución porcentual de distancia respecto a la ruta inicial aleatoria/voraz: $\frac{L_{\text{inicial}} - L_{\text{óptimo}}}{L_{\text{inicial}}} \times 100\%$. |
| **Curva de Convergencia** | Evolución del mejor costo encontrado ($L_{\text{best}}$) en función del número de iteración. |

---

## 6. Escenario Real: Zona Metropolitana de Guadalajara (ZMG)

* **Depósito Central (Amazon Delivery Station DGD1):** 
  - Ubicación: Zona Industrial GDL (`20.6350, -103.3578`).
* **14 Paradas Estratégicas:**
  1. Expo Guadalajara (`20.6534, -103.3917`)
  2. Glorieta Minerva (`20.6744, -103.3874`)
  3. Centro Histórico / Catedral (`20.6770, -103.3470`)
  4. Plaza Patria (`20.7107, -103.3768`)
  5. Andares Mall (`20.7099, -103.4140`)
  6. Estadio Akron (`20.6817, -103.4628`)
  7. Tlaquepaque Centro (`20.6402, -103.3135`)
  8. Parque Metropolitano (`20.6698, -103.4443`)
  9. ITESO Universidad (`20.6079, -103.4150`)
  10. CUCEI UdG (`20.6570, -103.3262`)
  11. Plaza del Sol (`20.6508, -103.4005`)
  12. Zapopan Centro (`20.7214, -103.3922`)
  13. Chapultepec Zona Rosa (`20.6738, -103.3688`)
  14. Tonalá Centro Artesanal (`20.6247, -103.2425`)
