import { useState } from 'react'
import { useData, type DataRow } from '@/context/DataContext'
import { useWizard } from '@/context/WizardContext'
import { DataUpload } from '@/components/data/DataUpload'
import { DataPreview } from '@/components/data/DataPreview'
import { useLang } from '@/context/LangContext'
import { t } from '@/i18n/strings'
import { Database, Sparkles, FolderOpen } from 'lucide-react'
import { Head } from '@/components/seo/Head'
import Papa from 'papaparse'

const BASE = import.meta.env.BASE_URL

const sampleDatasets = [
  {
    name: 'Boston Housing',
    file: 'boston_housing.csv',
    desc: '162 rows, 13 features — predict median home value (MEDV)',
  },
]

export function StepUpload() {
  const { rawData, setDataset } = useData()
  const { hasExistingModel, setHasExistingModel } = useWizard()
  const { lang } = useLang()
  const [loadingSample, setLoadingSample] = useState(false)

  const loadSample = async (file: string, name: string) => {
    setLoadingSample(true)
    try {
      const res = await fetch(`${BASE}samples/${file}`)
      const text = await res.text()
      Papa.parse<DataRow>(text, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data.length > 0) {
            setDataset(results.data, name)
          }
          setLoadingSample(false)
        },
        error: () => setLoadingSample(false),
      })
    } catch {
      setLoadingSample(false)
    }
  }

  return (
    <>
    <Head titleKey="seoAppTitle" descriptionKey="seoAppDescription" />
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold">
          {t('welcomeTo', lang)} <span className="text-accent">open</span>ML
        </h2>
        <p className="text-text-muted mt-1">{t('homeDesc', lang)}</p>
      </div>

      {/* Mode selection */}
      <div className="bg-surface border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-3">{t('selectMode', lang)}</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setHasExistingModel(false)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all text-sm font-medium ${
              !hasExistingModel
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border text-text-muted hover:border-accent/50'
            }`}
          >
            <Sparkles size={18} />
            {t('newTraining', lang)}
          </button>
          <button
            onClick={() => setHasExistingModel(true)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all text-sm font-medium ${
              hasExistingModel
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border text-text-muted hover:border-accent/50'
            }`}
          >
            <FolderOpen size={18} />
            {t('existingModel', lang)}
          </button>
        </div>
        {hasExistingModel && (
          <p className="text-xs text-text-muted mt-2">{t('existingModelDesc', lang)}</p>
        )}
      </div>

      {/* Sample Dataset */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Database size={16} className="text-accent" />
          <h3 className="text-sm font-semibold">{t('sampleDataset', lang)}</h3>
          <span className="text-xs text-text-muted">{t('trySample', lang)}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {sampleDatasets.map((ds) => (
            <button
              key={ds.file}
              onClick={() => loadSample(ds.file, ds.name)}
              disabled={loadingSample}
              className="flex items-center gap-3 bg-bg border border-border rounded-lg px-4 py-2.5 text-left hover:border-accent/50 hover:bg-surface-hover transition-all disabled:opacity-50"
            >
              <div>
                <p className="text-sm font-medium">{ds.name}</p>
                <p className="text-xs text-text-muted">{ds.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <DataUpload />
      <DataPreview />

      {rawData.length > 0 && (
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-4 text-center">
          <p className="text-sm text-accent font-medium">
            {t('dataReady', lang)}
          </p>
        </div>
      )}
    </div>
    </>
  )
}
