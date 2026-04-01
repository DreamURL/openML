import { useState } from 'react'
import { useData } from '@/context/DataContext'
import { useLang } from '@/context/LangContext'
import { t } from '@/i18n/strings'
import { ColumnManagementPanel } from '@/components/wizard/processing/ColumnManagementPanel'
import { DataFilteringPanel } from '@/components/wizard/processing/DataFilteringPanel'
import { CorrelationPanel } from '@/components/wizard/processing/CorrelationPanel'
import { ProcessingPreviewPanel } from '@/components/wizard/processing/ProcessingPreviewPanel'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { Head } from '@/components/seo/Head'

type SubTab = 'columns' | 'filtering' | 'correlation' | 'preview'

export function StepProcessing() {
  const { rawData } = useData()
  const { lang } = useLang()
  const navigate = useNavigate()
  const location = useLocation()

  const [activeTab, setActiveTab] = useState<SubTab>('columns')

  if (rawData.length === 0) {
    return (
      <>
        <Head titleKey="seoProcessingTitle" descriptionKey="seoProcessingDescription" noIndex />
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <AlertCircle size={48} className="text-text-muted mb-4" />
          <h2 className="text-xl font-semibold mb-2">{t('noDataset', lang)}</h2>
          <p className="text-text-muted mb-4">{t('noDatasetDesc', lang)}</p>
          <button
            onClick={() => navigate({ pathname: '/', search: location.search })}
            className="bg-accent hover:bg-accent-light text-white font-medium px-4 py-2 rounded-lg transition-all"
          >
            {t('goToHome', lang)}
          </button>
        </div>
      </>
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
      <Head titleKey="seoProcessingTitle" descriptionKey="seoProcessingDescription" noIndex />
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 py-2 text-sm rounded-md transition-all ${
                activeTab === key ? 'bg-accent text-white' : 'text-text-muted hover:text-accent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className={activeTab !== 'columns' ? 'hidden' : ''}><ColumnManagementPanel /></div>
        <div className={activeTab !== 'filtering' ? 'hidden' : ''}><DataFilteringPanel /></div>
        <div className={activeTab !== 'correlation' ? 'hidden' : ''}><CorrelationPanel /></div>
        <div className={activeTab !== 'preview' ? 'hidden' : ''}><ProcessingPreviewPanel /></div>
      </div>
    </>
  )
}
