import { useState, useMemo, useCallback } from 'react'
import { useData } from '@/context/DataContext'
import { useNavigate } from 'react-router-dom'
import { ColumnSelector } from '@/components/data/ColumnSelector'
import { ScatterChart } from '@/components/charts/ScatterChart'
import { Grid3x3, Download } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'

type Method = 'pearson' | 'spearman'

interface CorrelationResult {
  matrix: number[][]
  features: string[]
  method: Method
  dataCount: number
}

function pearson(x: number[], y: number[]): number {
  const n = x.length
  if (n === 0) return 0
  const sumX = x.reduce((a, b) => a + b, 0)
  const sumY = y.reduce((a, b) => a + b, 0)
  const sumXY = x.reduce((s, xi, i) => s + xi * y[i], 0)
  const sumX2 = x.reduce((s, xi) => s + xi * xi, 0)
  const sumY2 = y.reduce((s, yi) => s + yi * yi, 0)
  const num = n * sumXY - sumX * sumY
  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))
  return den === 0 ? 0 : num / den
}

function spearman(x: number[], y: number[]): number {
  const rank = (arr: number[]) => {
    const sorted = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v)
    const ranks = new Array(arr.length)
    sorted.forEach((item, r) => { ranks[item.i] = r + 1 })
    return ranks
  }
  return pearson(rank(x), rank(y))
}

function getColor(value: number): string {
  const abs = Math.abs(value)
  if (abs < 0.1) return 'rgba(148, 163, 184, 0.15)'
  if (value > 0) {
    if (abs < 0.3) return 'rgba(108, 99, 255, 0.2)'
    if (abs < 0.5) return 'rgba(108, 99, 255, 0.4)'
    if (abs < 0.7) return 'rgba(108, 99, 255, 0.6)'
    return 'rgba(108, 99, 255, 0.85)'
  } else {
    if (abs < 0.3) return 'rgba(239, 68, 68, 0.2)'
    if (abs < 0.5) return 'rgba(239, 68, 68, 0.4)'
    if (abs < 0.7) return 'rgba(239, 68, 68, 0.6)'
    return 'rgba(239, 68, 68, 0.85)'
  }
}

