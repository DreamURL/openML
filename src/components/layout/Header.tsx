import { Cpu, Sun, Moon, FileText } from 'lucide-react'
import { useState, useEffect, type ReactNode } from 'react'
import { useTheme } from '@/context/ThemeContext'
import { useLang } from '@/context/LangContext'
import { t } from '@/i18n/strings'

interface HeaderProps {
  menuButton?: ReactNode
  onPrivacyClick?: () => void
}

export function Header({ menuButton, onPrivacyClick }: HeaderProps) {
  const [backend, setBackend] = useState<string>('detecting...')
  const { theme, toggleTheme } = useTheme()
  const { lang, setLang } = useLang()

  useEffect(() => {
    async function detectBackend() {
      try {
        const canvas = document.createElement('canvas')
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
        if (gl) {
          setBackend('WebGL')
        } else {
          setBackend('CPU')
        }
      } catch {
        setBackend('CPU')
      }
    }
    detectBackend()
  }, [])

  return (
    <header className="h-14 bg-surface border-b border-border flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-2">
        {menuButton}
        <span className="lg:hidden text-sm font-bold"><span className="text-accent">open</span>ML</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onPrivacyClick}
          className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text transition-colors"
          title={t('privacyPolicy', lang)}
        >
          <FileText size={18} />
        </button>
        <div className="flex items-center rounded-lg border border-border overflow-hidden text-xs">
          {([
            ['en', 'EN'],
            ['ko', '한국어'],
            ['zh', '中文'],
            ['ja', '日本語'],
            ['es', 'ES'],
          ] as const).map(([code, label]) => (
            <button
              key={code}
              onClick={() => setLang(code)}
              className={`px-2 py-1 transition-colors ${lang === code ? 'bg-accent text-white' : 'text-text-muted hover:text-text hover:bg-surface-hover'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text transition-colors"
          title={theme === 'dark' ? t('switchToLight', lang) : t('switchToDark', lang)}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Cpu size={14} />
          <span className="hidden sm:inline">{t('backend', lang)}: </span>
          <span>{backend}</span>
          <span className={`w-2 h-2 rounded-full ${backend === 'CPU' ? 'bg-warning' : 'bg-success'}`} />
        </div>
      </div>
    </header>
  )
}
