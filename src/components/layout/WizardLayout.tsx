import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { Header } from './Header'
import { StepIndicator } from '@/components/wizard/StepIndicator'
import { useWizard } from '@/context/WizardContext'
import { useData } from '@/context/DataContext'
import { useLang } from '@/context/LangContext'
import { t } from '@/i18n/strings'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { AdUnit } from '@/components/ad/AdUnit'

const stepRoutes = ['/', '/processing', '/training'] as const

export function WizardLayout() {
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const { lang } = useLang()
  const { completedSteps, goToStep } = useWizard()
  const { rawData } = useData()
  const navigate = useNavigate()
  const location = useLocation()

  const currentStepFromRoute = (): 1 | 2 | 3 => {
    if (location.pathname === '/processing') return 2
    if (location.pathname === '/training') return 3
    return 1
  }

  const activeStep = currentStepFromRoute()

  const handleStepClick = (step: 1 | 2 | 3) => {
    goToStep(step)
    navigate(stepRoutes[step - 1])
  }

  const canGoNext = () => {
    if (activeStep === 1) return rawData.length > 0
    if (activeStep === 2) return true
    return false
  }

  const handleNext = () => {
    if (activeStep < 3 && canGoNext()) {
      const nextStep = (activeStep + 1) as 1 | 2 | 3
      goToStep(nextStep)
      navigate(stepRoutes[nextStep - 1])
    }
  }

  const handleBack = () => {
    if (activeStep > 1) {
      const prevStep = (activeStep - 1) as 1 | 2 | 3
      goToStep(prevStep)
      navigate(stepRoutes[prevStep - 1])
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Privacy Modal */}
      {privacyOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPrivacyOpen(false)}>
          <div className="bg-surface border border-border rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-surface border-b border-border p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold">{t('privacyTitle', lang)}</h2>
              <button onClick={() => setPrivacyOpen(false)} className="p-2 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div><h3 className="text-lg font-semibold mb-2">{t('privacyIntro', lang)}</h3></div>
              <div><h3 className="text-lg font-semibold mb-2">{t('dataProcessing', lang)}</h3><p className="text-text-muted">{t('dataProcessingDesc', lang)}</p></div>
              <div><h3 className="text-lg font-semibold mb-2">{t('noDataCollection', lang)}</h3><p className="text-text-muted">{t('noDataCollectionDesc', lang)}</p></div>
            </div>
          </div>
        </div>
      )}

      <Header onPrivacyClick={() => setPrivacyOpen(true)} />

      <div className="border-b border-border bg-surface">
        <StepIndicator
          currentStep={activeStep}
          completedSteps={completedSteps}
          onStepClick={handleStepClick}
        />
      </div>

      <main className="flex-1 p-4 md:p-6 overflow-auto">
        <Outlet />
      </main>

      {/* Ad unit above bottom navigation */}
      <div className="border-t border-border px-4 md:px-6 py-2">
        <div className="max-w-4xl mx-auto">
          <AdUnit slot="8504504766" />
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="border-t border-border bg-surface px-6 py-3 flex items-center justify-between">
        <div>
          {activeStep > 1 && (
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-text-muted hover:text-text hover:border-accent transition-all text-sm"
            >
              <ArrowLeft size={16} />
              {t('back', lang)}
            </button>
          )}
        </div>
        <div>
          {activeStep < 3 && (
            <button
              onClick={handleNext}
              disabled={!canGoNext()}
              className="flex items-center gap-2 px-6 py-2 rounded-lg bg-accent hover:bg-accent-light disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium transition-all text-sm"
            >
              {t('next', lang)}
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
