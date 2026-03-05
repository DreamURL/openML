import { useState } from 'react'
import { useLang } from '@/context/LangContext'
import { t } from '@/i18n/strings'
import { useModelIO } from '@/hooks/useModelIO'
import { LineChart } from '@/components/charts/LineChart'
import { Download } from 'lucide-react'

interface ANNDetailProps {
  result: any
  modelData?: unknown
}

type Tab = 'training' | 'predictions' | 'architecture'

export function ANNDetail({ result, modelData }: ANNDetailProps) {
  const { lang } = useLang()
  const { saveModel } = useModelIO()
  const [activeTab, setActiveTab] = useState<Tab>('training')

  const metrics = result?.metrics ?? {}
  const lossHistory: number[] = result?.lossHistory ?? []
  const accHistory: number[] = result?.extra?.accHistory ?? []
  const valLossHistory: number[] = result?.extra?.valLossHistory ?? []
  const valAccHistory: number[] = result?.extra?.valAccHistory ?? []
  const predictions = result?.predictions ?? {}
  const architecture = result?.extra?.architecture ?? {}

  const isClassification = metrics.accuracy != null

  const trainActual: number[] = predictions.trainActual ?? []
  const trainPredicted: number[] = predictions.trainPredicted ?? []
  const testActual: number[] = predictions.testActual ?? []
  const testPredicted: number[] = predictions.testPredicted ?? []

  const layers: { type: string; units: number; activation?: string }[] =
    architecture.layers ?? []

  const metricCards = isClassification
    ? [
        { label: t('accuracy', lang), value: metrics.accuracy, pct: true },
        { label: t('precision', lang), value: metrics.precision, pct: true },
        { label: t('recall', lang), value: metrics.recall, pct: true },
        { label: t('f1Score', lang), value: metrics.f1, pct: true },
        { label: t('trainAccuracy', lang), value: metrics.trainAccuracy, pct: true },
      ]
    : [
        { label: t('rSquared', lang), value: metrics.r2, pct: false },
        { label: t('rmse', lang), value: metrics.rmse, pct: false },
        { label: t('mae', lang), value: metrics.mae, pct: false },
        { label: t('trainRmse', lang), value: metrics.trainRmse, pct: false },
      ]

  const tabs: { key: Tab; label: string }[] = [
    { key: 'training', label: t('trainingCurveTab', lang) },
    { key: 'predictions', label: t('predictionsTab', lang) },
    { key: 'architecture', label: t('architectureTab', lang) },
  ]

  const handleDownload = () => {
    if (modelData) {
      saveModel(modelData, `ann_model_${Date.now()}`)
    }
  }

  const formatMetricValue = (value: number | undefined, pct: boolean) => {
    if (value == null) return '--'
    return pct ? (value * 100).toFixed(2) + '%' : Number(value).toFixed(4)
  }

  // Build training curve datasets
  const trainingDatasets: {
    label: string
    data: number[]
    borderColor: string
    borderDash?: number[]
    pointRadius: number
  }[] = []

  if (lossHistory.length > 0) {
    trainingDatasets.push({
      label: t('trainLoss', lang),
      data: lossHistory,
      borderColor: 'rgba(108, 99, 255, 1)',
      pointRadius: lossHistory.length > 50 ? 0 : 2,
    })
  }
  if (valLossHistory.length > 0) {
    trainingDatasets.push({
      label: t('valLoss', lang),
      data: valLossHistory,
      borderColor: 'rgba(239, 68, 68, 1)',
      borderDash: [5, 5],
      pointRadius: valLossHistory.length > 50 ? 0 : 2,
    })
  }

  const accDatasets: {
    label: string
    data: number[]
    borderColor: string
    borderDash?: number[]
    pointRadius: number
  }[] = []

  if (accHistory.length > 0) {
    accDatasets.push({
      label: t('trainAccuracy', lang),
      data: accHistory,
      borderColor: 'rgba(34, 197, 94, 1)',
      pointRadius: accHistory.length > 50 ? 0 : 2,
    })
  }
  if (valAccHistory.length > 0) {
    accDatasets.push({
      label: t('valAccuracy', lang),
      data: valAccHistory,
      borderColor: 'rgba(234, 179, 8, 1)',
      borderDash: [5, 5],
      pointRadius: valAccHistory.length > 50 ? 0 : 2,
    })
  }

  const epochLabels = lossHistory.map((_, i) => String(i + 1))

  return (
    <div className="space-y-4">
      {/* Metric Cards */}
      <div className={`grid grid-cols-2 ${isClassification ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-3`}>
        {metricCards.map((card) => (
          <div
            key={card.label}
            className="bg-surface border border-border rounded-lg p-3"
          >
            <div className="text-xs text-text-muted">{card.label}</div>
            <div className="text-lg font-semibold font-mono mt-1">
              {formatMetricValue(card.value, card.pct)}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs + Download */}
      <div className="flex items-center justify-between border-b border-border">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium transition-all border-b-2 ${
                activeTab === tab.key
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-muted hover:text-text hover:border-border'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {modelData != null && (
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-light text-white rounded-lg text-xs font-medium transition-all"
          >
            <Download size={14} />
            {t('downloadModel', lang)}
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="bg-surface border border-border rounded-xl p-5">
        {activeTab === 'training' && (
          <div className="space-y-4">
            {trainingDatasets.length > 0 ? (
              <LineChart
                labels={epochLabels}
                datasets={trainingDatasets}
                title={t('lossOverEpochs', lang)}
                xLabel={t('epoch', lang)}
                yLabel={t('loss', lang)}
              />
            ) : (
              <p className="text-sm text-text-muted text-center py-8">
                {t('noLossHistory', lang)}
              </p>
            )}
            {isClassification && accDatasets.length > 0 && (
              <LineChart
                labels={epochLabels}
                datasets={accDatasets}
                title={t('accuracyOverEpochs', lang)}
                xLabel={t('epoch', lang)}
                yLabel={t('accuracy', lang)}
              />
            )}
          </div>
        )}

        {activeTab === 'predictions' && (
          <div className="space-y-4">
            {testActual.length > 0 ? (
              <LineChart
                labels={testActual.map((_, i) => String(i + 1))}
                datasets={[
                  {
                    label: t('actual', lang),
                    data: testActual,
                    borderColor: 'rgba(108, 99, 255, 1)',
                    pointRadius: testActual.length > 100 ? 0 : 2,
                  },
                  {
                    label: t('predicted', lang),
                    data: testPredicted,
                    borderColor: 'rgba(234, 179, 8, 1)',
                    borderDash: [5, 5],
                    pointRadius: testPredicted.length > 100 ? 0 : 2,
                  },
                ]}
                title={t('testPredictions', lang)}
                xLabel={t('sample', lang)}
                yLabel={t('value', lang)}
              />
            ) : (
              <p className="text-sm text-text-muted text-center py-8">
                {t('noPredictions', lang)}
              </p>
            )}
            {trainActual.length > 0 && (
              <LineChart
                labels={trainActual.map((_, i) => String(i + 1))}
                datasets={[
                  {
                    label: t('actual', lang),
                    data: trainActual,
                    borderColor: 'rgba(108, 99, 255, 1)',
                    pointRadius: trainActual.length > 100 ? 0 : 2,
                  },
                  {
                    label: t('predicted', lang),
                    data: trainPredicted,
                    borderColor: 'rgba(234, 179, 8, 1)',
                    borderDash: [5, 5],
                    pointRadius: trainPredicted.length > 100 ? 0 : 2,
                  },
                ]}
                title={t('trainPredictions', lang)}
                xLabel={t('sample', lang)}
                yLabel={t('value', lang)}
              />
            )}
          </div>
        )}

        {activeTab === 'architecture' && (
          <div className="space-y-4">
            <h4 className="text-sm font-medium">{t('networkArchitecture', lang)}</h4>
            {layers.length > 0 ? (
              <div className="space-y-2">
                {layers.map((layer, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 bg-bg rounded-lg p-3"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent/20 text-accent text-xs font-semibold">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        {layer.type}
                        {layer.activation && (
                          <span className="ml-2 text-xs text-text-muted">
                            ({layer.activation})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-text-muted">
                        {layer.units} {t('units', lang)}
                      </div>
                    </div>
                    {/* Visual bar representing relative size */}
                    <div className="w-24 h-2 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full"
                        style={{
                          width: `${Math.min(100, (layer.units / Math.max(...layers.map((l) => l.units), 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-text-muted text-center py-4">
                  {t('noArchitectureInfo', lang)}
                </p>
                {/* Show basic info from metrics if available */}
                {(result?.extra?.epochs != null || result?.extra?.learningRate != null) && (
                  <div className="grid grid-cols-2 gap-3">
                    {result?.extra?.epochs != null && (
                      <div className="bg-bg rounded-lg p-3">
                        <div className="text-xs text-text-muted">{t('epochs', lang)}</div>
                        <div className="text-sm font-medium font-mono mt-1">{result.extra.epochs}</div>
                      </div>
                    )}
                    {result?.extra?.learningRate != null && (
                      <div className="bg-bg rounded-lg p-3">
                        <div className="text-xs text-text-muted">{t('learningRate', lang)}</div>
                        <div className="text-sm font-medium font-mono mt-1">{result.extra.learningRate}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  )
}
