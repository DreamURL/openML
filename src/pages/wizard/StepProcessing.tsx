import { useState, useRef } from 'react'
import { useData } from '@/context/DataContext'
import { useWizard } from '@/context/WizardContext'
import { useLang } from '@/context/LangContext'
import { t } from '@/i18n/strings'
import { ColumnManagementPanel } from '@/components/wizard/processing/ColumnManagementPanel'
import { DataFilteringPanel } from '@/components/wizard/processing/DataFilteringPanel'
import { CorrelationPanel } from '@/components/wizard/processing/CorrelationPanel'
import { ProcessingPreviewPanel } from '@/components/wizard/processing/ProcessingPreviewPanel'
import { useNavigate } from 'react-router-dom'
import { Upload, AlertCircle } from 'lucide-react'
import { Head } from '@/components/seo/Head'

type SubTab = 'columns' | 'filtering' | 'correlation' | 'preview'

export function StepProcessing() {
  const { rawData } = useData()
  const { hasExistingModel, uploadedModelData, setUploadedModelFile, setUploadedModelData } = useWizard()
  const { lang } = useLang()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [activeTab, setActiveTab] = useState<SubTab>('columns')

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

  if (rawData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <AlertCircle size={48} className="text-text-muted mb-4" />
        <h2 className="text-xl font-semibold mb-2">{t('noDataset', lang)}</h2>
        <p className="text-text-muted mb-4">{t('noDatasetDesc', lang)}</p>
        <button onClick={() => navigate('/')}
          className="bg-accent hover:bg-accent-light text-white font-medium px-4 py-2 rounded-lg transition-all">
          {t('goToHome', lang)}
        </button>
      </div>
    )
  }

  const tabs: { key: SubTab; label: string }[] = [
    { key: 'columns', label: t('columnManagement', lang) },
    { key: 'filtering', label: t('dataPreprocessing', lang) },
    { key: 'correlation', label: t('correlationAnalysis', lang) },
    { key: 'preview', label: t('preview', lang) },
  ]

  return (
    <>
    <Head titleKey="seoProcessingTitle" descriptionKey="seoProcessingDescription" />
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Model upload section for "I have a model" mode */}
      {hasExistingModel && (
        <div className="bg-surface border border-accent/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">{t('uploadExistingModel', lang)}</h3>
              <p className="text-xs text-text-muted mt-1">{t('uploadModelDesc', lang)}</p>
            </div>
            <div className="flex items-center gap-3">
              <input ref={fileInputRef} type="file" accept=".json" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleModelUpload(f) }} />
              <button onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-light text-white rounded-lg text-sm font-medium transition-all">
                <Upload size={14} /> {t('uploadModel', lang)}
              </button>
            </div>
          </div>
          {uploadedModelData != null && (
            <div className="mt-3 bg-success/10 border border-success/30 rounded-lg p-2 text-xs text-success">
              {t('modelLoaded', lang)}
            </div>
          )}
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
        {tabs.map(({ key, label }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex-1 py-2 text-sm rounded-md transition-all ${
              activeTab === key ? 'bg-accent text-white' : 'text-text-muted hover:text-accent'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Tab content — all panels stay mounted to preserve state */}
      <div className={activeTab !== 'columns' ? 'hidden' : ''}><ColumnManagementPanel /></div>
      <div className={activeTab !== 'filtering' ? 'hidden' : ''}><DataFilteringPanel /></div>
      <div className={activeTab !== 'correlation' ? 'hidden' : ''}><CorrelationPanel /></div>
      <div className={activeTab !== 'preview' ? 'hidden' : ''}><ProcessingPreviewPanel /></div>
    </div>
    </>
  )
}
