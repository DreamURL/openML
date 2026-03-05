import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useData } from '@/context/DataContext'
import { useWizard } from '@/context/WizardContext'
import { useLang } from '@/context/LangContext'
import { useTheme } from '@/context/ThemeContext'
import { t } from '@/i18n/strings'
import { ScatterChart } from '@/components/charts/ScatterChart'
import {
  computeCorrelationMatrix, getStrongCorrelations, getCorrelationColor,
  type CorrelationMethod, type CorrelationResult,
} from '@/utils/correlation'
import { Grid3x3, RefreshCw, X as XIcon, Download, ImageDown } from 'lucide-react'

export function CorrelationPanel() {
  const { rawData, numericalColumns } = useData()
  const { excludedColumns, setExcludedColumns } = useWizard()
  const { lang } = useLang()
  const { theme } = useTheme()

  const [method, setMethod] = useState<CorrelationMethod>('pearson')
  const [minCorrelation, setMinCorrelation] = useState(0.5)
  const [result, setResult] = useState<CorrelationResult | null>(null)

  const activeFeatures = useMemo(() =>
    numericalColumns.filter((c) => !excludedColumns.includes(c)),
    [numericalColumns, excludedColumns]
  )

  // Track whether user has run analysis at least once
  const hasAnalyzed = useRef(false)

  const calculate = useCallback(() => {
    if (activeFeatures.length < 2) return
    hasAnalyzed.current = true
    const r = computeCorrelationMatrix(rawData, activeFeatures, method)
    setResult(r)
  }, [rawData, activeFeatures, method])

  // Auto-recalculate when activeFeatures change (after initial analysis)
  useEffect(() => {
    if (!hasAnalyzed.current) return
    if (activeFeatures.length < 2) { setResult(null); return }
    const r = computeCorrelationMatrix(rawData, activeFeatures, method)
    setResult(r)
  }, [activeFeatures, rawData, method])

  const strongCorrelations = useMemo(() => {
    if (!result) return []
    return getStrongCorrelations(result, minCorrelation)
  }, [result, minCorrelation])

  const excludeColumn = (col: string) => {
    if (!excludedColumns.includes(col)) {
      setExcludedColumns([...excludedColumns, col])
    }
  }

  const restoreColumn = (col: string) => {
    setExcludedColumns(excludedColumns.filter((c) => c !== col))
  }

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

    const measureCanvas = document.createElement('canvas')
    const mCtx = measureCanvas.getContext('2d')!
    mCtx.font = labelFont
    const maxLabelWidth = Math.max(...features.map((f) => mCtx.measureText(f).width)) + 12
    const labelWidth = Math.max(80, maxLabelWidth)
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
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)

    const gridLeft = padding + labelWidth
    const gridTop = padding

    ctx.font = labelFont
    features.forEach((f, i) => {
      ctx.fillStyle = '#64748b'
      ctx.textAlign = 'right'
      ctx.font = labelFont
      ctx.fillText(f, gridLeft - 8, gridTop + i * cellSize + cellSize / 2 + 4)
      matrix[i].forEach((val, j) => {
        const x = gridLeft + j * cellSize
        const y = gridTop + i * cellSize
        ctx.fillStyle = getCorrelationColor(val)
        ctx.fillRect(x, y, cellSize, cellSize)
        ctx.strokeStyle = 'rgba(200,200,200,0.3)'
        ctx.strokeRect(x, y, cellSize, cellSize)
        ctx.fillStyle = Math.abs(val) > 0.5 ? '#ffffff' : '#334155'
        ctx.font = valueFont
        ctx.textAlign = 'center'
        ctx.fillText(val.toFixed(2), x + cellSize / 2, y + cellSize / 2 + 4)
      })
    })

    ctx.font = labelFont
    ctx.fillStyle = '#64748b'
    ctx.textAlign = 'center'
    features.forEach((f, j) => {
      const x = gridLeft + j * cellSize + cellSize / 2
      const y = gridTop + gridHeight + 14
      const maxChars = Math.max(4, Math.floor(cellSize / 7))
      ctx.fillText(f.length > maxChars ? f.slice(0, maxChars - 1) + '…' : f, x, y)
    })

    const barLeft = gridLeft + gridWidth + barGap
    const barTop = gridTop
    const barHeight = gridHeight
    for (let py = 0; py < barHeight; py++) {
      const value = 1 - (py / barHeight) * 2
      ctx.fillStyle = getCorrelationColor(value)
      ctx.fillRect(barLeft, barTop + py, barWidth, 1)
    }
    ctx.strokeStyle = 'rgba(200,200,200,0.5)'
    ctx.strokeRect(barLeft, barTop, barWidth, barHeight)

    ctx.font = '10px Inter, sans-serif'
    ctx.fillStyle = '#64748b'
    ctx.textAlign = 'left'
    ;[1, 0.5, 0, -0.5, -1].forEach((v) => {
      const ty = barTop + ((1 - v) / 2) * barHeight
      ctx.fillText(v.toFixed(1), barLeft + barWidth + 4, ty + 3)
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Grid3x3 size={18} className="text-accent" />
        <h3 className="font-semibold text-sm">{t('correlationAnalysis', lang)}</h3>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 bg-surface border border-border rounded-lg p-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-text-muted">{t('method', lang)}:</label>
          <select value={method} onChange={(e) => setMethod(e.target.value as CorrelationMethod)}
            className="bg-bg border border-border rounded px-2 py-1 text-xs text-text">
            <option value="pearson">Pearson</option>
            <option value="spearman">Spearman</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-text-muted">{t('threshold', lang)}:</label>
          <select value={minCorrelation} onChange={(e) => setMinCorrelation(Number(e.target.value))}
            className="bg-bg border border-border rounded px-2 py-1 text-xs text-text">
            <option value={0.3}>0.3+</option>
            <option value={0.5}>0.5+</option>
            <option value={0.7}>0.7+</option>
            <option value={0.9}>0.9+</option>
          </select>
        </div>
        <button onClick={calculate} disabled={activeFeatures.length < 2}
          className="px-4 py-1.5 bg-accent hover:bg-accent-light disabled:opacity-40 text-white rounded-lg text-xs font-medium transition-all">
          {t('runAnalysis', lang)}
        </button>
        {result && (
          <>
            <button onClick={downloadCSV} className="flex items-center gap-1 px-3 py-1.5 border border-border text-text-muted hover:text-accent rounded-lg text-xs transition-all">
              <Download size={12} /> CSV
            </button>
            <button onClick={downloadHeatmapImage} className="flex items-center gap-1 px-3 py-1.5 border border-border text-text-muted hover:text-accent rounded-lg text-xs transition-all">
              <ImageDown size={12} /> PNG
            </button>
          </>
        )}
      </div>

      {/* Excluded columns */}
      {excludedColumns.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 bg-warning/10 border border-warning/30 rounded-lg p-3">
          <span className="text-xs text-warning font-medium">{t('excludedColumns', lang)}:</span>
          {excludedColumns.map((col) => (
            <span key={col} className="flex items-center gap-1 px-2 py-0.5 bg-warning/20 text-warning rounded text-xs">
              {col}
              <button onClick={() => restoreColumn(col)}><XIcon size={10} /></button>
            </span>
          ))}
          <button onClick={calculate}
            className="flex items-center gap-1 px-3 py-1 bg-accent text-white rounded text-xs font-medium ml-auto">
            <RefreshCw size={12} /> {t('reAnalyze', lang)}
          </button>
        </div>
      )}

      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Heatmap */}
          <div className="lg:col-span-2 bg-surface border border-border rounded-xl p-4 overflow-x-auto">
            <div className="flex items-center gap-4 text-xs text-text-muted mb-3">
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
                      {result.features[i].length > 8 ? result.features[i].slice(0, 8) + '…' : result.features[i]}
                    </td>
                    {row.map((val, j) => (
                      <td key={j}
                        className="p-2 text-center text-xs font-mono border border-border/30 cursor-pointer hover:ring-2 hover:ring-accent"
                        style={{ backgroundColor: getCorrelationColor(val), color: Math.abs(val) > 0.5 ? 'white' : undefined }}
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

          {/* High correlations list */}
          <div className="bg-surface border border-border rounded-xl p-4 space-y-2 max-h-[500px] overflow-y-auto">
            <h4 className="text-sm font-medium text-text-muted mb-2">
              {t('highCorrelations', lang)} (|r| ≥ {minCorrelation})
            </h4>
            {strongCorrelations.length > 0 ? (
              strongCorrelations.map((item, i) => (
                <div key={i} className="bg-bg rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium">{item.f1} ↔ {item.f2}</span>
                    <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded ${
                      Math.abs(item.corr) >= 0.7 ? 'bg-accent/20 text-accent' : 'bg-border text-text-muted'
                    }`}>
                      {item.corr.toFixed(3)}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => excludeColumn(item.f1)}
                      disabled={excludedColumns.includes(item.f1)}
                      className="flex-1 text-[10px] px-2 py-1 border border-border text-text-muted hover:text-danger hover:border-danger rounded disabled:opacity-30 transition-all">
                      {t('exclude', lang)} {item.f1}
                    </button>
                    <button onClick={() => excludeColumn(item.f2)}
                      disabled={excludedColumns.includes(item.f2)}
                      className="flex-1 text-[10px] px-2 py-1 border border-border text-text-muted hover:text-danger hover:border-danger rounded disabled:opacity-30 transition-all">
                      {t('exclude', lang)} {item.f2}
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-text-muted text-center py-4">{t('noCorrelations', lang)}</p>
            )}
          </div>
        </div>
      )}

      {/* Scatter plots for strong correlations */}
      {result && strongCorrelations.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-text-muted">{t('scatterMatrix', lang)}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {strongCorrelations.slice(0, 9).map((item) => {
              const MAX_POINTS = 500
              const step = Math.max(1, Math.floor(rawData.length / MAX_POINTS))
              const points: { x: number; y: number }[] = []
              for (let k = 0; k < rawData.length; k += step) {
                const xv = Number(rawData[k][item.f1])
                const yv = Number(rawData[k][item.f2])
                if (!isNaN(xv) && !isNaN(yv)) points.push({ x: xv, y: yv })
              }
              return (
                <ScatterChart
                  key={`${item.f1}-${item.f2}`}
                  datasets={[{
                    label: `${item.f1} vs ${item.f2}`,
                    data: points,
                    backgroundColor: theme === 'light'
                      ? (Math.abs(item.corr) >= 0.7 ? 'rgba(108, 99, 255, 0.7)' : 'rgba(30, 41, 59, 0.5)')
                      : (Math.abs(item.corr) >= 0.7 ? 'rgba(108, 99, 255, 0.5)' : 'rgba(148, 163, 184, 0.4)'),
                  }]}
                  xLabel={item.f1}
                  yLabel={item.f2}
                  title={`${item.f1} vs ${item.f2} (r = ${item.corr.toFixed(3)})`}
                />
              )
            })}
          </div>
        </div>
      )}

      {!result && (
        <div className="bg-surface border border-border rounded-xl p-12 text-center text-text-muted">
          <Grid3x3 size={40} className="mx-auto mb-3 opacity-30" />
          <p>{t('selectVarsPrompt', lang)}</p>
        </div>
      )}
    </div>
  )
}
