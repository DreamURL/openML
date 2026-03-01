import { useState, useRef } from 'react'
import { useData } from '@/context/DataContext'
import { useWorker } from '@/hooks/useWorker'
import { useModelIO } from '@/hooks/useModelIO'
import { useNavigate } from 'react-router-dom'
import { ColumnSelector } from '@/components/data/ColumnSelector'
import { TrainingProgress } from '@/components/ml/TrainingProgress'
import { BarChart } from '@/components/charts/BarChart'
import { LineChart } from '@/components/charts/LineChart'
import { Binary, Download, Upload } from 'lucide-react'
import { useLang } from '@/context/LangContext'
import { t } from '@/i18n/strings'

interface LogisticResult {
  metrics: { accuracy: number; precision: number; recall: number; f1: number; trainAccuracy: number }
  confusionMatrix: { tp: number; fp: number; fn: number; tn: number }
  coefficients: { feature: string; coefficient: number; absCoeff: number }[]
  lossHistory: number[]
  accHistory: number[]
  classLabels: (string | number)[]
  trainSize: number
  testSize: number
  modelData: LogisticModelData
  backend: string
  trainActual: number[]
  trainPredicted: number[]
  testActual: number[]
  testPredicted: number[]
}

interface LogisticModelData {
  weights: number[][]
  bias: number[]
  means: number[] | null
  stds: number[] | null
  classMap: Record<string, number>
  featureColumns: string[]
  targetColumn: string
  normalize: boolean
}

const BASE = import.meta.env.BASE_URL

function predictWithModel(model: LogisticModelData, row: Record<string, unknown>): number {
  const features = model.featureColumns.map((f) => {
    const v = row[f]
    return typeof v === 'number' ? v : parseFloat(String(v)) || 0
  })
  if (model.normalize && model.means && model.stds) {
    for (let i = 0; i < features.length; i++) {
      features[i] = (features[i] - model.means[i]) / (model.stds[i] || 1e-10)
    }
  }
  let z = model.bias[0]
  for (let i = 0; i < features.length; i++) {
    z += model.weights[i][0] * features[i]
  }
  return 1 / (1 + Math.exp(-z))
}

