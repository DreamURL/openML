import { useLang } from '@/context/LangContext'
import { t } from '@/i18n/strings'

interface TrainingProgressProps {
  progress: number
  message?: string
  isRunning: boolean
}

export function TrainingProgress({ progress, message, isRunning }: TrainingProgressProps) {
  const { lang } = useLang()
  if (!isRunning && progress === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-text-muted">{message || (isRunning ? t('training', lang) : t('complete', lang))}</span>
        <span className="text-accent font-mono">{Math.round(progress)}%</span>
      </div>
      <div className="h-2 bg-bg rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            progress >= 100 ? 'bg-success' : 'bg-accent'
          }`}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
    </div>
  )
}
