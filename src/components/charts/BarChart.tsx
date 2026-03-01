import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

interface BarChartProps {
  labels: string[]
  data: number[]
  label?: string
  color?: string
  title?: string
  horizontal?: boolean
}

export function BarChart({
  labels,
  data,
  label = 'Value',
  color = 'rgba(108, 99, 255, 0.7)',
  title,
  horizontal = false,
}: BarChartProps) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      {title && <h3 className="text-sm font-medium mb-3">{title}</h3>}
      <Bar
        data={{
          labels,
          datasets: [
            {
              label,
              data,
              backgroundColor: color,
              borderColor: color.replace('0.7', '1'),
              borderWidth: 1,
            },
          ],
        }}
        options={{
          indexAxis: horizontal ? 'y' : 'x',
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { display: false },
          },
          scales: {
            x: {
              ticks: { color: '#94a3b8' },
              grid: { color: 'rgba(45, 49, 80, 0.5)' },
            },
            y: {
              ticks: { color: '#94a3b8' },
              grid: { color: 'rgba(45, 49, 80, 0.5)' },
            },
          },
        }}
      />
    </div>
  )
}
