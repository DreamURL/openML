import { useState } from 'react'
import { useLang } from '@/context/LangContext'
import { t } from '@/i18n/strings'
import { useModelIO } from '@/hooks/useModelIO'
import { LineChart } from '@/components/charts/LineChart'
import { BarChart } from '@/components/charts/BarChart'
import { Download } from 'lucide-react'

interface RegressionDetailProps {
  result: any
  modelData?: unknown
}

type Tab = 'metrics' | 'predictions' | 'coefficients'

export function RegressionDetail({ result, modelData }: RegressionDetailProps) {
  const { lang } = useLang()
  const { saveModel } = useModelIO()
  const [activeTab, setActiveTab] = useState<Tab>('metrics')

  const metrics = result?.metrics ?? {}
  const lossHistory: number[] = result?.lossHistory ?? []
  const predictions = result?.predictions ?? {}
  const coefficients = result?.extra?.coefficients ?? {}

  const trainActual: number[] = predictions.trainActual ?? []
  const trainPredicted: number[] = predictions.trainPredicted ?? []
  const testActual: number[] = predictions.testActual ?? []
  const testPredicted: number[] = predictions.testPredicted ?? []

  const coeffNames: string[] = Object.keys(coefficients)
  const coeffValues: number[] = Object.values(coefficients) as number[]

  const metricCards = [
    { label: t('rSquared', lang), value: metrics.r2 },
    { label: t('rmse', lang), value: metrics.rmse },
    { label: t('mae', lang), value: metrics.mae },
    { label: t('trainRmse', lang), value: metrics.trainRmse },
  ]

  const tabs: { key: Tab; label: string }[] = [
    { key: 'metrics', label: t('metricsTab', lang) },
    { key: 'predictions', label: t('predictionsTab', lang) },
    { key: 'coefficients', label: t('coefficientsTab', lang) },
  ]

  const handleDownload = () => {
    if (modelData) {
      saveModel(modelData, `regression_model_${Date.now()}`)
    }
  }

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
              {card.value != null ? Number(card.value).toFixed(4) : '--'}
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

        {activeTab === 'coefficients' && (
          <div className="space-y-4">
            {/* Regression Equation */}
            {coeffNames.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">{t('regressionEquation', lang)}</h4>
                <div className="bg-bg rounded-lg p-4 font-mono text-sm overflow-x-auto">
                  <span className="text-accent font-semibold">Y</span>
                  <span className="text-text-muted"> = </span>
                  <span>{Number(result?.modelData?.bias?.[0] ?? 0).toFixed(4)}</span>
                  {coeffNames.map((name, i) => (
                    <span key={name}>
                      <span className="text-text-muted"> {coeffValues[i] >= 0 ? '+' : '-'} </span>
                      <span>{Math.abs(coeffValues[i]).toFixed(4)}</span>
                      <span className="text-accent"> &times; {name}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
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
      </div>
    </div>
  )
}
