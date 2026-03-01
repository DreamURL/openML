import { useState, useMemo } from 'react'
import { useData, type DataRow } from '@/context/DataContext'
import { useNavigate } from 'react-router-dom'
import { ColumnSelector } from '@/components/data/ColumnSelector'
import { BarChart } from '@/components/charts/BarChart'
import { SlidersHorizontal, Download, RotateCcw } from 'lucide-react'
import { useLang } from '@/context/LangContext'
import { t } from '@/i18n/strings'
import * as XLSX from 'xlsx'

type MissingStrategy = 'drop' | 'mean' | 'median' | 'zero' | 'ffill'
type ScaleMethod = 'none' | 'minmax' | 'zscore'
type FilterMethod = 'none' | 'moving_avg'
type OutlierMethod = 'none' | 'iqr' | 'zscore'

export function Preprocessing() {
  const { rawData, numericalColumns, columns, setDataset } = useData()
  const navigate = useNavigate()
  const { lang } = useLang()

  const [selectedCols, setSelectedCols] = useState<string[]>([])
  const [missingStrategy, setMissingStrategy] = useState<MissingStrategy>('mean')
  const [scaleMethod, setScaleMethod] = useState<ScaleMethod>('none')
  const [filterMethod, setFilterMethod] = useState<FilterMethod>('none')
  const [filterWindow, setFilterWindow] = useState(5)
  const [outlierMethod, setOutlierMethod] = useState<OutlierMethod>('none')
  const [outlierThreshold, setOutlierThreshold] = useState(1.5)
  const [processed, setProcessed] = useState<DataRow[] | null>(null)
  const [activeTab, setActiveTab] = useState<'summary' | 'preview' | 'comparison'>('summary')

  // Stats for original data
  const originalStats = useMemo(() => {
    if (rawData.length === 0) return null
    const cols = selectedCols.length > 0 ? selectedCols : numericalColumns
    const stats: Record<string, { missing: number; mean: number; std: number; min: number; max: number }> = {}
    for (const col of cols) {
      const vals: number[] = []
      let missing = 0
      for (const row of rawData) {
        const v = row[col]
        if (v === null || v === undefined || v === '' || (typeof v === 'number' && isNaN(v))) {
          missing++
        } else {
          vals.push(Number(v))
        }
      }
      const mean = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
      const std = vals.length > 0 ? Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length) : 0
      stats[col] = {
        missing,
        mean: +mean.toFixed(4),
        std: +std.toFixed(4),
        min: vals.length > 0 ? +Math.min(...vals).toFixed(4) : 0,
        max: vals.length > 0 ? +Math.max(...vals).toFixed(4) : 0,
      }
    }
    return stats
  }, [rawData, selectedCols, numericalColumns])

  const handleProcess = () => {
    const cols = selectedCols.length > 0 ? selectedCols : numericalColumns
    let data: DataRow[] = rawData.map((r) => ({ ...r }))

    // 1. Missing value handling
    if (missingStrategy === 'drop') {
      data = data.filter((row) => cols.every((c) => row[c] !== null && row[c] !== undefined && row[c] !== '' && !(typeof row[c] === 'number' && isNaN(row[c] as number))))
    } else {
      const colVals: Record<string, number[]> = {}
      for (const col of cols) {
        colVals[col] = []
        for (const row of data) {
          const v = row[col]
          if (v !== null && v !== undefined && v !== '' && !(typeof v === 'number' && isNaN(v as number))) {
            colVals[col].push(Number(v))
          }
        }
      }

      for (const col of cols) {
        const vals = colVals[col]
        let fillValue = 0
        if (missingStrategy === 'mean') {
          fillValue = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
        } else if (missingStrategy === 'median') {
          const sorted = [...vals].sort((a, b) => a - b)
          fillValue = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0
        }
        // zero: fillValue stays 0

        let lastVal = fillValue
        for (const row of data) {
          const v = row[col]
          if (v === null || v === undefined || v === '' || (typeof v === 'number' && isNaN(v as number))) {
            if (missingStrategy === 'ffill') {
              row[col] = lastVal
            } else {
              row[col] = +fillValue.toFixed(6)
            }
          } else {
            lastVal = Number(v)
          }
        }
      }
    }

    // 2. Outlier removal
    if (outlierMethod !== 'none') {
      for (const col of cols) {
        const vals = data.map((r) => Number(r[col])).filter((v) => !isNaN(v))
        if (vals.length === 0) continue

        if (outlierMethod === 'iqr') {
          const sorted = [...vals].sort((a, b) => a - b)
          const q1 = sorted[Math.floor(sorted.length * 0.25)]
          const q3 = sorted[Math.floor(sorted.length * 0.75)]
          const iqr = q3 - q1
          const lower = q1 - outlierThreshold * iqr
          const upper = q3 + outlierThreshold * iqr
          data = data.filter((r) => {
            const v = Number(r[col])
            return v >= lower && v <= upper
          })
        } else if (outlierMethod === 'zscore') {
          const mean = vals.reduce((a, b) => a + b, 0) / vals.length
          const std = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length) || 1e-10
          data = data.filter((r) => {
            const z = Math.abs((Number(r[col]) - mean) / std)
            return z <= outlierThreshold
          })
        }
      }
    }

    // 3. Smoothing filter
    if (filterMethod === 'moving_avg' && filterWindow > 1) {
      for (const col of cols) {
        const vals = data.map((r) => Number(r[col]))
        const smoothed = movingAverage(vals, filterWindow)
        data.forEach((row, i) => { row[col] = +smoothed[i].toFixed(6) })
      }
    }

    // 4. Scaling
    if (scaleMethod !== 'none') {
      for (const col of cols) {
        const vals = data.map((r) => Number(r[col]))
        if (vals.length === 0) continue

        if (scaleMethod === 'minmax') {
          const min = Math.min(...vals)
          const max = Math.max(...vals)
          const range = max - min || 1e-10
          data.forEach((row) => { row[col] = +((Number(row[col]) - min) / range).toFixed(6) })
        } else if (scaleMethod === 'zscore') {
          const mean = vals.reduce((a, b) => a + b, 0) / vals.length
          const std = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length) || 1e-10
          data.forEach((row) => { row[col] = +((Number(row[col]) - mean) / std).toFixed(6) })
        }
      }
    }

    setProcessed(data)
  }

  const applyToDataset = () => {
    if (processed) {
      setDataset(processed, '(preprocessed)')
      setProcessed(null)
    }
  }

  const downloadExcel = () => {
    const target = processed || rawData
    if (target.length === 0) return
    const ws = XLSX.utils.json_to_sheet(target)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Preprocessed')
    XLSX.writeFile(wb, 'preprocessed_data.xlsx')
  }

  if (rawData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <SlidersHorizontal size={48} className="text-text-muted mb-4" />
        <h2 className="text-xl font-semibold mb-2">{t('noDataset', lang)}</h2>
        <p className="text-text-muted mb-4">{t('noDatasetDesc', lang)}</p>
        <button onClick={() => navigate('/')} className="bg-accent hover:bg-accent-light text-white font-medium px-4 py-2 rounded-lg transition-all">
          {t('goToHome', lang)}
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h2 className="text-xl font-bold">
        <SlidersHorizontal size={20} className="inline mr-2 text-accent" />
        {t('dataPreprocessing', lang)}
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config */}
        <div className="space-y-4 bg-surface border border-border rounded-xl p-5">
          <h3 className="font-semibold text-sm">{t('configuration', lang)}</h3>

          <ColumnSelector
            columns={numericalColumns}
            selected={selectedCols}
            onChange={setSelectedCols}
            label={<>{t('columnsToProcess', lang)}<br /><span className="font-normal">{t('emptyAllNumeric', lang)}</span></>}
          />

          {/* Missing Values */}
          <div>
            <label className="text-sm font-medium text-text-muted">{t('missingValues', lang)}</label>
            <select value={missingStrategy} onChange={(e) => setMissingStrategy(e.target.value as MissingStrategy)}
              className="w-full mt-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text">
              <option value="mean">{t('fillMean', lang)}</option>
              <option value="median">{t('fillMedian', lang)}</option>
              <option value="zero">{t('fillZero', lang)}</option>
              <option value="ffill">{t('forwardFill', lang)}</option>
              <option value="drop">{t('dropRows', lang)}</option>
            </select>
          </div>

          {/* Outlier Removal */}
          <div>
            <label className="text-sm font-medium text-text-muted">{t('outlierRemoval', lang)}</label>
            <select value={outlierMethod} onChange={(e) => setOutlierMethod(e.target.value as OutlierMethod)}
              className="w-full mt-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text">
              <option value="none">{t('none', lang)}</option>
              <option value="iqr">{t('iqrMethod', lang)}</option>
              <option value="zscore">{t('zscoreMethod', lang)}</option>
            </select>
            {outlierMethod === 'iqr' && (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-text-muted leading-relaxed">
                  {t('iqrDesc', lang)}
                </p>
                <label className="text-xs text-text-muted">
                  Threshold: {outlierThreshold} ({t('iqrMultiplier', lang)})
                </label>
                <input type="range" min={1} max={3}
                  step={0.1} value={outlierThreshold}
                  onChange={(e) => setOutlierThreshold(Number(e.target.value))}
                  className="w-full accent-accent" />
              </div>
            )}
            {outlierMethod === 'zscore' && (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-text-muted leading-relaxed">
                  {t('zscoreDesc', lang)}
                </p>
                <label className="text-xs text-text-muted">
                  Threshold: {outlierThreshold} ({t('zscoreLimit', lang)})
                </label>
                <input type="range" min={1.5} max={4}
                  step={0.1} value={outlierThreshold}
                  onChange={(e) => setOutlierThreshold(Number(e.target.value))}
                  className="w-full accent-accent" />
              </div>
            )}
          </div>

          {/* Smoothing Filter */}
          <div>
            <label className="text-sm font-medium text-text-muted">{t('smoothingFilter', lang)}</label>
            <select value={filterMethod} onChange={(e) => setFilterMethod(e.target.value as FilterMethod)}
              className="w-full mt-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text">
              <option value="none">{t('none', lang)}</option>
              <option value="moving_avg">{t('movingAverage', lang)}</option>
            </select>
            {filterMethod === 'moving_avg' && (
              <div className="mt-2">
                <label className="text-xs text-text-muted">{t('windowSize', lang)}: {filterWindow}</label>
                <input type="range" min={3} max={21} step={2} value={filterWindow}
                  onChange={(e) => setFilterWindow(Number(e.target.value))}
                  className="w-full mt-1 accent-accent" />
              </div>
            )}
          </div>

          {/* Scaling */}
          <div>
            <label className="text-sm font-medium text-text-muted">{t('scaling', lang)}</label>
            <select value={scaleMethod} onChange={(e) => setScaleMethod(e.target.value as ScaleMethod)}
              className="w-full mt-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text">
              <option value="none">{t('none', lang)}</option>
              <option value="minmax">{t('minmax', lang)}</option>
              <option value="zscore">{t('zscoreStd', lang)}</option>
            </select>
          </div>

          <button onClick={handleProcess}
            className="w-full bg-accent hover:bg-accent-light text-white font-medium py-2 rounded-lg transition-all text-sm">
            {t('applyPreprocessing', lang)}
          </button>

          {processed && (
            <div className="space-y-2">
              <p className="text-xs text-success">
                {t('processed', lang)}: {rawData.length} → {processed.length} {t('rows', lang)}
              </p>
              <button onClick={applyToDataset}
                className="w-full flex items-center justify-center gap-2 bg-success/20 border border-success/30 text-success hover:bg-success/30 py-2 rounded-lg transition-all text-sm">
                <RotateCcw size={14} /> {t('applyToDataset', lang)}
              </button>
              <button onClick={downloadExcel}
                className="w-full flex items-center justify-center gap-2 border border-border text-text-muted hover:text-accent hover:border-accent py-2 rounded-lg transition-all text-sm">
                <Download size={14} /> {t('downloadExcel', lang)}
              </button>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
            {(['summary', 'preview', 'comparison'] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex-1 py-1.5 text-sm rounded-md transition-all ${
                  activeTab === tab ? 'bg-accent text-white' : 'text-text-muted hover:text-accent'
                }`}>
                {tab === 'summary' ? t('summary', lang) : tab === 'preview' ? t('preview', lang) : t('comparison', lang)}
              </button>
            ))}
          </div>

          {activeTab === 'summary' && originalStats && (
            <div className="bg-surface border border-border rounded-xl p-4">
              <h4 className="text-sm font-medium mb-3">{t('columnStats', lang)}</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 text-left text-text-muted">{t('column', lang)}</th>
                      <th className="px-3 py-2 text-right text-text-muted">{t('missing', lang)}</th>
                      <th className="px-3 py-2 text-right text-text-muted">{t('mean', lang)}</th>
                      <th className="px-3 py-2 text-right text-text-muted">{t('std', lang)}</th>
                      <th className="px-3 py-2 text-right text-text-muted">{t('min', lang)}</th>
                      <th className="px-3 py-2 text-right text-text-muted">{t('max', lang)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(originalStats).map(([col, s]) => (
                      <tr key={col} className="border-b border-border/30">
                        <td className="px-3 py-1.5 font-mono">{col}</td>
                        <td className="px-3 py-1.5 font-mono text-right">
                          <span className={s.missing > 0 ? 'text-warning' : ''}>{s.missing}</span>
                        </td>
                        <td className="px-3 py-1.5 font-mono text-right">{s.mean}</td>
                        <td className="px-3 py-1.5 font-mono text-right">{s.std}</td>
                        <td className="px-3 py-1.5 font-mono text-right">{s.min}</td>
                        <td className="px-3 py-1.5 font-mono text-right">{s.max}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="bg-surface border border-border rounded-xl p-4">
              <h4 className="text-sm font-medium mb-3">
                {processed ? t('processedPreview', lang) : t('originalPreview', lang)} ({t('firstRows', lang)})
              </h4>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-2 py-1.5 text-left text-text-muted">#</th>
                      {columns.slice(0, 10).map((c) => (
                        <th key={c} className="px-2 py-1.5 text-left text-text-muted truncate max-w-[100px]">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(processed || rawData).slice(0, 50).map((row, i) => (
                      <tr key={i} className="border-b border-border/20">
                        <td className="px-2 py-1 text-text-muted">{i + 1}</td>
                        {columns.slice(0, 10).map((c) => (
                          <td key={c} className="px-2 py-1 font-mono truncate max-w-[100px]">
                            {row[c] !== null && row[c] !== undefined ? String(row[c]) : <span className="text-warning">null</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'comparison' && originalStats && (
            <BarChart
              labels={Object.keys(originalStats)}
              data={Object.values(originalStats).map((s) => s.missing)}
              label={t('missingValues', lang)}
              title={t('missingValuesPerColumn', lang)}
              color="rgba(245, 158, 11, 0.7)"
            />
          )}

          {!originalStats && (
            <div className="bg-surface border border-border rounded-xl p-12 text-center text-text-muted">
              <SlidersHorizontal size={40} className="mx-auto mb-3 opacity-30" />
              <p>{t('configurePrompt', lang)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function movingAverage(data: number[], window: number): number[] {
  const result: number[] = []
  const half = Math.floor(window / 2)
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - half)
    const end = Math.min(data.length - 1, i + half)
    let sum = 0
    let count = 0
    for (let j = start; j <= end; j++) {
      sum += data[j]
      count++
    }
    result.push(sum / count)
  }
  return result
}
