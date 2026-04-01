import { useState, useRef, useMemo, useEffect } from 'react'
import { useData, type DataRow } from '@/context/DataContext'
import { useWizard } from '@/context/WizardContext'
import { DataUpload } from '@/components/data/DataUpload'
import { DataPreview } from '@/components/data/DataPreview'
import { useLang } from '@/context/LangContext'
import { t } from '@/i18n/strings'
import { Database, Sparkles, FolderOpen, Upload, CheckCircle, AlertTriangle } from 'lucide-react'
import { Head } from '@/components/seo/Head'
import { HomeSeoContent } from '@/components/seo/HomeSeoContent'
import Papa from 'papaparse'
import { sanitizeSeoText } from '@/utils/seo'

const BASE = import.meta.env.BASE_URL

const sampleDatasets = [
  {
    name: 'Boston Housing',
    file: 'boston_housing.csv',
    desc: '162 rows, 13 features to predict median home value (MEDV)',
  },
]

export function StepUpload() {
  const { rawData, columns, setDataset } = useData()
  const {
    hasExistingModel, setHasExistingModel,
    uploadedModelData, setUploadedModelFile, setUploadedModelData,
    setTargetColumn, setSelectedColumns, setExcludedColumns,
  } = useWizard()
  const { lang } = useLang()
  const [loadingSample, setLoadingSample] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const modelData = uploadedModelData as Record<string, any> | null
  const homeDescription = sanitizeSeoText(t('homeDesc', lang))

  const validation = useMemo(() => {
    if (!modelData || rawData.length === 0 || columns.length === 0) return null

    const modelTarget: string = modelData.targetColumn || ''
    const modelFeatures: string[] = modelData.featureColumns || []

    const targetExists = columns.includes(modelTarget)
    const missingFeatures = modelFeatures.filter((feature) => !columns.includes(feature))
    const allValid = targetExists && missingFeatures.length === 0

    return { modelTarget, modelFeatures, targetExists, missingFeatures, allValid }
  }, [modelData, rawData.length, columns])

  useEffect(() => {
    if (!validation || !validation.allValid) return

    setTargetColumn(validation.modelTarget)
    setSelectedColumns([validation.modelTarget, ...validation.modelFeatures])
    setExcludedColumns(columns.filter((column) => column !== validation.modelTarget && !validation.modelFeatures.includes(column)))
  }, [validation, columns, setTargetColumn, setSelectedColumns, setExcludedColumns])

  const handleModelUpload = async (file: File) => {
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      setUploadedModelFile(file)
      setUploadedModelData(data)
    } catch {
      setUploadedModelData(null)
      setUploadedModelFile(null)
    }
  }

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
          <h1 className="text-3xl font-bold">
            {t('welcomeTo', lang)} <span className="text-accent">open</span>ML
          </h1>
          <p className="text-text-muted mt-2 max-w-3xl leading-6">{homeDescription}</p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-3">{t('selectMode', lang)}</h2>
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

        {hasExistingModel && (
          <div className="bg-surface border border-accent/30 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">{t('uploadExistingModel', lang)}</h2>
                <p className="text-xs text-text-muted mt-1">{t('uploadModelDesc', lang)}</p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleModelUpload(file)
                  }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-light text-white rounded-lg text-sm font-medium transition-all"
                >
                  <Upload size={14} /> {t('uploadModel', lang)}
                </button>
              </div>
            </div>

            {modelData && (
              <div className="bg-success/10 border border-success/30 rounded-lg p-2 text-xs text-success">
                {t('modelLoaded', lang)}
                {modelData.type && <span className="ml-2 opacity-70">({modelData.type})</span>}
              </div>
            )}

            {modelData && (
              <div className="bg-bg border border-border rounded-lg p-3 text-xs space-y-1">
                <div><span className="text-text-muted">{t('modelTargetColumn', lang)}: </span><span className="font-mono font-medium">{modelData.targetColumn || '-'}</span></div>
                <div><span className="text-text-muted">{t('modelFeatureColumns', lang)}: </span><span className="font-mono font-medium">{(modelData.featureColumns || []).join(', ') || '-'}</span></div>
              </div>
            )}

            {validation && (
              validation.allValid ? (
                <div className="flex items-center gap-2 bg-success/10 border border-success/30 rounded-lg p-2 text-xs text-success">
                  <CheckCircle size={14} />
                  {t('modelColumnsValid', lang)}
                </div>
              ) : (
                <div className="bg-danger/10 border border-danger/30 rounded-lg p-2 text-xs text-danger space-y-1">
                  {!validation.targetExists && (
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={14} />
                      {t('modelTargetMissing', lang)}: <span className="font-mono font-medium">{validation.modelTarget}</span>
                    </div>
                  )}
                  {validation.missingFeatures.length > 0 && (
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      <span>{t('modelColumnsMissing', lang)}: <span className="font-mono font-medium">{validation.missingFeatures.join(', ')}</span></span>
                    </div>
                  )}
                </div>
              )
            )}

            {!modelData && (
              <p className="text-xs text-warning">{t('uploadModelFirstUpload', lang)}</p>
            )}
          </div>
        )}

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Database size={16} className="text-accent" />
            <h2 className="text-sm font-semibold">{t('sampleDataset', lang)}</h2>
            <span className="text-xs text-text-muted">{t('trySample', lang)}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {sampleDatasets.map((dataset) => (
              <button
                key={dataset.file}
                onClick={() => loadSample(dataset.file, dataset.name)}
                disabled={loadingSample}
                className="flex items-center gap-3 bg-bg border border-border rounded-lg px-4 py-2.5 text-left hover:border-accent/50 hover:bg-surface-hover transition-all disabled:opacity-50"
              >
                <div>
                  <p className="text-sm font-medium">{dataset.name}</p>
                  <p className="text-xs text-text-muted">{dataset.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <DataUpload />
        <DataPreview />
        <HomeSeoContent />

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
