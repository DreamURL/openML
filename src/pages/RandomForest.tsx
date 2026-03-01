import { useState, useRef } from 'react'
import { useData } from '@/context/DataContext'
import { useWorker } from '@/hooks/useWorker'
import { useModelIO } from '@/hooks/useModelIO'
import { useNavigate } from 'react-router-dom'
import { ColumnSelector } from '@/components/data/ColumnSelector'
import { TrainingProgress } from '@/components/ml/TrainingProgress'
import { BarChart } from '@/components/charts/BarChart'
import { LineChart } from '@/components/charts/LineChart'
import { TreePine, Download, Upload } from 'lucide-react'

interface RFResult {
  metrics: {
    trainAccuracy?: number
    testAccuracy?: number
    trainRMSE?: number
    testRMSE?: number
    type: 'classification' | 'regression'
  }
  featureImportance: { feature: string; importance: number }[]
  trainSize: number
  testSize: number
  numTrees: number
  maxDepth: number
  targetType: 'classification' | 'regression'
  uniqueClasses: number[] | null
  modelData: RFModelData
  trainActual: number[]
  trainPredicted: number[]
  testActual: number[]
  testPredicted: number[]
}

interface RFModelData {
  trees: RFTreeNode[]
  featureColumns: string[]
  targetColumn: string
  targetType: 'classification' | 'regression'
}

interface RFTreeNode {
  type: 'leaf' | 'decision'
  value?: number
  featureIndex?: number
  threshold?: number
  left?: RFTreeNode
  right?: RFTreeNode
}

const BASE = import.meta.env.BASE_URL

function predictOneTree(tree: RFTreeNode, x: number[]): number {
  if (tree.type === 'leaf') return tree.value!
  return x[tree.featureIndex!] <= tree.threshold! ? predictOneTree(tree.left!, x) : predictOneTree(tree.right!, x)
}

function predictForestLocal(model: RFModelData, row: Record<string, unknown>): number {
  const x = model.featureColumns.map((f) => {
    const v = row[f]
    return typeof v === 'number' ? v : parseFloat(String(v)) || 0
  })
  const votes = model.trees.map((t) => predictOneTree(t, x))
  if (model.targetType === 'classification') {
    const counts: Record<number, number> = {}
    for (const v of votes) counts[v] = (counts[v] || 0) + 1
    let maxC = 0, best = votes[0]
    for (const [v, c] of Object.entries(counts)) {
      if (c > maxC) { maxC = c; best = Number(v) }
    }
    return best
  }
  return votes.reduce((a, b) => a + b, 0) / votes.length
}

