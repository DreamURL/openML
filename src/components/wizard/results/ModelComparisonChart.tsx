import { useMemo } from 'react'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { useLang } from '@/context/LangContext'
import { t } from '@/i18n/strings'
import type { ModelType } from '@/context/WizardContext'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

interface ModelComparisonChartProps {
  results: Map<ModelType, { metrics: Record<string, number> }>
}

const MODEL_NAME_KEYS: Record<ModelType, string> = {
  multiple_regression: 'multipleRegression',
  logistic: 'logisticName',
  random_forest: 'forestName',
  ann: 'annName',
  xgboost: 'xgboostName',
  kmeans: 'kmeansName',
  pca: 'pcaName',
}

const DATASET_COLORS = [
  'rgba(108, 99, 255, 0.7)',
  'rgba(34, 197, 94, 0.7)',
  'rgba(234, 179, 8, 0.7)',
  'rgba(239, 68, 68, 0.7)',
  'rgba(59, 130, 246, 0.7)',
  'rgba(168, 85, 247, 0.7)',
  'rgba(236, 72, 153, 0.7)',
  'rgba(20, 184, 166, 0.7)',
]

export function ModelComparisonChart({ results }: ModelComparisonChartProps) {
  const { lang } = useLang()

  const { labels, datasets } = useMemo(() => {
    const entries = Array.from(results.entries())
    if (entries.length === 0) return { labels: [], datasets: [] }

    // Collect all unique metric keys across all models
    const allMetricKeys = new Set<string>()
    for (const [, result] of entries) {
      for (const key of Object.keys(result.metrics)) {
        allMetricKeys.add(key)
      }
    }

    // Metric keys become x-axis labels
    const metricLabels = Array.from(allMetricKeys)

    // Each model becomes a dataset
    const chartDatasets = entries.map(([modelType, result], idx) => {
      const data = metricLabels.map((key) => {
        const value = result.metrics[key]
        return value != null ? Number(value) : 0
      })

      return {
        label: t(MODEL_NAME_KEYS[modelType] as any, lang) || modelType,
        data,
        backgroundColor: DATASET_COLORS[idx % DATASET_COLORS.length],
        borderColor: DATASET_COLORS[idx % DATASET_COLORS.length].replace('0.7', '1'),
        borderWidth: 1,
      }
    })

    return { labels: metricLabels, datasets: chartDatasets }
  }, [results])

  if (results.size === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-12 text-center">
        <p className="text-sm text-text-muted">{t('noModelsToCompare', lang)}</p>
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-medium">{t('modelComparison', lang)}</h3>
      <Bar
        data={{ labels, datasets }}
        options={{
          responsive: true,
          maintainAspectRatio: true,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              labels: {
                color: '#94a3b8',
                usePointStyle: true,
                pointStyle: 'rect',
                padding: 16,
              },
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const value = context.parsed.y
                  return `${context.dataset.label}: ${value?.toFixed(4) ?? '0'}`
                },
              },
            },
          },
          scales: {
            x: {
              ticks: { color: '#94a3b8' },
              grid: { color: 'rgba(45, 49, 80, 0.5)' },
            },
            y: {
              ticks: { color: '#94a3b8' },
              grid: { color: 'rgba(45, 49, 80, 0.5)' },
              beginAtZero: true,
            },
          },
        }}
      />

      {/* Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left text-text-muted font-medium">
                {t('metric', lang)}
              </th>
              {Array.from(results.entries()).map(([modelType]) => (
                <th
                  key={modelType}
                  className="px-3 py-2 text-right text-text-muted font-medium"
                >
                  {t(MODEL_NAME_KEYS[modelType] as any, lang) || modelType}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((metricKey) => {
              // Find best value for this metric (lower is better for error metrics)
              const lowerIsBetter = ['rmse', 'mae', 'mse', 'trainRmse'].includes(metricKey)
              const values = Array.from(results.values()).map(
                (r) => r.metrics[metricKey] ?? null
              )
              const validValues = values.filter((v): v is number => v != null)
              const bestValue = validValues.length > 0
                ? (lowerIsBetter ? Math.min(...validValues) : Math.max(...validValues))
                : null

              return (
                <tr key={metricKey} className="border-b border-border/30">
                  <td className="px-3 py-2 font-mono font-medium">{metricKey}</td>
                  {Array.from(results.values()).map((r, idx) => {
                    const value = r.metrics[metricKey]
                    const isBest =
                      value != null && bestValue != null && value === bestValue && validValues.length > 1

                    return (
                      <td
                        key={idx}
                        className={`px-3 py-2 text-right font-mono ${
                          isBest ? 'text-accent font-semibold' : 'text-text-muted'
                        }`}
                      >
                        {value != null ? Number(value).toFixed(4) : '--'}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
