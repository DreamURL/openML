import { Check, Upload, SlidersHorizontal, Brain } from 'lucide-react'
import { useLang } from '@/context/LangContext'
import { t } from '@/i18n/strings'

interface StepIndicatorProps {
  currentStep: 1 | 2 | 3
  completedSteps: Set<number>
  onStepClick?: (step: 1 | 2 | 3) => void
}

const steps = [
  { step: 1 as const, icon: Upload, labelKey: 'stepUpload' as const },
  { step: 2 as const, icon: SlidersHorizontal, labelKey: 'stepProcessing' as const },
  { step: 3 as const, icon: Brain, labelKey: 'stepTraining' as const },
]

export function StepIndicator({ currentStep, completedSteps, onStepClick }: StepIndicatorProps) {
  const { lang } = useLang()

  return (
    <div className="flex items-center justify-center gap-0 py-4 px-6">
      {steps.map(({ step, icon: Icon, labelKey }, idx) => {
        const isCompleted = completedSteps.has(step)
        const isCurrent = currentStep === step
        const isClickable = isCompleted || step <= currentStep

        return (
          <div key={step} className="flex items-center">
            <button
              onClick={() => isClickable && onStepClick?.(step)}
              disabled={!isClickable}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                isCurrent
                  ? 'bg-accent text-white'
                  : isCompleted
                    ? 'bg-accent/20 text-accent hover:bg-accent/30'
                    : 'bg-surface text-text-muted cursor-not-allowed'
              }`}
            >
              <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                isCompleted ? 'bg-accent text-white' : isCurrent ? 'bg-white/20' : 'bg-border'
              }`}>
                {isCompleted ? <Check size={14} /> : <Icon size={14} />}
              </span>
              <span className="text-sm font-medium hidden sm:inline">{t(labelKey, lang)}</span>
            </button>

            {idx < steps.length - 1 && (
              <div className={`w-12 h-0.5 mx-1 ${
                completedSteps.has(step) ? 'bg-accent' : 'bg-border'
              }`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
