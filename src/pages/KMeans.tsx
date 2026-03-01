import { useState, useMemo } from 'react'
import { useData } from '@/context/DataContext'
import { useWorker } from '@/hooks/useWorker'
import { useNavigate } from 'react-router-dom'
import { ColumnSelector } from '@/components/data/ColumnSelector'
import { TrainingProgress } from '@/components/ml/TrainingProgress'
import { ScatterChart, CHART_COLORS } from '@/components/charts/ScatterChart'
import { BarChart } from '@/components/charts/BarChart'
import { GitBranch, Download } from 'lucide-react'
import * as XLSX from 'xlsx'

interface KMeansResult {
  centroids: number[][]
  assignments: number[]
  inertia: number
  iterations: number
  clusterStats: {
    id: number
    count: number
    percentage: number
    featureStats: Record<string, { avg: number; min: number; max: number }>
  }[]
  features: string[]
  backend: string
}

const BASE = import.meta.env.BASE_URL

export function KMeans() {
  const { rawData, numericalColumns } = useData()
  const navigate = useNavigate()

  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([])
  const [k, setK] = useState(3)
  const [maxIterations, setMaxIterations] = useState(100)
  const [normalize, setNormalize] = useState(true)
  const [xAxis, setXAxis] = useState('')
  const [yAxis, setYAxis] = useState('')
  const [activeTab, setActiveTab] = useState<'chart' | 'stats'>('chart')

  const { run, progress, progressMessage, result, error, isRunning, cancel } =
    useWorker<KMeansResult>(`${BASE}workers/kmeans.worker.js`)

  const handleTrain = () => {
    if (selectedFeatures.length < 2) return
    if (!xAxis) setXAxis(selectedFeatures[0])
    if (!yAxis) setYAxis(selectedFeatures[1])

    run({
      type: 'RUN_KMEANS',
      payload: {
        data: rawData,
        features: selectedFeatures,
        k,
        maxIterations,
        normalize,
      },
    })
  }

  const scatterDatasets = useMemo(() => {
    if (!result) return []
    const fx = xAxis || selectedFeatures[0]
    const fy = yAxis || selectedFeatures[1]
    if (!fx || !fy) return []

    const datasets: { label: string; data: { x: number; y: number }[]; backgroundColor: string }[] = []

    for (let c = 0; c < result.clusterStats.length; c++) {
      const points: { x: number; y: number }[] = []
      result.assignments.forEach((a, idx) => {
        if (a === c) {
          const x = parseFloat(String(rawData[idx][fx]))
          const y = parseFloat(String(rawData[idx][fy]))
          if (!isNaN(x) && !isNaN(y)) points.push({ x, y })
        }
      })
      datasets.push({
        label: `Cluster ${c + 1}`,
        data: points.slice(0, 1000),
        backgroundColor: CHART_COLORS[c % CHART_COLORS.length],
      })
    }
    return datasets
  }, [result, rawData, xAxis, yAxis, selectedFeatures])

  if (rawData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <GitBranch size={48} className="text-text-muted mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Dataset Loaded</h2>
        <p className="text-text-muted mb-4">Upload a dataset first to use K-Means clustering.</p>
        <button
          onClick={() => navigate('/')}
          className="bg-accent hover:bg-accent-light text-white font-medium px-4 py-2 rounded-lg transition-all"
        >
          Go to Home
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h2 className="text-xl font-bold">
        <GitBranch size={20} className="inline mr-2 text-accent" />
        K-Means Clustering
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <div className="space-y-5 bg-surface border border-border rounded-xl p-5">
          <h3 className="font-semibold text-sm">Configuration</h3>

          <ColumnSelector
            columns={numericalColumns}
            selected={selectedFeatures}
            onChange={setSelectedFeatures}
            label="Feature Columns"
          />

          <div>
            <label className="text-sm font-medium text-text-muted">
              Clusters (k): {k}
            </label>
            <input
              type="range"
              min={2}
              max={10}
              value={k}
              onChange={(e) => setK(Number(e.target.value))}
              className="w-full mt-1 accent-accent"
            />
            <div className="flex justify-between text-xs text-text-muted">
              <span>2</span>
              <span>10</span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-text-muted">
              Max Iterations: {maxIterations}
            </label>
            <input
              type="range"
              min={50}
              max={500}
              step={50}
              value={maxIterations}
              onChange={(e) => setMaxIterations(Number(e.target.value))}
              className="w-full mt-1 accent-accent"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={normalize}
              onChange={(e) => setNormalize(e.target.checked)}
              className="accent-accent"
            />
            Normalize data
          </label>

          <div className="flex gap-2">
            <button
              onClick={handleTrain}
              disabled={isRunning || selectedFeatures.length < 2}
              className="flex-1 bg-accent hover:bg-accent-light disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-2 rounded-lg transition-all text-sm"
            >
              {isRunning ? 'Training...' : 'Run K-Means'}
            </button>
            {isRunning && (
              <button
                onClick={cancel}
                className="px-3 py-2 border border-danger text-danger rounded-lg text-sm hover:bg-danger/10"
              >
                Cancel
              </button>
            )}
          </div>

          {selectedFeatures.length < 2 && selectedFeatures.length > 0 && (
            <p className="text-xs text-warning">Select at least 2 features</p>
          )}

          <TrainingProgress progress={progress} message={progressMessage} isRunning={isRunning} />

          {error && (
            <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg px-3 py-2 text-xs">
              {error}
            </div>
          )}

          {result && (
            <button
              onClick={() => {
                const rows = rawData.map((row, i) => ({
                  ...row,
                  Cluster: result.assignments[i] !== undefined ? result.assignments[i] + 1 : '',
                }))
                const ws = XLSX.utils.json_to_sheet(rows)
                const wb = XLSX.utils.book_new()
                XLSX.utils.book_append_sheet(wb, ws, 'KMeans')
                XLSX.writeFile(wb, 'kmeans_clusters.xlsx')
              }}
              className="w-full flex items-center justify-center gap-2 border border-border text-text-muted hover:text-accent hover:border-accent py-2 rounded-lg transition-all text-sm"
            >
              <Download size={14} /> Download Clustered Data (Excel)
            </button>
          )}
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-2 space-y-4">
          {result && (
            <>
              {/* Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Clusters', value: result.clusterStats.length },
                  { label: 'Iterations', value: result.iterations },
                  { label: 'Inertia', value: result.inertia.toFixed(4) },
                  { label: 'Backend', value: result.backend },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-surface border border-border rounded-lg p-3">
                    <p className="text-xs text-text-muted">{label}</p>
                    <p className="text-lg font-semibold font-mono">{value}</p>
                  </div>
                ))}
              </div>

              {/* Tabs */}
              <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('chart')}
                  className={`flex-1 py-1.5 text-sm rounded-md transition-all ${
                    activeTab === 'chart' ? 'bg-accent text-white' : 'text-text-muted hover:text-accent'
                  }`}
                >
                  Chart
                </button>
                <button
                  onClick={() => setActiveTab('stats')}
                  className={`flex-1 py-1.5 text-sm rounded-md transition-all ${
                    activeTab === 'stats' ? 'bg-accent text-white' : 'text-text-muted hover:text-accent'
                  }`}
                >
                  Statistics
                </button>
              </div>

              {activeTab === 'chart' && (
                <>
                  {/* Axis selectors */}
                  <div className="flex gap-4">
                    <label className="text-sm flex items-center gap-2">
                      X:
                      <select
                        value={xAxis || selectedFeatures[0]}
                        onChange={(e) => setXAxis(e.target.value)}
                        className="bg-bg border border-border rounded px-2 py-1 text-sm text-text"
                      >
                        {selectedFeatures.map((f) => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm flex items-center gap-2">
                      Y:
                      <select
                        value={yAxis || selectedFeatures[1]}
                        onChange={(e) => setYAxis(e.target.value)}
                        className="bg-bg border border-border rounded px-2 py-1 text-sm text-text"
                      >
                        {selectedFeatures.map((f) => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <ScatterChart
                    datasets={scatterDatasets}
                    xLabel={xAxis || selectedFeatures[0]}
                    yLabel={yAxis || selectedFeatures[1]}
                    title="Cluster Visualization"
                  />

                  <BarChart
                    labels={result.clusterStats.map((s) => `Cluster ${s.id + 1}`)}
                    data={result.clusterStats.map((s) => s.count)}
                    label="Points"
                    title="Cluster Sizes"
                  />
                </>
              )}

              {activeTab === 'stats' && (
                <div className="bg-surface border border-border rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="px-4 py-2 text-left text-text-muted">Cluster</th>
                          <th className="px-4 py-2 text-left text-text-muted">Count</th>
                          <th className="px-4 py-2 text-left text-text-muted">%</th>
                          {selectedFeatures.map((f) => (
                            <th key={f} className="px-4 py-2 text-left text-text-muted">
                              {f} (avg)
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.clusterStats.map((stat) => (
                          <tr key={stat.id} className="border-b border-border/50 hover:bg-surface-hover">
                            <td className="px-4 py-2">
                              <span
                                className="inline-block w-3 h-3 rounded-full mr-2"
                                style={{
                                  backgroundColor: CHART_COLORS[stat.id % CHART_COLORS.length],
                                }}
                              />
                              Cluster {stat.id + 1}
                            </td>
                            <td className="px-4 py-2 font-mono">{stat.count}</td>
                            <td className="px-4 py-2 font-mono">{stat.percentage}%</td>
                            {selectedFeatures.map((f) => (
                              <td key={f} className="px-4 py-2 font-mono">
                                {stat.featureStats[f]?.avg ?? '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {!result && !isRunning && (
            <div className="bg-surface border border-border rounded-xl p-12 text-center text-text-muted">
              <GitBranch size={40} className="mx-auto mb-3 opacity-30" />
              <p>Configure parameters and click "Run K-Means" to start</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