export function RandomForest() {
  const { rawData, numericalColumns, columns } = useData()
  const navigate = useNavigate()
  const { saveModel, loadModel } = useModelIO()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [featureCols, setFeatureCols] = useState<string[]>([])
  const [targetCol, setTargetCol] = useState('')
  const [testSize, setTestSize] = useState(0.2)
  const [numTrees, setNumTrees] = useState(50)
  const [maxDepth, setMaxDepth] = useState(10)
  const [targetType, setTargetType] = useState<'auto' | 'classification' | 'regression'>('auto')
  const [activeTab, setActiveTab] = useState<'predictions' | 'importance' | 'summary'>('predictions')

  const [uploadedModel, setUploadedModel] = useState<RFModelData | null>(null)
  const [predictions, setPredictions] = useState<{ index: number; predicted: number }[] | null>(null)

  const { run, progress, progressMessage, result, error, isRunning, cancel } =
    useWorker<RFResult>(`${BASE}workers/rf.worker.js`)

  const handleTrain = () => {
    if (featureCols.length < 1 || !targetCol) return
    run({
      type: 'RUN_RF',
      payload: { data: rawData, targetColumn: targetCol, featureColumns: featureCols, testSize, numTrees, maxDepth, targetType },
    })
  }

  const handleModelUpload = async (file: File) => {
    try {
      const model = (await loadModel(file)) as RFModelData
      if (!model.trees || !model.featureColumns) throw new Error('Invalid model')
      setUploadedModel(model)
      const preds = rawData.map((row, i) => ({
        index: i,
        predicted: +predictForestLocal(model, row).toFixed(4),
      }))
      setPredictions(preds)
    } catch {
      setPredictions(null)
      setUploadedModel(null)
    }
  }

  if (rawData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <TreePine size={48} className="text-text-muted mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Dataset Loaded</h2>
        <p className="text-text-muted mb-4">Upload a dataset first to use Random Forest.</p>
        <button onClick={() => navigate('/')} className="bg-accent hover:bg-accent-light text-white font-medium px-4 py-2 rounded-lg transition-all">Go to Home</button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h2 className="text-xl font-bold">
        <TreePine size={20} className="inline mr-2 text-accent" />
        Random Forest
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4 bg-surface border border-border rounded-xl p-5">
          <h3 className="font-semibold text-sm">Configuration</h3>

          <div>
            <label className="text-sm font-medium text-text-muted">Target Column</label>
            <select value={targetCol} onChange={(e) => setTargetCol(e.target.value)}
              className="w-full mt-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text">
              <option value="">Select target...</option>
              {columns.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <ColumnSelector columns={numericalColumns.filter((c) => c !== targetCol)} selected={featureCols} onChange={setFeatureCols} label="Feature Columns" />

          <div>
            <label className="text-sm font-medium text-text-muted">Target Type</label>
            <select value={targetType} onChange={(e) => setTargetType(e.target.value as 'auto' | 'classification' | 'regression')}
              className="w-full mt-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text">
              <option value="auto">Auto-detect</option>
              <option value="classification">Classification</option>
              <option value="regression">Regression</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-muted">Number of Trees</label>
              <input type="number" value={numTrees} step={10} min={10} max={500}
                onChange={(e) => setNumTrees(Number(e.target.value))}
                className="w-full bg-bg border border-border rounded px-2 py-1.5 text-xs text-text" />
            </div>
            <div>
              <label className="text-xs text-text-muted">Max Depth</label>
              <input type="number" value={maxDepth} step={1} min={2} max={30}
                onChange={(e) => setMaxDepth(Number(e.target.value))}
                className="w-full bg-bg border border-border rounded px-2 py-1.5 text-xs text-text" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-text-muted">Test Size: {(testSize * 100).toFixed(0)}%</label>
              <input type="range" value={testSize} step={0.05} min={0.1} max={0.5}
                onChange={(e) => setTestSize(Number(e.target.value))}
                className="w-full mt-1 accent-accent" />
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={handleTrain} disabled={isRunning || featureCols.length < 1 || !targetCol}
              className="flex-1 bg-accent hover:bg-accent-light disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-2 rounded-lg transition-all text-sm">
              {isRunning ? 'Training...' : 'Train Forest'}
            </button>
            {isRunning && (
              <button onClick={cancel} className="px-3 py-2 border border-danger text-danger rounded-lg text-sm hover:bg-danger/10">Cancel</button>
            )}
          </div>

          <TrainingProgress progress={progress} message={progressMessage} isRunning={isRunning} />
          {error && <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg px-3 py-2 text-xs">{error}</div>}

          {result && (
            <button onClick={() => saveModel(result.modelData, 'random_forest_model')}
              className="w-full flex items-center justify-center gap-2 border border-border text-text-muted hover:text-accent hover:border-accent py-2 rounded-lg transition-all text-sm">
              <Download size={14} /> Save Model
            </button>
          )}

          <div className="border-t border-border pt-4">
            <h3 className="font-semibold text-sm mb-2">Predict with Saved Model</h3>
            <input ref={fileInputRef} type="file" accept=".json" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleModelUpload(f) }} />
            <button onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 border border-border text-text-muted hover:text-accent hover:border-accent py-2 rounded-lg transition-all text-sm">
              <Upload size={14} /> Upload Model & Predict
            </button>
            {uploadedModel && (
              <p className="text-xs text-success mt-2">Model loaded: {uploadedModel.trees.length} trees, {predictions?.length} predictions</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {result && (
            <>
              {result.targetType === 'classification' ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Train Acc.', value: ((result.metrics.trainAccuracy ?? 0) * 100).toFixed(1) + '%' },
                    { label: 'Test Acc.', value: ((result.metrics.testAccuracy ?? 0) * 100).toFixed(1) + '%' },
                    { label: 'Trees', value: result.numTrees },
                    { label: 'Classes', value: result.uniqueClasses?.length ?? 0 },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-surface border border-border rounded-lg p-3">
                      <p className="text-xs text-text-muted">{label}</p>
                      <p className="text-lg font-semibold font-mono">{value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Train RMSE', value: result.metrics.trainRMSE?.toFixed(4) ?? '-' },
                    { label: 'Test RMSE', value: result.metrics.testRMSE?.toFixed(4) ?? '-' },
                    { label: 'Trees', value: result.numTrees },
                    { label: 'Max Depth', value: result.maxDepth },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-surface border border-border rounded-lg p-3">
                      <p className="text-xs text-text-muted">{label}</p>
                      <p className="text-lg font-semibold font-mono">{value}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
                {(['predictions', 'importance', 'summary'] as const).map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-1.5 text-sm rounded-md transition-all ${
                      activeTab === tab ? 'bg-accent text-white' : 'text-text-muted hover:text-accent'
                    }`}>
                    {tab === 'predictions' ? 'Actual vs Pred' : tab === 'importance' ? 'Feature Importance' : 'Summary'}
                  </button>
                ))}
              </div>

              {activeTab === 'predictions' && (
                <div className="space-y-4">
                  <LineChart
                    labels={result.trainActual.map((_, i) => `${i + 1}`)}
                    datasets={[
                      { label: 'Actual', data: result.trainActual, borderColor: 'rgba(108, 99, 255, 1)', pointRadius: 0 },
                      { label: 'Predicted', data: result.trainPredicted, borderColor: 'rgba(34, 197, 94, 1)', borderDash: [4, 4], pointRadius: 0 },
                    ]}
                    title={`Training Set (${result.trainSize} samples)`}
                    xLabel="Sample" yLabel="Value"
                  />
                  <LineChart
                    labels={result.testActual.map((_, i) => `${i + 1}`)}
                    datasets={[
                      { label: 'Actual', data: result.testActual, borderColor: 'rgba(108, 99, 255, 1)', pointRadius: 0 },
                      { label: 'Predicted', data: result.testPredicted, borderColor: 'rgba(239, 68, 68, 1)', borderDash: [4, 4], pointRadius: 0 },
                    ]}
                    title={`Validation Set (${result.testSize} samples)`}
                    xLabel="Sample" yLabel="Value"
                  />
                </div>
              )}

              {activeTab === 'importance' && (
                <BarChart
                  labels={result.featureImportance.map((f) => f.feature)}
                  data={result.featureImportance.map((f) => +(f.importance * 100).toFixed(1))}
                  label="Importance %" title="Feature Importance (Split Frequency)" horizontal
                />
              )}

              {activeTab === 'summary' && (
                <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
                  <h4 className="text-sm font-medium">Model Summary</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><p className="text-text-muted text-xs">Task Type</p><p className="font-mono capitalize">{result.targetType}</p></div>
                    <div><p className="text-text-muted text-xs">Number of Trees</p><p className="font-mono">{result.numTrees}</p></div>
                    <div><p className="text-text-muted text-xs">Max Depth</p><p className="font-mono">{result.maxDepth}</p></div>
                    <div><p className="text-text-muted text-xs">Train / Test</p><p className="font-mono">{result.trainSize} / {result.testSize}</p></div>
                    {result.uniqueClasses && (
                      <div className="col-span-2"><p className="text-text-muted text-xs">Classes</p><p className="font-mono">{result.uniqueClasses.join(', ')}</p></div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {predictions && !result && (
            <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
              <h4 className="text-sm font-medium">Model Predictions ({predictions.length} rows) — {uploadedModel?.targetType}</h4>
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-3 py-1.5 text-left text-text-muted">Index</th>
                      <th className="px-3 py-1.5 text-left text-text-muted">Predicted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {predictions.slice(0, 100).map((p) => (
                      <tr key={p.index} className="border-b border-border/20">
                        <td className="px-3 py-1 font-mono">{p.index + 1}</td>
                        <td className="px-3 py-1 font-mono">{p.predicted}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!result && !isRunning && !predictions && (
            <div className="bg-surface border border-border rounded-xl p-12 text-center text-text-muted">
              <TreePine size={40} className="mx-auto mb-3 opacity-30" />
              <p>Select target and features, then click "Train Forest"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