export function LogisticRegression() {
  const { rawData, numericalColumns, columns } = useData()
  const navigate = useNavigate()
  const { lang } = useLang()
  const { saveModel, loadModel } = useModelIO()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [featureCols, setFeatureCols] = useState<string[]>([])
  const [targetCol, setTargetCol] = useState('')
  const [testSize, setTestSize] = useState(0.2)
  const [learningRate, setLearningRate] = useState(0.01)
  const [epochs, setEpochs] = useState(50)
  const [l2Strength, setL2Strength] = useState(0.01)
  const [normalizeData, setNormalizeData] = useState(true)
  const [activeTab, setActiveTab] = useState<'metrics' | 'predictions' | 'coefficients' | 'confusion'>('metrics')

  const [uploadedModel, setUploadedModel] = useState<LogisticModelData | null>(null)
  const [predictions, setPredictions] = useState<{ index: number; probability: number; predicted: number }[] | null>(null)

  const { run, progress, progressMessage, result, error, isRunning, cancel } =
    useWorker<LogisticResult>(`${BASE}workers/logistic.worker.js`)

  const handleTrain = () => {
    if (featureCols.length < 1 || !targetCol) return
    run({
      type: 'RUN_LOGISTIC',
      payload: { data: rawData, targetColumn: targetCol, featureColumns: featureCols, testSize, learningRate, epochs, l2Strength, normalize: normalizeData },
    })
  }

  const handleModelUpload = async (file: File) => {
    try {
      const model = (await loadModel(file)) as LogisticModelData
      if (!model.weights || !model.featureColumns) throw new Error('Invalid model')
      setUploadedModel(model)
      const preds = rawData.map((row, i) => {
        const prob = predictWithModel(model, row)
        return { index: i, probability: +prob.toFixed(4), predicted: prob >= 0.5 ? 1 : 0 }
      })
      setPredictions(preds)
    } catch {
      setPredictions(null)
      setUploadedModel(null)
    }
  }

  if (rawData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <Binary size={48} className="text-text-muted mb-4" />
        <h2 className="text-xl font-semibold mb-2">{t('noDataset', lang)}</h2>
        <p className="text-text-muted mb-4">{t('noDatasetDesc', lang)}</p>
        <button onClick={() => navigate('/')} className="bg-accent hover:bg-accent-light text-white font-medium px-4 py-2 rounded-lg transition-all">{t('goToHome', lang)}</button>
      </div>
    )
  }

  const reverseClassMap = uploadedModel ? Object.fromEntries(Object.entries(uploadedModel.classMap).map(([k, v]) => [v, k])) : null

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h2 className="text-xl font-bold">
        <Binary size={20} className="inline mr-2 text-accent" />
        {t('logisticName', lang)}
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4 bg-surface border border-border rounded-xl p-5">
          <h3 className="font-semibold text-sm">{t('configuration', lang)}</h3>

          <div>
            <label className="text-sm font-medium text-text-muted">{t('targetColumnBinary', lang)}</label>
            <select value={targetCol} onChange={(e) => setTargetCol(e.target.value)}
              className="w-full mt-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text">
              <option value="">{t('selectTarget', lang)}</option>
              {columns.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <ColumnSelector columns={numericalColumns.filter((c) => c !== targetCol)} selected={featureCols} onChange={setFeatureCols} label={t('featureColumns', lang)} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-muted">{t('learningRate', lang)}</label>
              <input type="number" value={learningRate} step={0.001} min={0.0001} max={1}
                onChange={(e) => setLearningRate(Number(e.target.value))}
                className="w-full bg-bg border border-border rounded px-2 py-1.5 text-xs text-text" />
            </div>
            <div>
              <label className="text-xs text-text-muted">{t('epochs', lang)}</label>
              <input type="number" value={epochs} step={10} min={10} max={500}
                onChange={(e) => setEpochs(Number(e.target.value))}
                className="w-full bg-bg border border-border rounded px-2 py-1.5 text-xs text-text" />
            </div>
            <div>
              <label className="text-xs text-text-muted">{t('testSize', lang)}</label>
              <input type="number" value={testSize} step={0.05} min={0.1} max={0.5}
                onChange={(e) => setTestSize(Number(e.target.value))}
                className="w-full bg-bg border border-border rounded px-2 py-1.5 text-xs text-text" />
            </div>
            <div>
              <label className="text-xs text-text-muted">{t('l2Regularization', lang)}</label>
              <input type="number" value={l2Strength} step={0.001} min={0} max={1}
                onChange={(e) => setL2Strength(Number(e.target.value))}
                className="w-full bg-bg border border-border rounded px-2 py-1.5 text-xs text-text" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={normalizeData} onChange={(e) => setNormalizeData(e.target.checked)} className="accent-accent" />
            {t('normalizeFeatures', lang)}
          </label>

          <div className="flex gap-2">
            <button onClick={handleTrain} disabled={isRunning || featureCols.length < 1 || !targetCol}
              className="flex-1 bg-accent hover:bg-accent-light disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-2 rounded-lg transition-all text-sm">
              {isRunning ? t('training', lang) : t('trainModel', lang)}
            </button>
            {isRunning && (
              <button onClick={cancel} className="px-3 py-2 border border-danger text-danger rounded-lg text-sm hover:bg-danger/10">{t('cancel', lang)}</button>
            )}
          </div>

          <TrainingProgress progress={progress} message={progressMessage} isRunning={isRunning} />
          {error && <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg px-3 py-2 text-xs">{error}</div>}

          {result && (
            <button onClick={() => saveModel(result.modelData, 'logistic_regression_model')}
              className="w-full flex items-center justify-center gap-2 border border-border text-text-muted hover:text-accent hover:border-accent py-2 rounded-lg transition-all text-sm">
              <Download size={14} /> {t('saveModel', lang)}
            </button>
          )}

          <div className="border-t border-border pt-4">
            <h3 className="font-semibold text-sm mb-2">{t('predictWithSavedModel', lang)}</h3>
            <input ref={fileInputRef} type="file" accept=".json" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleModelUpload(f) }} />
            <button onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 border border-border text-text-muted hover:text-accent hover:border-accent py-2 rounded-lg transition-all text-sm">
              <Upload size={14} /> {t('uploadModelPredict', lang)}
            </button>
            {uploadedModel && (
              <p className="text-xs text-success mt-2">{t('modelLoaded', lang)} {uploadedModel.featureColumns.length} features, {predictions?.length} predictions</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {result && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: t('accuracy', lang), value: (result.metrics.accuracy * 100).toFixed(1) + '%' },
                  { label: t('precision', lang), value: (result.metrics.precision * 100).toFixed(1) + '%' },
                  { label: t('recall', lang), value: (result.metrics.recall * 100).toFixed(1) + '%' },
                  { label: t('f1Score', lang), value: (result.metrics.f1 * 100).toFixed(1) + '%' },
                  { label: t('trainAcc', lang), value: (result.metrics.trainAccuracy * 100).toFixed(1) + '%' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-surface border border-border rounded-lg p-3">
                    <p className="text-xs text-text-muted">{label}</p>
                    <p className="text-lg font-semibold font-mono">{value}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
                {(['metrics', 'predictions', 'coefficients', 'confusion'] as const).map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-1.5 text-sm rounded-md transition-all ${
                      activeTab === tab ? 'bg-accent text-white' : 'text-text-muted hover:text-accent'
                    }`}>
                    {tab === 'predictions' ? t('actualVsPred', lang) : tab === 'metrics' ? t('metrics', lang) : tab === 'coefficients' ? t('coefficients', lang) : t('confusion', lang)}
                  </button>
                ))}
              </div>

              {activeTab === 'metrics' && (
                <BarChart labels={result.lossHistory.map((_, i) => `${i + 1}`)} data={result.lossHistory}
                  label="Loss" title={t('trainingLoss', lang)} color="rgba(239, 68, 68, 0.7)" />
              )}

              {activeTab === 'predictions' && (
                <div className="space-y-4">
                  <LineChart
                    labels={result.trainActual.map((_, i) => `${i + 1}`)}
                    datasets={[
                      { label: 'Actual', data: result.trainActual, borderColor: 'rgba(108, 99, 255, 1)', pointRadius: 0 },
                      { label: 'Predicted', data: result.trainPredicted, borderColor: 'rgba(34, 197, 94, 1)', borderDash: [4, 4], pointRadius: 0 },
                    ]}
                    title={`${t('trainingSet', lang)} (${result.trainSize} ${t('samples', lang)})`}
                    xLabel="Sample" yLabel="Class"
                  />
                  <LineChart
                    labels={result.testActual.map((_, i) => `${i + 1}`)}
                    datasets={[
                      { label: 'Actual', data: result.testActual, borderColor: 'rgba(108, 99, 255, 1)', pointRadius: 0 },
                      { label: 'Predicted', data: result.testPredicted, borderColor: 'rgba(239, 68, 68, 1)', borderDash: [4, 4], pointRadius: 0 },
                    ]}
                    title={`${t('validationSet', lang)} (${result.testSize} ${t('samples', lang)})`}
                    xLabel="Sample" yLabel="Class"
                  />
                </div>
              )}

              {activeTab === 'coefficients' && (
                <BarChart labels={result.coefficients.map((c) => c.feature)} data={result.coefficients.map((c) => c.coefficient)}
                  label="Coefficient" title={t('featureCoefficients', lang)} horizontal />
              )}

              {activeTab === 'confusion' && (
                <div className="bg-surface border border-border rounded-xl p-5">
                  <h4 className="text-sm font-medium mb-4">{t('confusionMatrix', lang)}</h4>
                  <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
                    {[
                      { label: t('truePositive', lang), value: result.confusionMatrix.tp, color: 'success' },
                      { label: t('falsePositive', lang), value: result.confusionMatrix.fp, color: 'danger' },
                      { label: t('falseNegative', lang), value: result.confusionMatrix.fn, color: 'danger' },
                      { label: t('trueNegative', lang), value: result.confusionMatrix.tn, color: 'success' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className={`bg-${color}/20 border border-${color}/30 rounded-lg p-4 text-center`}>
                        <p className="text-xs text-text-muted">{label}</p>
                        <p className={`text-2xl font-bold font-mono text-${color}`}>{value}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-text-muted text-center mt-3">
                    {t('classes', lang)}: {result.classLabels.join(' vs ')} · {t('testSet', lang)}: {result.testSize} samples
                  </p>
                </div>
              )}
            </>
          )}

          {predictions && !result && (
            <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
              <h4 className="text-sm font-medium">{t('modelPredictions', lang)} ({predictions.length} rows)</h4>
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-3 py-1.5 text-left text-text-muted">{t('index', lang)}</th>
                      <th className="px-3 py-1.5 text-left text-text-muted">{t('probability', lang)}</th>
                      <th className="px-3 py-1.5 text-left text-text-muted">{t('predicted', lang)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {predictions.slice(0, 100).map((p) => (
                      <tr key={p.index} className="border-b border-border/20">
                        <td className="px-3 py-1 font-mono">{p.index + 1}</td>
                        <td className="px-3 py-1 font-mono">{p.probability}</td>
                        <td className="px-3 py-1 font-mono">{reverseClassMap ? reverseClassMap[p.predicted] : p.predicted}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!result && !isRunning && !predictions && (
            <div className="bg-surface border border-border rounded-xl p-12 text-center text-text-muted">
              <Binary size={40} className="mx-auto mb-3 opacity-30" />
              <p>{t('configureTrainPrompt', lang)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
