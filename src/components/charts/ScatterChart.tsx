import { Scatter } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(LinearScale, PointElement, Tooltip, Legend)

interface ScatterDataset {
  label: string
  data: { x: number; y: number }[]
  backgroundColor: string
}

interface ScatterChartProps {
  datasets: ScatterDataset[]
  xLabel?: string
  yLabel?: string
  title?: string
}

const COLORS = [
  'rgba(108, 99, 255, 0.7)',
  'rgba(34, 197, 94, 0.7)',
  'rgba(245, 158, 11, 0.7)',
  'rgba(239, 68, 68, 0.7)',
  'rgba(59, 130, 246, 0.7)',
  'rgba(168, 85, 247, 0.7)',
  'rgba(236, 72, 153, 0.7)',
  'rgba(20, 184, 166, 0.7)',
  'rgba(251, 146, 60, 0.7)',
  'rgba(132, 204, 22, 0.7)',
]

export { COLORS as CHART_COLORS }

export function ScatterChart({ datasets, xLabel, yLabel, title }: ScatterChartProps) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      {title && <h3 className="text-sm font-medium mb-3">{title}</h3>}
      <Scatter
        data={{ datasets }}
        options={{
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              labels: { color: '#94a3b8', font: { size: 11 } },
            },
          },
          scales: {
            x: {
              title: { display: !!xLabel, text: xLabel, color: '#94a3b8' },
              ticks: { color: '#94a3b8' },
              grid: { color: 'rgba(45, 49, 80, 0.5)' },
            },
            y: {
              title: { display: !!yLabel, text: yLabel, color: '#94a3b8' },
              ticks: { color: '#94a3b8' },
              grid: { color: 'rgba(45, 49, 80, 0.5)' },
            },
          },
        }}
      />
    </div>
  )
}
