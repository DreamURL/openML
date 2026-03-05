import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useData } from '@/context/DataContext'
import { useWizard, type ModelType } from '@/context/WizardContext'
import { useMultiWorker, type ModelTrainingConfig } from '@/hooks/useMultiWorker'
import { useLang } from '@/context/LangContext'
import { t, type StringKey, type Lang } from '@/i18n/strings'
import { useNavigate } from 'react-router-dom'
import { ModelComparisonChart } from '@/components/wizard/results/ModelComparisonChart'
import { RegressionDetail } from '@/components/wizard/results/RegressionDetail'
import { LogisticDetail } from '@/components/wizard/results/LogisticDetail'
import { RandomForestDetail } from '@/components/wizard/results/RandomForestDetail'
import { ANNDetail } from '@/components/wizard/results/ANNDetail'
import { XGBoostDetail } from '@/components/wizard/results/XGBoostDetail'
import {
  Brain, TrendingUp, Binary, TreePine, Cpu, Zap,
  ChevronDown, ChevronUp, Play, Square, AlertCircle, Settings,
} from 'lucide-react'
import { Head } from '@/components/seo/Head'

interface ModelOption {
  type: ModelType
  icon: typeof Brain
  nameKey: string
  descKey: string
  category: 'regression' | 'classification' | 'both' | 'unsupervised'
}

const MODEL_OPTIONS: ModelOption[] = [
  { type: 'multiple_regression', icon: TrendingUp, nameKey: 'multipleRegression', descKey: 'multipleRegressionDesc', category: 'regression' },
  { type: 'logistic', icon: Binary, nameKey: 'logisticName', descKey: 'logisticDesc', category: 'classification' },
  { type: 'random_forest', icon: TreePine, nameKey: 'forestName', descKey: 'forestDesc', category: 'both' },
  { type: 'ann', icon: Cpu, nameKey: 'annName', descKey: 'annDesc', category: 'both' },
  { type: 'xgboost', icon: Zap, nameKey: 'xgboostName', descKey: 'xgboostDesc', category: 'both' },
]

const defaultHyperparams: Record<ModelType, Record<string, unknown>> = {
  multiple_regression: { learningRate: 0.01, epochs: 100, normalize: true },
  logistic: { learningRate: 0.01, epochs: 50, l2Strength: 0.01, normalize: true },
  random_forest: { nTrees: 50, maxDepth: 10, targetType: 'auto' },
  ann: { learningRate: 0.001, epochs: 100, hiddenLayers: [64, 32], taskType: 'auto', normalize: true },
  xgboost: { nEstimators: 100, maxDepth: 6, learningRate: 0.1, subsample: 0.8, taskType: 'auto' },
  kmeans: { k: 3, maxIterations: 100 },
  pca: { nComponents: 2 },
}

