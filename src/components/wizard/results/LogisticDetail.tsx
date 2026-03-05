import { useState } from 'react'
import { useLang } from '@/context/LangContext'
import { t } from '@/i18n/strings'
import { useModelIO } from '@/hooks/useModelIO'
import { LineChart } from '@/components/charts/LineChart'
import { BarChart } from '@/components/charts/BarChart'
import { Download } from 'lucide-react'

interface LogisticDetailProps {
  result: any
  modelData?: unknown
}

type Tab = 'metrics' | 'predictions' | 'coefficients' | 'confusion'

export function LogisticDetail({ result, modelData }: LogisticDetailProps) {
  const { lang } = useLang()
  const { saveModel } = useModelIO()
  const [activeTab, setActiveTab] = useState<Tab>('metrics')

  const metrics = result?.metrics ?? {}
  const lossHistory: number[] = result?.lossHistory ?? []
  const predictions = result?.predictions ?? {}
  const coefficients = result?.extra?.coefficients ?? {}
  const confusionMatrix: number[][] = result?.extra?.confusionMatrix ?? []

  const trainActual: number[] = predictions.trainActual ?? []
  const trainPredicted: number[] = predictions.trainPredicted ?? []
  const testActual: number[] = predictions.testActual ?? []
  const testPredicted: number[] = predictions.testPredicted ?? []

  const coeffNames: string[] = Object.keys(coefficients)
  const coeffValues: number[] = Object.values(coefficients) as number[]

  const metricCards = [
    { label: t('accuracy', lang), value: metrics.accuracy },
    { label: t('precision', lang), value: metrics.precision },
    { label: t('recall', lang), value: metrics.recall },
    { label: t('f1Score', lang), value: metrics.f1 },
    { label: t('trainAccuracy', lang), value: metrics.trainAccuracy },
  ]

  const tabs: { key: Tab; label: string }[] = [
    { key: 'metrics', label: t('metricsTab', lang) },
    { key: 'predictions', label: t('predictionsTab', lang) },
    { key: 'coefficients', label: t('coefficientsTab', lang) },
    { key: 'confusion', label: t('confusionMatrixTab', lang) },
  ]

  const handleDownload = () => {
    if (modelData) {
      saveModel(modelData, `logistic_model_${Date.now()}`)
    }
  }

  // Confusion matrix labels
  const cm = confusionMatrix.length === 2 ? confusionMatrix : [[0, 0], [0, 0]]
  const cmTotal = cm[0][0] + cm[0][1] + cm[1][0] + cm[1][1] || 1

  return (
    <div className="space-y-4">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {metricCards.map((card) => (
          <div
            key={card.label}
            className="bg-surface border border-border rounded-lg p-3"
          >
            <div className="text-xs text-text-muted">{card.label}</div>
            <div className="text-lg font-semibold font-mono mt-1">
              {card.value != null ? (Number(card.value) * 100).toFixed(2) + '%' : '--'}
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
        {activeTab === 'metrics' && (
          <div className="space-y-4">
            {lossHistory.length > 0 ? (
              <LineChart
                labels={lossHistory.map((_, i) => String(i + 1))}
                datasets={[
                  {
                    label: t('trainingLoss', lang),
                    data: lossHistory,
                    borderColor: 'rgba(108, 99, 255, 1)',
                    pointRadius: lossHistory.length > 50 ? 0 : 2,
                  },
                ]}
                title={t('lossOverEpochs', lang)}
                xLabel={t('epoch', lang)}
                yLabel={t('loss', lang)}
              />
            ) : (
              <p className="text-sm text-text-muted text-center py-8">
                {t('noLossHistory', lang)}
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
                yLabel={t('class', lang)}
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
                yLabel={t('class', lang)}
              />
            )}
          </div>
        )}

        {activeTab === 'coefficients' && (
          <div>
            {coeffNames.length > 0 ? (
              <BarChart
                labels={coeffNames}
                data={coeffValues}
                label={t('coefficient', lang)}
                title={t('featureCoefficients', lang)}
                horizontal
                color="rgba(108, 99, 255, 0.7)"
              />
            ) : (
              <p className="text-sm text-text-muted text-center py-8">
                {t('noCoefficients', lang)}
              </p>
            )}
          </div>
        )}

        {activeTab === 'confusion' && (
          <div className="space-y-4">
            <h4 className="text-sm font-medium">{t('confusionMatrix', lang)}</h4>
            <div className="flex justify-center">
              <div className="inline-block">
                {/* Header row */}
                <div className="grid grid-cols-3 gap-1 mb-1">
                  <div />
                  <div className="text-xs text-text-muted text-center font-medium px-2 py-1">
                    {t('predictedNeg', lang)}
                  </div>
                  <div className="text-xs text-text-muted text-center font-medium px-2 py-1">
                    {t('predictedPos', lang)}
                  </div>
                </div>
                {/* Row 0: Actual Negative */}
                <div className="grid grid-cols-3 gap-1 mb-1">
                  <div className="text-xs text-text-muted font-medium flex items-center justify-end pr-2">
                    {t('actualNeg', lang)}
                  </div>
                  <div
                    className="bg-success/20 border border-success/30 rounded-lg p-4 text-center min-w-[80px]"
                  >
                    <div className="text-lg font-semibold font-mono">{cm[0][0]}</div>
                    <div className="text-[10px] text-text-muted mt-1">
                      TN ({((cm[0][0] / cmTotal) * 100).toFixed(1)}%)
                    </div>
                  </div>
                  <div
                    className="bg-danger/20 border border-danger/30 rounded-lg p-4 text-center min-w-[80px]"
                  >
                    <div className="text-lg font-semibold font-mono">{cm[0][1]}</div>
                    <div className="text-[10px] text-text-muted mt-1">
                      FP ({((cm[0][1] / cmTotal) * 100).toFixed(1)}%)
                    </div>
                  </div>
                </div>
                {/* Row 1: Actual Positive */}
                <div className="grid grid-cols-3 gap-1">
                  <div className="text-xs text-text-muted font-medium flex items-center justify-end pr-2">
                    {t('actualPos', lang)}
                  </div>
                  <div
                    className="bg-danger/20 border border-danger/30 rounded-lg p-4 text-center min-w-[80px]"
                  >
                    <div className="text-lg font-semibold font-mono">{cm[1][0]}</div>
                    <div className="text-[10px] text-text-muted mt-1">
                      FN ({((cm[1][0] / cmTotal) * 100).toFixed(1)}%)
                    </div>
                  </div>
                  <div
                    className="bg-success/20 border border-success/30 rounded-lg p-4 text-center min-w-[80px]"
                  >
                    <div className="text-lg font-semibold font-mono">{cm[1][1]}</div>
                    <div className="text-[10px] text-text-muted mt-1">
                      TP ({((cm[1][1] / cmTotal) * 100).toFixed(1)}%)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
