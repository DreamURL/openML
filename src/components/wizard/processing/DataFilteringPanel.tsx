import { useState, useMemo, useEffect, useCallback } from 'react'
import { useData } from '@/context/DataContext'
import { useWizard } from '@/context/WizardContext'
import { useLang } from '@/context/LangContext'
import { t } from '@/i18n/strings'
import { BarChart } from '@/components/charts/BarChart'
import {
  handleMissingValues, removeOutliers, applySmoothingFilter, scaleData, computeColumnStats,
  type MissingStrategy, type ScaleMethod, type FilterMethod, type OutlierMethod,
} from '@/utils/preprocessing'
import { SlidersHorizontal, Copy } from 'lucide-react'

interface ColumnPreprocessConfig {
  missing: MissingStrategy
  outlier: OutlierMethod
  outlierThreshold: number
  smoothing: FilterMethod
  smoothingWindow: number
  scale: ScaleMethod
}

const defaultConfig: ColumnPreprocessConfig = {
  missing: 'mean',
  outlier: 'none',
  outlierThreshold: 1.5,
  smoothing: 'none',
  smoothingWindow: 5,
  scale: 'none',
}

export function DataFilteringPanel() {
  const { rawData, numericalColumns } = useData()
  const { excludedColumns, processedData, setProcessedData } = useWizard()
  const { lang } = useLang()

  const [configs, setConfigs] = useState<Record<string, ColumnPreprocessConfig>>({})
  const [activeTab, setActiveTab] = useState<'summary' | 'comparison'>('summary')

  // Quick-set values for bulk apply
  const [bulkMissing, setBulkMissing] = useState<MissingStrategy>('mean')
  const [bulkOutlier, setBulkOutlier] = useState<OutlierMethod>('none')
  const [bulkSmoothing, setBulkSmoothing] = useState<FilterMethod>('none')
  const [bulkScale, setBulkScale] = useState<ScaleMethod>('none')

  const activeCols = useMemo(
    () => numericalColumns.filter((c) => !excludedColumns.includes(c)),
    [numericalColumns, excludedColumns],
  )

  // Initialize configs for new columns, preserve existing
  useEffect(() => {
    setConfigs((prev) => {
      const next = { ...prev }
      for (const col of activeCols) {
        if (!next[col]) next[col] = { ...defaultConfig }
      }
      return next
    })
  }, [activeCols])

  const originalStats = useMemo(() => {
    if (rawData.length === 0 || activeCols.length === 0) return null
    return computeColumnStats(rawData, activeCols)
  }, [rawData, activeCols])

  const updateConfig = useCallback((col: string, key: keyof ColumnPreprocessConfig, value: unknown) => {
    setConfigs((prev) => ({
      ...prev,
      [col]: { ...prev[col], [key]: value },
    }))
  }, [])

  const applyBulk = () => {
    setConfigs((prev) => {
      const next = { ...prev }
      for (const col of activeCols) {
        next[col] = {
          ...(next[col] || defaultConfig),
          missing: bulkMissing,
          outlier: bulkOutlier,
          outlierThreshold: next[col]?.outlierThreshold ?? 1.5,
          smoothing: bulkSmoothing,
          smoothingWindow: next[col]?.smoothingWindow ?? 5,
          scale: bulkScale,
        }
      }
      return next
    })
  }

  const handleProcess = () => {
    let data = [...rawData]

    // 1. Missing values — group by strategy, drop first
    const dropCols = activeCols.filter((c) => configs[c]?.missing === 'drop')
    if (dropCols.length > 0) data = handleMissingValues(data, dropCols, 'drop')
    for (const strategy of ['mean', 'median', 'zero', 'ffill'] as MissingStrategy[]) {
      const cols = activeCols.filter((c) => configs[c]?.missing === strategy)
      if (cols.length > 0) data = handleMissingValues(data, cols, strategy)
    }

    // 2. Outlier removal — per column
    for (const col of activeCols) {
      const cfg = configs[col]
      if (cfg?.outlier !== 'none') {
        data = removeOutliers(data, [col], cfg.outlier, cfg.outlierThreshold)
      }
    }

    // 3. Smoothing — per column
    for (const col of activeCols) {
      const cfg = configs[col]
      if (cfg?.smoothing !== 'none') {
        data = applySmoothingFilter(data, [col], cfg.smoothing, cfg.smoothingWindow)
      }
    }

    // 4. Scaling — per column
    for (const col of activeCols) {
      const cfg = configs[col]
      if (cfg?.scale !== 'none') {
        data = scaleData(data, [col], cfg.scale)
      }
    }

    setProcessedData(data)
  }

  const selectClass = 'bg-bg border border-border rounded px-1.5 py-1 text-xs text-text w-full'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <SlidersHorizontal size={18} className="text-accent" />
        <h3 className="font-semibold text-sm">{t('dataPreprocessing', lang)}</h3>
      </div>

      {/* Quick Set Bar */}
      <div className="bg-surface border border-border rounded-xl p-3">
        <div className="flex items-center gap-2 mb-2">
          <Copy size={14} className="text-accent" />
          <span className="text-xs font-semibold text-text-muted">{t('quickSet', lang)}</span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[120px]">
            <label className="text-[10px] text-text-muted">{t('missingValues', lang)}</label>
            <select value={bulkMissing} onChange={(e) => setBulkMissing(e.target.value as MissingStrategy)} className={selectClass}>
              <option value="mean">{t('fillMean', lang)}</option>
              <option value="median">{t('fillMedian', lang)}</option>
              <option value="zero">{t('fillZero', lang)}</option>
              <option value="ffill">{t('forwardFill', lang)}</option>
              <option value="drop">{t('dropRows', lang)}</option>
            </select>
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="text-[10px] text-text-muted">{t('outlierRemoval', lang)}</label>
            <select value={bulkOutlier} onChange={(e) => setBulkOutlier(e.target.value as OutlierMethod)} className={selectClass}>
              <option value="none">{t('none', lang)}</option>
              <option value="iqr">{t('iqrMethod', lang)}</option>
              <option value="zscore">{t('zscoreMethod', lang)}</option>
            </select>
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="text-[10px] text-text-muted">{t('smoothingFilter', lang)}</label>
            <select value={bulkSmoothing} onChange={(e) => setBulkSmoothing(e.target.value as FilterMethod)} className={selectClass}>
              <option value="none">{t('none', lang)}</option>
              <option value="moving_avg">{t('movingAverage', lang)}</option>
            </select>
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="text-[10px] text-text-muted">{t('scaling', lang)}</label>
            <select value={bulkScale} onChange={(e) => setBulkScale(e.target.value as ScaleMethod)} className={selectClass}>
              <option value="none">{t('none', lang)}</option>
              <option value="minmax">{t('minmax', lang)}</option>
              <option value="zscore">{t('zscoreStd', lang)}</option>
            </select>
          </div>
          <button onClick={applyBulk}
            className="px-3 py-1 bg-accent/20 hover:bg-accent/30 text-accent text-xs font-medium rounded-lg transition-all whitespace-nowrap">
            {t('applyToAll', lang)}
          </button>
        </div>
      </div>

      {/* Per-Column Config Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="px-3 py-2 text-left text-text-muted font-medium">{t('column', lang)}</th>
                <th className="px-2 py-2 text-right text-text-muted font-medium">{t('missing', lang)}</th>
                <th className="px-2 py-2 text-left text-text-muted font-medium">{t('missingValues', lang)}</th>
                <th className="px-2 py-2 text-left text-text-muted font-medium">{t('outlierRemoval', lang)}</th>
                <th className="px-2 py-2 text-left text-text-muted font-medium">{t('smoothingFilter', lang)}</th>
                <th className="px-2 py-2 text-left text-text-muted font-medium">{t('scaling', lang)}</th>
              </tr>
            </thead>
            <tbody>
              {activeCols.map((col) => {
                const cfg = configs[col] || defaultConfig
                const stats = originalStats?.[col]
                return (
                  <tr key={col} className="border-b border-border/30 hover:bg-surface-hover">
                    <td className="px-3 py-2 font-mono font-medium truncate max-w-[140px]" title={col}>{col}</td>
                    <td className="px-2 py-2 text-right">
                      <span className={stats && stats.missing > 0 ? 'text-warning font-semibold' : 'text-text-muted'}>
                        {stats?.missing ?? 0}
                      </span>
                    </td>
                    {/* Missing Values */}
                    <td className="px-2 py-2">
                      <select value={cfg.missing} onChange={(e) => updateConfig(col, 'missing', e.target.value)} className={selectClass}>
                        <option value="mean">{t('fillMean', lang)}</option>
                        <option value="median">{t('fillMedian', lang)}</option>
                        <option value="zero">{t('fillZero', lang)}</option>
                        <option value="ffill">{t('forwardFill', lang)}</option>
                        <option value="drop">{t('dropRows', lang)}</option>
                      </select>
                    </td>
                    {/* Outlier */}
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        <select value={cfg.outlier} onChange={(e) => updateConfig(col, 'outlier', e.target.value)}
                          className={`${selectClass} ${cfg.outlier !== 'none' ? 'flex-1' : 'w-full'}`}>
                          <option value="none">{t('none', lang)}</option>
                          <option value="iqr">IQR</option>
                          <option value="zscore">Z</option>
                        </select>
                        {cfg.outlier !== 'none' && (
                          <input type="number" value={cfg.outlierThreshold}
                            min={cfg.outlier === 'iqr' ? 1 : 1.5} max={cfg.outlier === 'iqr' ? 3 : 4} step={0.1}
                            onChange={(e) => updateConfig(col, 'outlierThreshold', Number(e.target.value))}
                            className="w-12 bg-bg border border-border rounded px-1 py-1 text-xs text-text text-center"
                            title={t('outlierThresholdLabel', lang)} />
                        )}
                      </div>
                    </td>
                    {/* Smoothing */}
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        <select value={cfg.smoothing} onChange={(e) => updateConfig(col, 'smoothing', e.target.value)}
                          className={`${selectClass} ${cfg.smoothing !== 'none' ? 'flex-1' : 'w-full'}`}>
                          <option value="none">{t('none', lang)}</option>
                          <option value="moving_avg">MA</option>
                        </select>
                        {cfg.smoothing !== 'none' && (
                          <input type="number" value={cfg.smoothingWindow}
                            min={3} max={21} step={2}
                            onChange={(e) => updateConfig(col, 'smoothingWindow', Number(e.target.value))}
                            className="w-10 bg-bg border border-border rounded px-1 py-1 text-xs text-text text-center"
                            title={t('smoothingWindowLabel', lang)} />
                        )}
                      </div>
                    </td>
                    {/* Scaling */}
                    <td className="px-2 py-2">
                      <select value={cfg.scale} onChange={(e) => updateConfig(col, 'scale', e.target.value)} className={selectClass}>
                        <option value="none">{t('none', lang)}</option>
                        <option value="minmax">MinMax</option>
                        <option value="zscore">Z-Score</option>
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Apply Button */}
      <div className="flex items-center gap-3">
        <button onClick={handleProcess}
          className="px-6 py-2 bg-accent hover:bg-accent-light text-white font-medium rounded-lg transition-all text-sm">
          {t('applyPreprocessing', lang)}
        </button>
        {processedData && (
          <p className="text-xs text-success">
            {t('processed', lang)}: {rawData.length} → {processedData.length} {t('rows', lang)}
          </p>
        )}
      </div>

      {/* Stats / Comparison Tabs */}
      <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
        {(['summary', 'comparison'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1.5 text-sm rounded-md transition-all ${
              activeTab === tab ? 'bg-accent text-white' : 'text-text-muted hover:text-accent'
            }`}>
            {tab === 'summary' ? t('summary', lang) : t('comparison', lang)}
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

      {activeTab === 'comparison' && originalStats && (
        <BarChart
          labels={Object.keys(originalStats)}
          data={Object.values(originalStats).map((s) => s.missing)}
          label={t('missingValues', lang)}
          title={t('missingValuesPerColumn', lang)}
          color="rgba(245, 158, 11, 0.7)"
        />
      )}
    </div>
  )
}