/** Translate known worker progress messages to the current language */
function translateWorkerProgress(msg: string, lang: Lang): string {
  // Simple static messages
  const staticMap: Record<string, StringKey> = {
    'Preparing data...': 'workerPreparingData',
    'Building model...': 'workerBuildingModel',
    'Training...': 'workerTraining',
    'Evaluating...': 'workerEvaluating',
    'Evaluating model...': 'workerEvaluatingModel',
    'Computing metrics...': 'workerComputingMetrics',
    'Computing test metrics...': 'workerComputingTestMetrics',
    'Preprocessing data...': 'workerPreprocessingData',
    'Building neural network...': 'workerBuildingNeuralNetwork',
    'Training gradient boosted trees...': 'workerTrainingGradientBoosted',
    'Initializing centroids...': 'workerInitializingCentroids',
    'Computing results...': 'workerComputingResults',
    'Building cluster statistics...': 'workerBuildingClusterStats',
    'Complete': 'workerComplete',
    'Extracting features...': 'workerExtractingFeatures',
    'Computing mean and centering...': 'workerComputingMean',
    'Computing covariance matrix...': 'workerComputingCovariance',
    'Eigenvalue decomposition...': 'workerEigenDecomposition',
    'Projecting data...': 'workerProjectingData',
    'Computing anomaly scores...': 'workerComputingAnomalyScores',
  }
  if (staticMap[msg]) return t(staticMap[msg], lang)

  // TF.js backend: <name>
  const tfMatch = msg.match(/^TF\.js backend: (.+)$/)
  if (tfMatch) return t('workerTfBackend', lang).replace('{backend}', tfMatch[1])

  // Epoch 5/100 — Loss: 0.1234 Acc: 95.2%  or  Epoch 5/100 — Loss: 0.1234  or  Epoch 5/100 - loss: 0.1234 acc: 0.952
  const epochMatch = msg.match(/^Epoch (\d+)\/(\d+)/)
  if (epochMatch) {
    let result = `${t('workerEpoch', lang)} ${epochMatch[1]}/${epochMatch[2]}`
    const lossMatch = msg.match(/[Ll]oss:?\s*([\d.]+)/)
    if (lossMatch) result += ` — ${t('workerLoss', lang)}: ${lossMatch[1]}`
    const accMatch = msg.match(/[Aa]cc:?\s*([\d.]+%?)/)
    if (accMatch) result += ` ${t('workerAcc', lang)}: ${accMatch[1]}`
    return result
  }

  // Training 100 trees...
  const treesMatch = msg.match(/^Training (\d+) trees/)
  if (treesMatch) return t('workerTrainingTrees', lang).replace('{n}', treesMatch[1])

  // Building tree 5/100
  const buildTreeMatch = msg.match(/^Building tree (\d+)\/(\d+)/)
  if (buildTreeMatch) return t('workerBuildingTree', lang).replace('{current}', buildTreeMatch[1]).replace('{total}', buildTreeMatch[2])

  // Tree 5/100 — Loss: 0.1234
  const treeMatch = msg.match(/^Tree (\d+)\/(\d+)/)
  if (treeMatch) {
    let result = `${t('workerTree', lang)} ${treeMatch[1]}/${treeMatch[2]}`
    const lossMatch = msg.match(/Loss:\s*([\d.]+)/)
    if (lossMatch) result += ` — ${t('workerLoss', lang)}: ${lossMatch[1]}`
    return result
  }

  // Iteration 5/100
  const iterMatch = msg.match(/^Iteration (\d+)\/(\d+)/)
  if (iterMatch) return `${t('workerIteration', lang)} ${iterMatch[1]}/${iterMatch[2]}`

  return msg
}

/** Translate known worker error messages to the current language */
function translateWorkerError(error: string, lang: Lang): string {
  // Binary classification class count
  const binaryMatch = error.match(/Binary classification requires exactly 2 classes, found (\d+)/)
  if (binaryMatch) {
    return t('errorBinaryClassification', lang).replace('{count}', binaryMatch[1])
  }
  // Not enough valid rows
  if (error.includes('Not enough valid rows')) {
    return t('errorNotEnoughRows', lang)
  }
  // No valid data after filtering
  if (error.includes('No valid data after filtering')) {
    return t('errorNoValidData', lang)
  }
  return error
}

