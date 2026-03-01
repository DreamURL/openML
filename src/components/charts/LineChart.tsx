import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

interface LineChartProps {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    borderColor: string
    backgroundColor?: string
    borderDash?: number[]
    pointRadius?: number
  }[]
  title?: string
  xLabel?: string
  yLabel?: string
}

export function LineChart({ labels, datasets, title, xLabel, yLabel }: LineChartProps) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      {title && <h3 className="text-sm font-medium mb-3">{title}</h3>}
      <Line
        data={{
          labels,
          datasets: datasets.map((ds) => ({
            ...ds,
            backgroundColor: ds.backgroundColor || ds.borderColor.replace('1)', '0.1)'),
            borderWidth: 2,
            pointRadius: ds.pointRadius ?? (labels.length > 100 ? 0 : 2),
            tension: 0.1,
          })),
        }}
        options={{
          responsive: true,
          maintainAspectRatio: true,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              labels: { color: '#94a3b8', usePointStyle: true, pointStyle: 'line' },
            },
          },
          scales: {
            x: {
              title: xLabel ? { display: true, text: xLabel, color: '#94a3b8' } : undefined,
              ticks: { color: '#94a3b8', maxTicksLimit: 20 },
              grid: { color: 'rgba(45, 49, 80, 0.5)' },
            },
            y: {
              title: yLabel ? { display: true, text: yLabel, color: '#94a3b8' } : undefined,
              ticks: { color: '#94a3b8' },
              grid: { color: 'rgba(45, 49, 80, 0.5)' },
            },
          },
        }}
      />
    </div>
  )
}