export function CorrelationAnalysis() {
  const { rawData, numericalColumns } = useData()
  const navigate = useNavigate()
  const { theme } = useTheme()

  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([])
  const [method, setMethod] = useState<Method>('pearson')
  const [minCorrelation, setMinCorrelation] = useState(0)
  const [result, setResult] = useState<CorrelationResult | null>(null)
  const [activeTab, setActiveTab] = useState<'heatmap' | 'scatter' | 'summary'>('heatmap')

  const calculate = useCallback(() => {
    if (selectedFeatures.length < 2) return

    const processed = rawData
      .map((row) => {
        const r: Record<string, number | null> = {}
        for (const f of selectedFeatures) {
          const v = Number(row[f])
          r[f] = isNaN(v) ? null : v
        }
        return r
      })
      .filter((r) => selectedFeatures.every((f) => r[f] !== null)) as Record<string, number>[]

    const matrix: number[][] = []
    for (let i = 0; i < selectedFeatures.length; i++) {
      const row: number[] = []
      for (let j = 0; j < selectedFeatures.length; j++) {
        if (i === j) {
          row.push(1)
        } else {
          const x = processed.map((r) => r[selectedFeatures[i]])
          const y = processed.map((r) => r[selectedFeatures[j]])
          row.push(method === 'pearson' ? pearson(x, y) : spearman(x, y))
        }
      }
      matrix.push(row)
    }

    setResult({ matrix, features: [...selectedFeatures], method, dataCount: processed.length })
    setActiveTab('heatmap')
  }, [rawData, selectedFeatures, method])

  const strongCorrelations = useMemo(() => {
    if (!result) return []
    const pairs: { f1: string; f2: string; corr: number; strength: string; dir: string }[] = []
    for (let i = 0; i < result.features.length; i++) {
      for (let j = i + 1; j < result.features.length; j++) {
        const c = result.matrix[i][j]
        if (Math.abs(c) >= minCorrelation) {
          const abs = Math.abs(c)
          pairs.push({
            f1: result.features[i],
            f2: result.features[j],
            corr: c,
            strength: abs >= 0.7 ? 'Very Strong' : abs >= 0.5 ? 'Strong' : abs >= 0.3 ? 'Moderate' : 'Weak',
            dir: c > 0 ? 'Positive' : 'Negative',
          })
        }
      }
    }
    return pairs.sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr))
  }, [result, minCorrelation])

  const downloadCSV = () => {
    if (!result) return
    let csv = ',' + result.features.join(',') + '\n'
    result.matrix.forEach((row, i) => {
      csv += result.features[i] + ',' + row.map((v) => v.toFixed(6)).join(',') + '\n'
    })
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `correlation_${result.method}_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (rawData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <Grid3x3 size={48} className="text-text-muted mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Dataset Loaded</h2>
        <p className="text-text-muted mb-4">Upload a dataset first to use Correlation Analysis.</p>
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
        <Grid3x3 size={20} className="inline mr-2 text-accent" />
        Correlation Analysis
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config */}
        <div className="space-y-5 bg-surface border border-border rounded-xl p-5">
          <h3 className="font-semibold text-sm">Configuration</h3>

          <ColumnSelector
            columns={numericalColumns}
            selected={selectedFeatures}
            onChange={setSelectedFeatures}
            label="Variables"
          />

          <div>
            <label className="text-sm font-medium text-text-muted">Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as Method)}
              className="w-full mt-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text"
            >
              <option value="pearson">Pearson (linear)</option>
              <option value="spearman">Spearman (rank-based)</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-text-muted">Min Correlation Threshold</label>
            <select
              value={minCorrelation}
              onChange={(e) => setMinCorrelation(Number(e.target.value))}
              className="w-full mt-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text"
            >
              <option value={0}>0.0 (All)</option>
              <option value={0.1}>0.1 (Weak+)</option>
              <option value={0.3}>0.3 (Moderate+)</option>
              <option value={0.5}>0.5 (Strong+)</option>
              <option value={0.7}>0.7 (Very Strong)</option>
            </select>
          </div>

          <button
            onClick={calculate}
            disabled={selectedFeatures.length < 2}
            className="w-full bg-accent hover:bg-accent-light disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-2 rounded-lg transition-all text-sm"
          >
            Run Analysis
          </button>

          {result && (
            <button
              onClick={downloadCSV}
              className="w-full flex items-center justify-center gap-2 border border-border text-text-muted hover:text-accent hover:border-accent py-2 rounded-lg transition-all text-sm"
            >
              <Download size={14} />
              Download CSV
            </button>
          )}
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-4">
          {result && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-surface border border-border rounded-lg p-3">
                  <p className="text-xs text-text-muted">Method</p>
                  <p className="text-sm font-semibold capitalize">{result.method}</p>
                </div>
                <div className="bg-surface border border-border rounded-lg p-3">
                  <p className="text-xs text-text-muted">Variables</p>
                  <p className="text-sm font-semibold">{result.features.length}</p>
                </div>
                <div className="bg-surface border border-border rounded-lg p-3">
                  <p className="text-xs text-text-muted">Valid Rows</p>
                  <p className="text-sm font-semibold">{result.dataCount.toLocaleString()}</p>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
                {(['heatmap', 'scatter', 'summary'] as const).map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-1.5 text-sm rounded-md transition-all ${
                      activeTab === tab ? 'bg-accent text-white' : 'text-text-muted hover:text-accent'
                    }`}>
                    {tab === 'scatter' ? 'Scatter Matrix' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {activeTab === 'heatmap' && (
                <div className="bg-surface border border-border rounded-xl p-4 overflow-x-auto">
                  {/* Legend */}
                  <div className="flex items-center gap-4 text-xs text-text-muted mb-4">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(108, 99, 255, 0.85)' }} />
                      Strong positive
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(239, 68, 68, 0.85)' }} />
                      Strong negative
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(148, 163, 184, 0.15)' }} />
                      Weak
                    </div>
                  </div>

                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="p-2 text-left text-xs text-text-muted" />
                        {result.features.map((f) => (
                          <th key={f} className="p-2 text-center text-xs text-text-muted font-medium" title={f}>
                            {f.length > 8 ? f.slice(0, 8) + '…' : f}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.matrix.map((row, i) => (
                        <tr key={i}>
                          <td className="p-2 text-xs text-text-muted font-medium" title={result.features[i]}>
                            {result.features[i].length > 8
                              ? result.features[i].slice(0, 8) + '…'
                              : result.features[i]}
                          </td>
                          {row.map((val, j) => (
                            <td
                              key={j}
                              className="p-2 text-center text-xs font-mono border border-border/30"
                              style={{
                                backgroundColor: getColor(val),
                                color: Math.abs(val) > 0.5 ? 'white' : undefined,
                              }}
                              title={`${result.features[i]} vs ${result.features[j]}: ${val.toFixed(4)}`}
                            >
                              {val.toFixed(2)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'scatter' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 text-xs text-text-muted">
                    <div className="flex items-center gap-1">
                      <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: 'rgba(108, 99, 255, 0.7)' }} />
                      Strong correlation (|r| &ge; 0.5)
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: theme === 'light' ? 'rgba(30, 41, 59, 0.5)' : 'rgba(148, 163, 184, 0.4)' }} />
                      Weak correlation (|r| &lt; 0.5)
                    </div>
                  </div>
                  {result.features.map((fy, i) =>
                    result.features.map((fx, j) => {
                      if (i >= j) return null
                      const MAX_POINTS = 500
                      const step = Math.max(1, Math.floor(rawData.length / MAX_POINTS))
                      const points: { x: number; y: number }[] = []
                      for (let k = 0; k < rawData.length; k += step) {
                        const xv = Number(rawData[k][fx])
                        const yv = Number(rawData[k][fy])
                        if (!isNaN(xv) && !isNaN(yv)) points.push({ x: xv, y: yv })
                      }
                      const corr = result.matrix[i][j]
                      return (
                        <ScatterChart
                          key={`${fx}-${fy}`}
                          datasets={[{ label: `${fx} vs ${fy}`, data: points, backgroundColor: theme === 'light'
                            ? (Math.abs(corr) >= 0.5 ? 'rgba(108, 99, 255, 0.7)' : 'rgba(30, 41, 59, 0.5)')
                            : (Math.abs(corr) >= 0.5 ? 'rgba(108, 99, 255, 0.5)' : 'rgba(148, 163, 184, 0.4)') }]}
                          xLabel={fx}
                          yLabel={fy}
                          title={`${fx} vs ${fy} (r = ${corr.toFixed(3)})`}
                        />
                      )
                    })
                  )}
                </div>
              )}

              {activeTab === 'summary' && (
                <div className="bg-surface border border-border rounded-xl p-4 space-y-2">
                  <h4 className="text-sm font-medium text-text-muted mb-3">
                    Correlations above {minCorrelation} threshold
                  </h4>
                  {strongCorrelations.length > 0 ? (
                    strongCorrelations.map((item, i) => (
                      <div
                        key={i}
                        className="flex justify-between items-center p-3 bg-bg rounded-lg"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {item.f1} ↔ {item.f2}
                          </p>
                          <p className="text-xs text-text-muted">
                            {item.dir} · {item.strength}
                          </p>
                        </div>
                        <span
                          className={`text-sm font-mono font-semibold px-2 py-0.5 rounded ${
                            Math.abs(item.corr) >= 0.7
                              ? 'bg-accent/20 text-accent'
                              : 'bg-border text-text-muted'
                          }`}
                        >
                          {item.corr.toFixed(3)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-text-muted text-sm">
                      No correlations above threshold {minCorrelation}. Try lowering it.
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {!result && (
            <div className="bg-surface border border-border rounded-xl p-12 text-center text-text-muted">
              <Grid3x3 size={40} className="mx-auto mb-3 opacity-30" />
              <p>Select variables and click "Run Analysis" to compute correlations</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
