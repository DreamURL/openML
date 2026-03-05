import { useState } from 'react'
import { useLang } from '@/context/LangContext'
import { t } from '@/i18n/strings'
import { useModelIO } from '@/hooks/useModelIO'
import { LineChart } from '@/components/charts/LineChart'
import { BarChart } from '@/components/charts/BarChart'
import { Download } from 'lucide-react'

interface XGBoostDetailProps {
  result: any
  modelData?: unknown
}

type Tab = 'training' | 'importance' | 'predictions'

export function XGBoostDetail({ result, modelData }: XGBoostDetailProps) {
  const { lang } = useLang()
  const { saveModel } = useModelIO()
  const [activeTab, setActiveTab] = useState<Tab>('training')

  const metrics = result?.metrics ?? {}
  const lossHistory: number[] = result?.lossHistory ?? []
  const valLossHistory: number[] = result?.extra?.valLossHistory ?? []
  const predictions = result?.predictions ?? {}
  const featureImportance: Record<string, number> = result?.extra?.featureImportance ?? {}

  const isClassification = metrics.accuracy != null

  const trainActual: number[] = predictions.trainActual ?? []
  const trainPredicted: number[] = predictions.trainPredicted ?? []
  const testActual: number[] = predictions.testActual ?? []
  const testPredicted: number[] = predictions.testPredicted ?? []

  const importanceNames = Object.keys(featureImportance)
  const importanceValues = Object.values(featureImportance) as number[]

  // Sort by importance descending
  const sortedIndices = importanceValues
    .map((_, i) => i)
    .sort((a, b) => importanceValues[b] - importanceValues[a])
  const sortedNames = sortedIndices.map((i) => importanceNames[i])
  const sortedValues = sortedIndices.map((i) => importanceValues[i])

  const metricCards = isClassification
    ? [
        { label: t('accuracy', lang), value: metrics.accuracy, pct: true },
        { label: t('precision', lang), value: metrics.precision, pct: true },
        { label: t('recall', lang), value: metrics.recall, pct: true },
        { label: t('f1Score', lang), value: metrics.f1, pct: true },
      ]
    : [
        { label: t('rSquared', lang), value: metrics.r2, pct: false },
        { label: t('rmse', lang), value: metrics.rmse, pct: false },
        { label: t('mae', lang), value: metrics.mae, pct: false },
        { label: t('trainRmse', lang), value: metrics.trainRmse, pct: false },
      ]

  const tabs: { key: Tab; label: string }[] = [
    { key: 'training', label: t('trainingCurveTab', lang) },
    { key: 'importance', label: t('featureImportanceTab', lang) },
    { key: 'predictions', label: t('predictionsTab', lang) },
  ]

  const handleDownload = () => {
    if (modelData) {
      saveModel(modelData, `xgboost_model_${Date.now()}`)
    }
  }

  const formatMetricValue = (value: number | undefined, pct: boolean) => {
    if (value == null) return '--'
    return pct ? (value * 100).toFixed(2) + '%' : Number(value).toFixed(4)
  }

  // Build training loss datasets
  const lossDatasets: {
    label: string
    data: number[]
    borderColor: string
    borderDash?: number[]
    pointRadius: number
  }[] = []

  if (lossHistory.length > 0) {
    lossDatasets.push({
      label: t('trainLoss', lang),
      data: lossHistory,
      borderColor: 'rgba(108, 99, 255, 1)',
      pointRadius: lossHistory.length > 50 ? 0 : 2,
    })
  }
  if (valLossHistory.length > 0) {
    lossDatasets.push({
      label: t('valLoss', lang),
      data: valLossHistory,
      borderColor: 'rgba(239, 68, 68, 1)',
      borderDash: [5, 5],
      pointRadius: valLossHistory.length > 50 ? 0 : 2,
    })
  }

  const epochLabels = lossHistory.map((_, i) => String(i + 1))

  return (
    <div className="space-y-4">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
            {lossDatasets.length > 0 ? (
              <LineChart
                labels={epochLabels}
                datasets={lossDatasets}
                title={t('lossOverIterations', lang)}
                xLabel={t('iteration', lang)}
                yLabel={t('loss', lang)}
              />
            ) : (
              <p className="text-sm text-text-muted text-center py-8">
                {t('noLossHistory', lang)}
              </p>
            )}
          </div>
        )}

        {activeTab === 'importance' && (
          <div>
            {sortedNames.length > 0 ? (
              <BarChart
                labels={sortedNames}
                data={sortedValues}
                label={t('importance', lang)}
                title={t('featureImportance', lang)}
                horizontal
                color="rgba(234, 179, 8, 0.7)"
              />
            ) : (
              <p className="text-sm text-text-muted text-center py-8">
                {t('noFeatureImportance', lang)}
              </p>
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
      </div>

    </div>
  )
}