export function StepTraining() {
  const { rawData, numericalColumns } = useData()
  const { selectedModels, setSelectedModels, processedData, excludedColumns, targetColumn, hasExistingModel, uploadedModelData, setTrainingResult } = useWizard()
  const { lang } = useLang()
  const navigate = useNavigate()
  const { runAll, states, cancelAll, isAnyRunning } = useMultiWorker()

  const [hyperparams, setHyperparams] = useState<Record<ModelType, Record<string, unknown>>>(defaultHyperparams)
  const [sharedTestSize, setSharedTestSize] = useState(0.2)
  const [configModel, setConfigModel] = useState<ModelType | null>(null)
  const [detailModel, setDetailModel] = useState<ModelType | null>(null)

  const data = processedData || rawData
  const activeNumCols = useMemo(() => numericalColumns.filter((c) => !excludedColumns.includes(c) && c !== targetColumn), [numericalColumns, excludedColumns, targetColumn])

  const toggleModel = (model: ModelType) => {
    if (selectedModels.includes(model)) {
      setSelectedModels(selectedModels.filter((m) => m !== model))
    } else {
      setSelectedModels([...selectedModels, model])
    }
  }

  const updateHyperparam = (model: ModelType, key: string, value: unknown) => {
    setHyperparams((prev) => ({
      ...prev,
      [model]: { ...prev[model], [key]: value },
    }))
  }

  const handleTrain = useCallback(() => {
    if (selectedModels.length === 0 || !targetColumn) return

    const configs: ModelTrainingConfig[] = selectedModels.map((model) => ({
      modelType: model,
      payload: {
        data,
        targetColumn,
        featureColumns: activeNumCols,
        ...hyperparams[model],
        testSize: sharedTestSize,
      },
    }))

    runAll(configs)
  }, [selectedModels, targetColumn, data, activeNumCols, hyperparams, sharedTestSize, runAll])

  // Collect completed results for comparison
  const completedResults = useMemo(() => {
    const results = new Map<ModelType, { metrics: Record<string, number> }>()
    states.forEach((state, model) => {
      if (state.result && !state.isRunning) {
        results.set(model, state.result as { metrics: Record<string, number> })
      }
    })
    return results
  }, [states])

  // Sync completed results to WizardContext (separate from render)
  useEffect(() => {
    completedResults.forEach((_, model) => {
      const state = states.get(model)
      if (state?.result) setTrainingResult(model, state.result as any)
    })
  }, [completedResults, states, setTrainingResult])

  if (rawData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <AlertCircle size={48} className="text-text-muted mb-4" />
        <h2 className="text-xl font-semibold mb-2">{t('noDataset', lang)}</h2>
        <p className="text-text-muted mb-4">{t('noDatasetDesc', lang)}</p>
        <button onClick={() => navigate('/')} className="bg-accent hover:bg-accent-light text-white font-medium px-4 py-2 rounded-lg transition-all">
          {t('goToHome', lang)}
        </button>
      </div>
    )
  }

  // Flow B: Existing model — no model uploaded yet
  if (hasExistingModel && !uploadedModelData) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Brain size={20} className="text-accent" />
          {t('predictionResults', lang)}
        </h2>
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-sm text-warning">
          {t('uploadModelFirst', lang)}
        </div>
      </div>
    )
  }

  // Flow B: Existing model prediction with uploaded model
  if (hasExistingModel && uploadedModelData) {
    return <ExistingModelPrediction data={data} modelData={uploadedModelData as Record<string, any>} lang={lang} />
  }

  return (
    <>
    <Head titleKey="seoTrainingTitle" descriptionKey="seoTrainingDescription" />
    <div className="max-w-6xl mx-auto space-y-6">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Brain size={20} className="text-accent" />
        {t('modelTraining', lang)}
      </h2>

      {!targetColumn && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-sm text-warning">
          {t('selectTargetFirst', lang)}
        </div>
      )}

      {/* Model selection — 3-column layout: [toggle+models] | [hyperparams] */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-4">
        {/* Left: Toggle + Model list */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">{t('selectModels', lang)}</h3>
          {MODEL_OPTIONS.map(({ type, icon: Icon, nameKey, descKey }) => {
            const selected = selectedModels.includes(type)
            const state = states.get(type)
            return (
              <div key={type} className="flex items-center gap-3">
                {/* Toggle switch */}
                <button
                  onClick={() => toggleModel(type)}
                  className={`w-10 h-6 rounded-full relative transition-all shrink-0 ${
                    selected ? 'bg-accent' : 'bg-border'
                  }`}
                  aria-label={`Toggle ${type}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                    selected ? 'left-[18px]' : 'left-0.5'
                  }`} />
                </button>

                {/* Model card */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setConfigModel(configModel === type ? null : type)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setConfigModel(configModel === type ? null : type) } }}
                  className={`flex-1 min-w-0 text-left p-3 rounded-lg border-2 transition-all cursor-pointer ${
                    selected ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50'
                  } ${configModel === type ? 'ring-2 ring-accent/30' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={16} className={selected ? 'text-accent' : 'text-text-muted'} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{t(nameKey as any, lang)}</p>
                      <p className="text-xs text-text-muted truncate">{t(descKey as any, lang)}</p>
                    </div>
                    {state?.isRunning && <div className="w-2 h-2 rounded-full bg-accent animate-pulse shrink-0" />}
                    {state?.result && !state.isRunning && <div className="w-2 h-2 rounded-full bg-success shrink-0" />}
                    {state?.error && <div className="w-2 h-2 rounded-full bg-danger shrink-0" />}
                  </div>
                  {/* Progress */}
                  {state?.isRunning && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-text-muted mb-1">
                        <span>{translateWorkerProgress(state.progressMessage, lang)}</span>
                        <span>{state.progress}%</span>
                      </div>
                      <div className="h-1.5 bg-border rounded-full overflow-hidden">
                        <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${state.progress}%` }} />
                      </div>
                    </div>
                  )}
                  {state?.result && !state.isRunning && (
                    <div className="mt-1 text-xs text-success font-medium">{t('complete', lang)}</div>
                  )}
                  {state?.error && (
                    <div className="mt-1 text-xs text-danger">{translateWorkerError(state.error, lang)}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Right: Hyperparameter config (independent panel) */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Settings size={14} />
            {t('hyperparamSettings', lang)}
          </h3>
          <div className="bg-surface border border-border rounded-xl p-4 min-h-[200px] md:sticky md:top-4 space-y-4">
            {/* Shared test size — always visible */}
            <div>
              <label className="text-xs font-semibold text-text-muted">{t('commonSettings', lang)}</label>
              <div className="mt-1">
                <label className="text-xs text-text-muted">{t('testSize', lang)}</label>
                <input type="number" value={sharedTestSize} min={0.1} max={0.5} step={0.05}
                  onChange={(e) => setSharedTestSize(Number(e.target.value))}
                  className="w-full mt-0.5 bg-bg border border-border rounded px-2 py-1 text-xs text-text" />
              </div>
            </div>
            <div className="border-t border-border" />
            {/* Model-specific hyperparams */}
            {configModel ? (
              <div className="space-y-3">
                <div className="text-sm font-medium text-accent">
                  {t(MODEL_OPTIONS.find((m) => m.type === configModel)?.nameKey as any ?? configModel, lang)}
                </div>
                {renderHyperparams(configModel, hyperparams[configModel], (k, v) => updateHyperparam(configModel, k, v), lang)}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-text-muted py-8">
                {t('selectModelToConfig', lang)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Train / Cancel buttons */}
      <div className="flex gap-3">
        <button onClick={handleTrain}
          disabled={isAnyRunning || selectedModels.length === 0 || !targetColumn}
          className="flex items-center gap-2 px-6 py-2.5 bg-accent hover:bg-accent-light disabled:opacity-40 text-white font-medium rounded-lg transition-all">
          <Play size={16} />
          {isAnyRunning ? t('training', lang) : t('trainSelected', lang)}
        </button>
        {isAnyRunning && (
          <button onClick={cancelAll}
            className="flex items-center gap-2 px-4 py-2.5 border border-danger text-danger rounded-lg hover:bg-danger/10 transition-all">
            <Square size={16} /> {t('cancel', lang)}
          </button>
        )}
      </div>

      {/* Model Comparison */}
      {completedResults.size > 0 && (
        <div className="space-y-4">
          <ModelComparisonChart results={completedResults} />

          {/* Clickable results list */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">{t('clickForDetails', lang)}</h3>
            {Array.from(completedResults.entries()).map(([model]) => (
              <button
                key={model}
                onClick={() => setDetailModel(detailModel === model ? null : model)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  detailModel === model ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t(MODEL_OPTIONS.find((m) => m.type === model)?.nameKey as any ?? model, lang)}</span>
                  {detailModel === model ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </button>
            ))}
          </div>

          {/* Detail panel */}
          {detailModel && states.get(detailModel)?.result && (
            <div className="border border-accent/30 rounded-xl overflow-hidden">
              {detailModel === 'multiple_regression' && <RegressionDetail result={states.get(detailModel)!.result} modelData={states.get(detailModel)!.result?.modelData} />}
              {detailModel === 'logistic' && <LogisticDetail result={states.get(detailModel)!.result} modelData={states.get(detailModel)!.result?.modelData} />}
              {detailModel === 'random_forest' && <RandomForestDetail result={states.get(detailModel)!.result} modelData={states.get(detailModel)!.result?.modelData} />}
              {detailModel === 'ann' && <ANNDetail result={states.get(detailModel)!.result} modelData={states.get(detailModel)!.result?.modelData} />}
              {detailModel === 'xgboost' && <XGBoostDetail result={states.get(detailModel)!.result} modelData={states.get(detailModel)!.result?.modelData} />}
            </div>
          )}
        </div>
      )}
    </div>
    </>
  )
}

/* ─── Prediction with uploaded model ─── */

function predictWithModel(modelData: Record<string, any>, rows: Record<string, any>[]): { predicted: number[]; actual: (number | null)[]; featureCols: string[]; targetCol: string; modelType: string } {
  const modelType = modelData.type || (modelData.trees ? 'random_forest' : modelData.classMap && !modelData.trees ? 'logistic' : 'regression')
  const featureCols: string[] = modelData.featureColumns || []
  const targetCol: string = modelData.targetColumn || ''

  // Filter valid rows
  const validRows = rows.filter(r => featureCols.every(f => r[f] !== null && r[f] !== undefined && !isNaN(Number(r[f]))))
  if (validRows.length === 0) throw new Error('No valid rows for prediction')

  let X = validRows.map(r => featureCols.map(f => Number(r[f])))
  const actual = validRows.map(r => targetCol && r[targetCol] != null && !isNaN(Number(r[targetCol])) ? Number(r[targetCol]) : null)

  // Normalize if model has normalization params
  if (modelData.normalize && modelData.means && modelData.stds) {
    X = X.map(row => row.map((v, i) => (v - modelData.means[i]) / modelData.stds[i]))
  }

  let predicted: number[]

  if (modelType === 'regression') {
    const weights = modelData.weights // [[w1], [w2], ...] or [w1, w2, ...]
    const bias = modelData.bias // [b] or number
    const b = Array.isArray(bias) ? bias[0] : bias
    predicted = X.map(row => {
      let sum = b
      for (let i = 0; i < row.length; i++) {
        const w = Array.isArray(weights[i]) ? weights[i][0] : weights[i]
        sum += row[i] * w
      }
      return sum
    })
  } else if (modelType === 'logistic') {
    const weights = modelData.weights // [[w1], [w2], ...]
    const bias = modelData.bias // [b]
    const b = Array.isArray(bias) ? bias[0] : bias
    predicted = X.map(row => {
      let sum = b
      for (let i = 0; i < row.length; i++) {
        const w = Array.isArray(weights[i]) ? weights[i][0] : weights[i]
        sum += row[i] * w
      }
      return 1 / (1 + Math.exp(-sum)) >= 0.5 ? 1 : 0
    })
  } else if (modelType === 'random_forest' && modelData.trees) {
    const predictOne = (tree: any, x: number[]): number => {
      if (tree.type === 'leaf') return tree.value
      return x[tree.featureIndex] <= tree.threshold ? predictOne(tree.left, x) : predictOne(tree.right, x)
    }
    const targetType = modelData.targetType || 'regression'
    predicted = X.map(x => {
      const votes = modelData.trees.map((tree: any) => predictOne(tree, x))
      if (targetType === 'classification') {
        const counts: Record<number, number> = {}
        for (const v of votes) counts[v] = (counts[v] || 0) + 1
        let maxC = 0, best = votes[0]
        for (const [v, c] of Object.entries(counts)) {
          if ((c as number) > maxC) { maxC = c as number; best = Number(v) }
        }
        return best
      }
      return votes.reduce((a: number, b: number) => a + b, 0) / votes.length
    })
  } else if (modelType === 'xgboost' && modelData.trees) {
    const predictTree = (tree: any, x: number[]): number => {
      if (tree.value !== undefined) return tree.value
      return x[tree.feature] <= tree.threshold ? predictTree(tree.left, x) : predictTree(tree.right, x)
    }
    const lr = modelData.learningRate || 0.1
    const initValue = modelData.initValue || 0
    predicted = X.map(x => {
      let pred = initValue
      for (const tree of modelData.trees) pred += lr * predictTree(tree, x)
      if (modelData.isClassification) return 1 / (1 + Math.exp(-pred)) >= 0.5 ? 1 : 0
      return pred
    })
  } else if (modelType === 'ann' && modelData.weights) {
    // Forward pass through saved dense layers
    const relu = (v: number) => Math.max(0, v)
    const sigmoid = (v: number) => 1 / (1 + Math.exp(-v))
    const softmax = (arr: number[]) => {
      const maxV = Math.max(...arr)
      const exps = arr.map(v => Math.exp(v - maxV))
      const sum = exps.reduce((a, b) => a + b, 0)
      return exps.map(e => e / sum)
    }

    const layerWeights: { kernel: number[][]; bias: number[]; activation: string }[] = []
    const savedWeights: any[] = modelData.weights
    // Each layer has [kernel, bias]; architecture from layers config + output layer
    const hiddenLayers: number[] = modelData.layers || [64, 32]
    const numClasses = modelData.numClasses || (modelData.classMap ? Object.keys(modelData.classMap).length : 0)
    const isClassif = modelData.isClassification

    // Reconstruct layer configs: hidden (relu) + output
    for (let li = 0; li < savedWeights.length; li++) {
      const lw = savedWeights[li]
      if (lw.length < 2) continue // needs kernel + bias
      const kernelData = lw[0]
      const biasData = lw[1]
      // Reshape kernel from flat array to 2D: [inputSize, outputSize]
      const inputSize = kernelData.shape[0]
      const outputSize = kernelData.shape[1]
      const kernel: number[][] = []
      for (let r = 0; r < inputSize; r++) {
        kernel.push(kernelData.data.slice(r * outputSize, (r + 1) * outputSize))
      }
      const bias = biasData.data as number[]
      // Determine activation
      let activation = 'relu'
      if (li === savedWeights.length - 1) {
        // Output layer
        if (isClassif) activation = numClasses === 2 ? 'sigmoid' : 'softmax'
        else activation = 'linear'
      }
      layerWeights.push({ kernel, bias, activation })
    }

    predicted = X.map(x => {
      let current = x.slice()
      for (const layer of layerWeights) {
        const next: number[] = new Array(layer.bias.length).fill(0)
        for (let j = 0; j < next.length; j++) {
          let sum = layer.bias[j]
          for (let i = 0; i < current.length; i++) {
            sum += current[i] * layer.kernel[i][j]
          }
          next[j] = sum
        }
        // Apply activation
        if (layer.activation === 'relu') {
          for (let j = 0; j < next.length; j++) next[j] = relu(next[j])
        } else if (layer.activation === 'sigmoid') {
          for (let j = 0; j < next.length; j++) next[j] = sigmoid(next[j])
        } else if (layer.activation === 'softmax') {
          const sm = softmax(next)
          for (let j = 0; j < next.length; j++) next[j] = sm[j]
        }
        current = next
      }
      // Decode output
      if (isClassif) {
        if (current.length === 1) return current[0] >= 0.5 ? 1 : 0
        return current.indexOf(Math.max(...current))
      }
      return current[0]
    })
  } else {
    throw new Error('unsupported')
  }

  return { predicted, actual, featureCols, targetCol, modelType }
}

function ExistingModelPrediction({ data, modelData, lang }: { data: Record<string, any>[]; modelData: Record<string, any>; lang: 'en' | 'ko' }) {
  const [result, setResult] = useState<{ predicted: number[]; actual: (number | null)[]; featureCols: string[]; targetCol: string; modelType: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const res = predictWithModel(modelData, data)
      setResult(res)
      setError(null)
    } catch (e: any) {
      setError(e.message === 'unsupported' ? t('unsupportedModelType', lang) : e.message)
      setResult(null)
    }
  }, [modelData, data, lang])

  const modelType = modelData.type || (modelData.trees && modelData.learningRate != null ? 'xgboost' : modelData.trees ? 'random_forest' : modelData.classMap ? 'logistic' : 'regression')
  const modelLabel = MODEL_OPTIONS.find(m => m.type === modelType)?.nameKey

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Brain size={20} className="text-accent" />
        {t('predictionResults', lang)}
      </h2>

      {/* Model info */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-text-muted">{t('uploadedModelType', lang)}: </span>
            <span className="font-medium">{modelLabel ? t(modelLabel as any, lang) : modelType}</span>
          </div>
          <div>
            <span className="text-text-muted">{t('uploadedModelFeatures', lang)}: </span>
            <span className="font-medium">{(modelData.featureColumns || []).length}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-3 text-sm text-danger">
          {t('predictionError', lang)}: {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-surface border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3">{t('predictionSummary', lang)}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-bg rounded-lg p-3 text-center">
                <div className="text-xs text-text-muted">{t('totalSamples', lang)}</div>
                <div className="text-lg font-bold">{result.predicted.length}</div>
              </div>
              {result.actual.some(a => a !== null) && (
                <>
                  {result.modelType === 'regression' || result.modelType === 'xgboost' && !modelData.isClassification || result.modelType === 'random_forest' && modelData.targetType === 'regression' ? (() => {
                    const pairs = result.predicted.map((p, i) => ({ p, a: result.actual[i] })).filter(x => x.a !== null)
                    const rmse = Math.sqrt(pairs.reduce((s, { p, a }) => s + (p - a!) ** 2, 0) / pairs.length)
                    const mean = pairs.reduce((s, { a }) => s + a!, 0) / pairs.length
                    const ssTot = pairs.reduce((s, { a }) => s + (a! - mean) ** 2, 0)
                    const ssRes = pairs.reduce((s, { p, a }) => s + (p - a!) ** 2, 0)
                    const r2 = 1 - ssRes / (ssTot || 1e-10)
                    return (
                      <>
                        <div className="bg-bg rounded-lg p-3 text-center">
                          <div className="text-xs text-text-muted">RMSE</div>
                          <div className="text-lg font-bold">{rmse.toFixed(4)}</div>
                        </div>
                        <div className="bg-bg rounded-lg p-3 text-center">
                          <div className="text-xs text-text-muted">R²</div>
                          <div className="text-lg font-bold">{r2.toFixed(4)}</div>
                        </div>
                      </>
                    )
                  })() : (() => {
                    const pairs = result.predicted.map((p, i) => ({ p, a: result.actual[i] })).filter(x => x.a !== null)
                    const correct = pairs.filter(x => x.p === x.a).length
                    return (
                      <div className="bg-bg rounded-lg p-3 text-center">
                        <div className="text-xs text-text-muted">{t('accuracy', lang)}</div>
                        <div className="text-lg font-bold">{(correct / pairs.length * 100).toFixed(1)}%</div>
                      </div>
                    )
                  })()}
                </>
              )}
            </div>
          </div>

          {/* Prediction table */}
          <div className="bg-surface border border-border rounded-xl p-4 overflow-x-auto">
            <h3 className="text-sm font-semibold mb-3">{t('predictions', lang)}</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2">#</th>
                  {result.actual.some(a => a !== null) && <th className="text-left py-2 px-2">{t('actual', lang)}</th>}
                  <th className="text-left py-2 px-2">{t('predicted', lang)}</th>
                </tr>
              </thead>
              <tbody>
                {result.predicted.slice(0, 50).map((pred, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-1.5 px-2 text-text-muted">{i + 1}</td>
                    {result.actual.some(a => a !== null) && (
                      <td className="py-1.5 px-2">{result.actual[i] !== null ? (typeof result.actual[i] === 'number' ? (result.actual[i] as number).toFixed(4) : result.actual[i]) : '-'}</td>
                    )}
                    <td className="py-1.5 px-2 font-medium text-accent">{typeof pred === 'number' ? pred.toFixed(4) : pred}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {result.predicted.length > 50 && (
              <p className="text-xs text-text-muted mt-2">{t('showingFirst', lang)} {result.predicted.length} {t('rows', lang)}</p>
            )}
          </div>

          {/* Scatter chart if actual values exist */}
          {result.actual.some(a => a !== null) && !(modelData.isClassification || modelData.classMap) && (
            <div className="bg-surface border border-border rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">{t('actualVsPred', lang)}</h3>
              <div className="h-64 flex items-center justify-center">
                <ActualVsPredChart actual={result.actual.filter(a => a !== null) as number[]} predicted={result.predicted.slice(0, result.actual.filter(a => a !== null).length)} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ActualVsPredChart({ actual, predicted }: { actual: number[]; predicted: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width = canvas.offsetWidth * 2
    const h = canvas.height = canvas.offsetHeight * 2
    ctx.scale(2, 2)
    const cw = w / 2, ch = h / 2
    const pad = 40

    ctx.clearRect(0, 0, cw, ch)

    const allVals = [...actual, ...predicted]
    const minV = Math.min(...allVals)
    const maxV = Math.max(...allVals)
    const range = maxV - minV || 1

    const toX = (v: number) => pad + ((v - minV) / range) * (cw - pad * 2)
    const toY = (v: number) => ch - pad - ((v - minV) / range) * (ch - pad * 2)

    // Grid
    ctx.strokeStyle = '#e5e7eb40'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= 4; i++) {
      const v = minV + (range / 4) * i
      ctx.beginPath(); ctx.moveTo(pad, toY(v)); ctx.lineTo(cw - pad, toY(v)); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(toX(v), pad); ctx.lineTo(toX(v), ch - pad); ctx.stroke()
    }

    // Diagonal line
    ctx.strokeStyle = '#6b728080'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath(); ctx.moveTo(toX(minV), toY(minV)); ctx.lineTo(toX(maxV), toY(maxV)); ctx.stroke()
    ctx.setLineDash([])

    // Points
    ctx.fillStyle = '#6366f1'
    for (let i = 0; i < actual.length; i++) {
      ctx.beginPath()
      ctx.arc(toX(actual[i]), toY(predicted[i]), 3, 0, Math.PI * 2)
      ctx.fill()
    }

    // Labels
    ctx.fillStyle = '#9ca3af'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Actual', cw / 2, ch - 5)
    ctx.save()
    ctx.translate(10, ch / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText('Predicted', 0, 0)
    ctx.restore()
  }, [actual, predicted])

  return <canvas ref={canvasRef} className="w-full h-full" />
}

function renderHyperparams(
  model: ModelType,
  params: Record<string, unknown>,
  update: (key: string, value: unknown) => void,
  lang: 'en' | 'ko'
) {
  const numInput = (key: string, label: string, min: number, max: number, step: number) => (
    <div key={key}>
      <label className="text-xs text-text-muted">{label}</label>
      <input type="number" value={params[key] as number} min={min} max={max} step={step}
        onChange={(e) => update(key, Number(e.target.value))}
        className="w-full mt-0.5 bg-bg border border-border rounded px-2 py-1 text-xs text-text" />
    </div>
  )

  switch (model) {
    case 'multiple_regression':
      return (
        <div className="grid grid-cols-2 gap-3">
          {numInput('learningRate', t('learningRate', lang), 0.0001, 1, 0.001)}
          {numInput('epochs', t('epochs', lang), 10, 500, 10)}
        </div>
      )
    case 'logistic':
      return (
        <div className="grid grid-cols-2 gap-3">
          {numInput('learningRate', t('learningRate', lang), 0.0001, 1, 0.001)}
          {numInput('epochs', t('epochs', lang), 10, 500, 10)}
          {numInput('l2Strength', t('l2Regularization', lang), 0, 1, 0.001)}
        </div>
      )
    case 'random_forest':
      return (
        <div className="grid grid-cols-2 gap-3">
          {numInput('nTrees', t('nTrees', lang), 10, 500, 10)}
          {numInput('maxDepth', t('maxDepth', lang), 2, 30, 1)}
        </div>
      )
    case 'ann':
      return (
        <div className="grid grid-cols-2 gap-3">
          {numInput('learningRate', t('learningRate', lang), 0.0001, 0.1, 0.0001)}
          {numInput('epochs', t('epochs', lang), 10, 500, 10)}
          <div>
            <label className="text-xs text-text-muted">{t('hiddenLayers', lang)}</label>
            <input type="text" value={(params.hiddenLayers as number[]).join(',')}
              onChange={(e) => update('hiddenLayers', e.target.value.split(',').map(Number).filter((n) => !isNaN(n) && n > 0))}
              className="w-full mt-0.5 bg-bg border border-border rounded px-2 py-1 text-xs text-text"
              placeholder="64,32" />
          </div>
        </div>
      )
    case 'xgboost':
      return (
        <div className="grid grid-cols-2 gap-3">
          {numInput('nEstimators', t('nEstimators', lang), 10, 500, 10)}
          {numInput('maxDepth', t('maxDepth', lang), 2, 15, 1)}
          {numInput('learningRate', t('learningRate', lang), 0.01, 0.5, 0.01)}
          {numInput('subsample', t('subsample', lang), 0.5, 1, 0.05)}
        </div>
      )
    default:
      return null
  }
}
