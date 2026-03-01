import { useState, useMemo } from 'react'
import { useData } from '@/context/DataContext'
import { useWorker } from '@/hooks/useWorker'
import { useNavigate } from 'react-router-dom'
import { ColumnSelector } from '@/components/data/ColumnSelector'
import { TrainingProgress } from '@/components/ml/TrainingProgress'
import { ScatterChart, CHART_COLORS } from '@/components/charts/ScatterChart'
import { BarChart } from '@/components/charts/BarChart'
import { Layers, Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import { useLang } from '@/context/LangContext'
import { t } from '@/i18n/strings'

interface PCAResult {
  projectedData: number[][]
  explainedVariance: number[]
  eigenValues: number[]
  eigenVectors: number[][]
  tSquared: number[]
  features: string[]
  numComponents: number
  backend: string
}

const BASE = import.meta.env.BASE_URL

export function PCA() {
  const { rawData, numericalColumns } = useData()
  const navigate = useNavigate()
  const { lang } = useLang()

  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([])
  const [numComponents, setNumComponents] = useState(2)
  const [normalize, setNormalize] = useState(true)
  const [anomalyThreshold, setAnomalyThreshold] = useState(95)
  const [activeTab, setActiveTab] = useState<'projection' | 'variance' | 'anomaly'>('projection')

  const { run, progress, progressMessage, result, error, isRunning, cancel } =
    useWorker<PCAResult>(`${BASE}workers/pca.worker.js`)

  const handleRun = () => {
    if (selectedFeatures.length < 2) return
    const comps = Math.min(numComponents, selectedFeatures.length)
    run({
      type: 'RUN_PCA',
      payload: { data: rawData, features: selectedFeatures, components: comps, normalize },
    })
  }

  // Anomaly detection: T-squared threshold at given percentile
  const anomalyData = useMemo(() => {
    if (!result) return null
    const sorted = [...result.tSquared].sort((a, b) => a - b)
    const idx = Math.floor((anomalyThreshold / 100) * sorted.length)
    const threshold = sorted[Math.min(idx, sorted.length - 1)]
    const anomalies = result.tSquared.map((t, i) => ({ index: i, tSquared: t, isAnomaly: t > threshold }))
    const anomalyCount = anomalies.filter((a) => a.isAnomaly).length
    return { threshold, anomalies, anomalyCount }
  }, [result, anomalyThreshold])

  const projectionDatasets = useMemo(() => {
    if (!result || result.projectedData[0].length < 2) return []
    if (!anomalyData) return []

    const normal: { x: number; y: number }[] = []
    const anomalous: { x: number; y: number }[] = []

    result.projectedData.forEach((row, i) => {
      const point = { x: row[0], y: row[1] }
      if (anomalyData.anomalies[i].isAnomaly) {
        anomalous.push(point)
      } else {
        normal.push(point)
      }
    })

    return [
      { label: 'Normal', data: normal.slice(0, 2000), backgroundColor: CHART_COLORS[0] },
      { label: 'Anomaly', data: anomalous.slice(0, 500), backgroundColor: 'rgba(239, 68, 68, 0.8)' },
    ]
  }, [result, anomalyData])

  if (rawData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <Layers size={48} className="text-text-muted mb-4" />
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
        <Layers size={20} className="inline mr-2 text-accent" />
        {t('pcaAnomalyTitle', lang)}
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config */}
        <div className="space-y-5 bg-surface border border-border rounded-xl p-5">
          <h3 className="font-semibold text-sm">{t('configuration', lang)}</h3>

          <ColumnSelector
            columns={numericalColumns}
            selected={selectedFeatures}
            onChange={setSelectedFeatures}
            label={t('featureColumns', lang)}
          />

          <div>
            <label className="text-sm font-medium text-text-muted">
              {t('components', lang)}: {numComponents}
            </label>
            <input
              type="range"
              min={2}
              max={Math.max(2, Math.min(10, selectedFeatures.length))}
              value={numComponents}
              onChange={(e) => setNumComponents(Number(e.target.value))}
              className="w-full mt-1 accent-accent"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={normalize} onChange={(e) => setNormalize(e.target.checked)} className="accent-accent" />
            {t('standardizeData', lang)}
          </label>

          <div className="flex gap-2">
            <button
              onClick={handleRun}
              disabled={isRunning || selectedFeatures.length < 2}
              className="flex-1 bg-accent hover:bg-accent-light disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-2 rounded-lg transition-all text-sm"
            >
              {isRunning ? t('running', lang) : t('runPCA', lang)}
            </button>
            {isRunning && (
              <button onClick={cancel} className="px-3 py-2 border border-danger text-danger rounded-lg text-sm hover:bg-danger/10">
                {t('cancel', lang)}
              </button>
            )}
          </div>

          {selectedFeatures.length < 2 && selectedFeatures.length > 0 && (
            <p className="text-xs text-warning">{t('selectAtLeast2', lang)}</p>
          )}

          <TrainingProgress progress={progress} message={progressMessage} isRunning={isRunning} />

          {error && (
            <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg px-3 py-2 text-xs">{error}</div>
          )}

          {result && (
            <>
              <div>
                <label className="text-sm font-medium text-text-muted">
                  {t('anomalyThreshold', lang)}: {anomalyThreshold}{t('anomalyPercentile', lang)}
                </label>
                <input
                  type="range"
                  min={90}
                  max={99}
                  value={anomalyThreshold}
                  onChange={(e) => setAnomalyThreshold(Number(e.target.value))}
                  className="w-full mt-1 accent-accent"
                />
              </div>
              <button
                onClick={() => {
                  const sorted = [...result.tSquared].sort((a, b) => a - b)
                  const thIdx = Math.floor((anomalyThreshold / 100) * sorted.length)
                  const threshold = sorted[Math.min(thIdx, sorted.length - 1)]
                  const rows = rawData.map((row, i) => {
                    const pcCols: Record<string, number> = {}
                    result.projectedData[i]?.forEach((v, j) => { pcCols[`PC${j + 1}`] = +v.toFixed(6) })
                    return {
                      ...row,
                      ...pcCols,
                      T_Squared: result.tSquared[i] !== undefined ? +result.tSquared[i].toFixed(6) : '',
                      Is_Anomaly: result.tSquared[i] > threshold ? 'Yes' : 'No',
                    }
                  })
                  const ws = XLSX.utils.json_to_sheet(rows)
                  const wb = XLSX.utils.book_new()
                  XLSX.utils.book_append_sheet(wb, ws, 'PCA')
                  XLSX.writeFile(wb, 'pca_results.xlsx')
                }}
                className="w-full flex items-center justify-center gap-2 border border-border text-text-muted hover:text-accent hover:border-accent py-2 rounded-lg transition-all text-sm"
              >
                <Download size={14} /> {t('downloadPCAExcel', lang)}
              </button>
            </>
          )}
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-4">
          {result && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: t('components', lang), value: result.numComponents },
                  { label: t('totalVar', lang), value: (result.explainedVariance.reduce((a, b) => a + b, 0) * 100).toFixed(1) + '%' },
                  { label: t('anomalies', lang), value: anomalyData?.anomalyCount ?? 0 },
                  { label: t('backend', lang), value: result.backend },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-surface border border-border rounded-lg p-3">
                    <p className="text-xs text-text-muted">{label}</p>
                    <p className="text-lg font-semibold font-mono">{value}</p>
                  </div>
                ))}
              </div>

              {/* Tabs */}
              <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
                {(['projection', 'variance', 'anomaly'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-1.5 text-sm rounded-md transition-all capitalize ${
                      activeTab === tab ? 'bg-accent text-white' : 'text-text-muted hover:text-accent'
                    }`}
                  >
                    {tab === 'projection' && t('projection', lang)}
                    {tab === 'variance' && t('varianceExplained', lang)}
                    {tab === 'anomaly' && t('anomalyDetection', lang)}
                  </button>
                ))}
              </div>

              {activeTab === 'projection' && (
                <ScatterChart
                  datasets={projectionDatasets}
                  xLabel="PC1"
                  yLabel="PC2"
                  title={t('pcaProjectionTitle', lang)}
                />
              )}

              {activeTab === 'variance' && (
                <BarChart
                  labels={result.explainedVariance.map((_, i) => `PC${i + 1}`)}
                  data={result.explainedVariance.map((v) => +(v * 100).toFixed(2))}
                  label="Variance %"
                  title={t('explainedVarianceTitle', lang)}
                />
              )}

              {activeTab === 'anomaly' && anomalyData && (
                <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
                  <h4 className="text-sm font-medium">
                    {t('anomalyDetection', lang)} (T-squared &gt; {anomalyData.threshold.toFixed(2)})
                  </h4>
                  <p className="text-xs text-text-muted">
                    {anomalyData.anomalyCount} {t('anomaliesDetectedMsg', lang)} {result.tSquared.length} data points
                    ({((anomalyData.anomalyCount / result.tSquared.length) * 100).toFixed(1)}%)
                  </p>
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="px-3 py-1.5 text-left text-text-muted">{t('index', lang)}</th>
                          <th className="px-3 py-1.5 text-left text-text-muted">T-squared</th>
                          <th className="px-3 py-1.5 text-left text-text-muted">{t('status', lang)}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {anomalyData.anomalies
                          .filter((a) => a.isAnomaly)
                          .slice(0, 50)
                          .map((a) => (
                            <tr key={a.index} className="border-b border-border/30">
                              <td className="px-3 py-1 font-mono">{a.index}</td>
                              <td className="px-3 py-1 font-mono">{a.tSquared.toFixed(4)}</td>
                              <td className="px-3 py-1">
                                <span className="text-danger text-xs">{t('anomalies', lang)}</span>
                              </td>
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
              <Layers size={40} className="mx-auto mb-3 opacity-30" />
              <p>{t('configurePCAPrompt', lang)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
