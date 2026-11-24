/**
 * Administrador de Gráficas con Chart.js
 * Visualiza la convergencia de la distancia mínima (km) por iteración para ACO y PSO.
 */

export class ConvergenceChartManager {
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
            borderColor: '#06b6d4', // Cyan 500
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
            borderColor: '#10b981', // Emerald 500
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
        animation: {
          duration: 150
        },
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              boxWidth: 14,
              boxHeight: 14,
              color: '#94a3b8',
              font: {
                family: 'Inter, system-ui, sans-serif',
                size: 11,
                weight: '600'
              }
            }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            titleColor: '#f8fafc',
            bodyColor: '#cbd5e1',
            borderColor: '#334155',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: (context) => {
                return ` ${context.dataset.label}: ${context.parsed.y.toFixed(2)} km`;
              }
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Iteración',
              color: '#64748b',
              font: { size: 11, weight: '600' }
            },
            grid: {
              color: 'rgba(51, 65, 85, 0.25)'
            },
            ticks: {
              color: '#94a3b8',
              maxTicksLimit: 12
            }
          },
          y: {
            title: {
              display: true,
              text: 'Distancia de Ruta (km)',
              color: '#64748b',
              font: { size: 11, weight: '600' }
            },
            grid: {
              color: 'rgba(51, 65, 85, 0.25)'
            },
            ticks: {
              color: '#94a3b8',
              callback: (val) => `${val.toFixed(0)} km`
            }
          }
        }
      }
    });
  }

  addDataPoint(algorithm, iteration, distance) {
    if (!this.chart) return;

    const datasetIndex = algorithm === 'aco' ? 0 : 1;
    const labelStr = `${iteration}`;

    // Si la iteración excede las etiquetas actuales, agregarla
    if (!this.chart.data.labels.includes(labelStr)) {
      this.chart.data.labels.push(labelStr);
    }

    this.chart.data.datasets[datasetIndex].data.push(distance);
    this.chart.update('none'); // Actualización rápida sin bloquear hilo
  }

  reset() {
    if (!this.chart) return;
    this.chart.data.labels = [];
    this.chart.data.datasets[0].data = [];
    this.chart.data.datasets[1].data = [];
    this.chart.update();
  }
}
