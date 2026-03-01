import { useState, useMemo, useCallback } from 'react'
import { useData } from '@/context/DataContext'
import { useNavigate } from 'react-router-dom'
import { ColumnSelector } from '@/components/data/ColumnSelector'
import { ScatterChart } from '@/components/charts/ScatterChart'
import { Grid3x3, Download, ImageDown } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'
import { useLang } from '@/context/LangContext'
import { t } from '@/i18n/strings'

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
  const { lang } = useLang()

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
            strength: abs >= 0.7 ? 'veryStrong' : abs >= 0.5 ? 'strong' : abs >= 0.3 ? 'moderate' : 'weak',
            dir: c > 0 ? 'positive' : 'negative',
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

  const downloadHeatmapImage = () => {
    if (!result) return
    const { matrix, features } = result
    const cellSize = 56
    const padding = 16
    const labelFont = '11px Inter, sans-serif'
    const valueFont = '12px JetBrains Mono, monospace'

    // Measure label widths
    const measureCanvas = document.createElement('canvas')
    const mCtx = measureCanvas.getContext('2d')!
    mCtx.font = labelFont
    const maxLabelWidth = Math.max(...features.map((f) => mCtx.measureText(f).width)) + 12
    const labelWidth = Math.max(80, maxLabelWidth)

    // Color bar dimensions
    const barWidth = 20
    const barGap = 16
    const barLabelWidth = 36

    const bottomLabelHeight = 24
    const gridWidth = features.length * cellSize
    const gridHeight = features.length * cellSize
    const width = padding + labelWidth + gridWidth + barGap + barWidth + barLabelWidth + padding
    const height = padding + gridHeight + bottomLabelHeight + padding

    const canvas = document.createElement('canvas')
    canvas.width = width * 2
    canvas.height = height * 2
    const ctx = canvas.getContext('2d')!
    ctx.scale(2, 2)

    // Background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)

    const gridLeft = padding + labelWidth
    const gridTop = padding

    // Row labels (left) + cells
    ctx.font = labelFont
    features.forEach((f, i) => {
      // Row label
      ctx.fillStyle = '#64748b'
      ctx.textAlign = 'right'
      ctx.font = labelFont
      ctx.fillText(f, gridLeft - 8, gridTop + i * cellSize + cellSize / 2 + 4)

      // Cells
      matrix[i].forEach((val, j) => {
        const x = gridLeft + j * cellSize
        const y = gridTop + i * cellSize

        ctx.fillStyle = getColor(val)
        ctx.fillRect(x, y, cellSize, cellSize)

        ctx.strokeStyle = 'rgba(200,200,200,0.3)'
        ctx.strokeRect(x, y, cellSize, cellSize)

        ctx.fillStyle = Math.abs(val) > 0.5 ? '#ffffff' : '#334155'
        ctx.font = valueFont
        ctx.textAlign = 'center'
        ctx.fillText(val.toFixed(2), x + cellSize / 2, y + cellSize / 2 + 4)
      })
    })

    // Bottom column labels (horizontal)
    ctx.font = labelFont
    ctx.fillStyle = '#64748b'
    ctx.textAlign = 'center'
    features.forEach((f, j) => {
      const x = gridLeft + j * cellSize + cellSize / 2
      const y = gridTop + gridHeight + 14
      const maxChars = Math.max(4, Math.floor(cellSize / 7))
      ctx.fillText(f.length > maxChars ? f.slice(0, maxChars - 1) + '…' : f, x, y)
    })

    // Color bar (right side) — gradient from +1 (blue top) to -1 (red bottom)
    const barLeft = gridLeft + gridWidth + barGap
    const barTop = gridTop
    const barHeight = gridHeight

    for (let py = 0; py < barHeight; py++) {
      const ratio = py / barHeight  // 0 = top (+1), 1 = bottom (-1)
      const value = 1 - ratio * 2   // +1 → -1
      ctx.fillStyle = getColor(value)
      ctx.fillRect(barLeft, barTop + py, barWidth, 1)
    }
    ctx.strokeStyle = 'rgba(200,200,200,0.5)'
    ctx.strokeRect(barLeft, barTop, barWidth, barHeight)

    // Color bar tick labels
    ctx.font = '10px Inter, sans-serif'
    ctx.fillStyle = '#64748b'
    ctx.textAlign = 'left'
    const ticks = [1, 0.5, 0, -0.5, -1]
    ticks.forEach((v) => {
      const ty = barTop + ((1 - v) / 2) * barHeight
      ctx.fillText(v.toFixed(1), barLeft + barWidth + 4, ty + 3)
      ctx.beginPath()
      ctx.moveTo(barLeft + barWidth, ty)
      ctx.lineTo(barLeft + barWidth + 2, ty)
      ctx.strokeStyle = '#94a3b8'
      ctx.stroke()
    })

    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `heatmap_${result.method}_${Date.now()}.png`
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  if (rawData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <Grid3x3 size={48} className="text-text-muted mb-4" />
        <h2 className="text-xl font-semibold mb-2">{t('noDataset', lang)}</h2>
        <p className="text-text-muted mb-4">{t('noDatasetDesc', lang)}</p>
        <button
          onClick={() => navigate('/')}
          className="bg-accent hover:bg-accent-light text-white font-medium px-4 py-2 rounded-lg transition-all"
        >
          {t('goToHome', lang)}
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h2 className="text-xl font-bold">
        <Grid3x3 size={20} className="inline mr-2 text-accent" />
        {t('correlationName', lang)}
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config */}
        <div className="space-y-5 bg-surface border border-border rounded-xl p-5">
          <h3 className="font-semibold text-sm">{t('configuration', lang)}</h3>

          <ColumnSelector
            columns={numericalColumns}
            selected={selectedFeatures}
            onChange={setSelectedFeatures}
            label={t('variables', lang)}
          />

          <div>
            <label className="text-sm font-medium text-text-muted">{t('method', lang)}</label>
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
            <label className="text-sm font-medium text-text-muted">{t('minCorrelationThreshold', lang)}</label>
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
            {t('runAnalysis', lang)}
          </button>

          {result && (
            <button
              onClick={downloadCSV}
              className="w-full flex items-center justify-center gap-2 border border-border text-text-muted hover:text-accent hover:border-accent py-2 rounded-lg transition-all text-sm"
            >
              <Download size={14} />
              {t('downloadCSV', lang)}
            </button>
          )}
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-4">
          {result && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-surface border border-border rounded-lg p-3">
                  <p className="text-xs text-text-muted">{t('method', lang)}</p>
                  <p className="text-sm font-semibold capitalize">{result.method}</p>
                </div>
                <div className="bg-surface border border-border rounded-lg p-3">
                  <p className="text-xs text-text-muted">{t('variables', lang)}</p>
                  <p className="text-sm font-semibold">{result.features.length}</p>
                </div>
                <div className="bg-surface border border-border rounded-lg p-3">
                  <p className="text-xs text-text-muted">{t('validRows', lang)}</p>
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
                    {tab === 'heatmap' ? t('heatmap', lang) : tab === 'scatter' ? t('scatterMatrix', lang) : t('summary', lang)}
                  </button>
                ))}
              </div>

              {activeTab === 'heatmap' && (
                <div className="bg-surface border border-border rounded-xl p-4 overflow-x-auto">
                  {/* Legend */}
                  <div className="flex items-center gap-4 text-xs text-text-muted mb-4">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(108, 99, 255, 0.85)' }} />
                      {t('strongPositive', lang)}
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(239, 68, 68, 0.85)' }} />
                      {t('strongNegative', lang)}
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(148, 163, 184, 0.15)' }} />
                      {t('weak', lang)}
                    </div>
                    <button
                      onClick={downloadHeatmapImage}
                      className="ml-auto flex items-center gap-1 text-text-muted hover:text-accent transition-colors"
                      title={t('downloadImage', lang)}
                    >
                      <ImageDown size={14} />
                      <span className="hidden sm:inline">{t('downloadImage', lang)}</span>
                    </button>
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
                      {t('strongCorrelation', lang)}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: theme === 'light' ? 'rgba(30, 41, 59, 0.5)' : 'rgba(148, 163, 184, 0.4)' }} />
                      {t('weakCorrelation', lang)}
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
                    {t('correlationsAbove', lang)} {minCorrelation} {t('threshold', lang)}
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
                            {t(item.dir as 'positive' | 'negative', lang)} · {t(item.strength as 'veryStrong' | 'strong' | 'moderate' | 'weak', lang)}
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
                      {t('noCorrelations', lang)} ({minCorrelation}). {t('tryLowering', lang)}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {!result && (
            <div className="bg-surface border border-border rounded-xl p-12 text-center text-text-muted">
              <Grid3x3 size={40} className="mx-auto mb-3 opacity-30" />
              <p>{t('selectVarsPrompt', lang)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
