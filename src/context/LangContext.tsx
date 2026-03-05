import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Lang } from '@/i18n/strings'

interface LangContextType {
  lang: Lang
  setLang: (lang: Lang) => void
}

const LangContext = createContext<LangContextType>({ lang: 'en', setLang: () => {} })

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem('openml-lang')
    if (saved && ['en', 'ko', 'zh', 'ja', 'es'].includes(saved)) return saved as Lang
    // Auto-detect from browser language
    const browserLang = (navigator.language || navigator.languages?.[0] || 'en').toLowerCase()
    if (browserLang.startsWith('ko')) return 'ko'
    if (browserLang.startsWith('zh')) return 'zh'
    if (browserLang.startsWith('ja')) return 'ja'
    if (browserLang.startsWith('es')) return 'es'
    return 'en'
  })

  const setLang = (l: Lang) => {
    setLangState(l)
    localStorage.setItem('openml-lang', l)
  }

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      {children}
    </LangContext.Provider>
  )
}

export const useLang = () => useContext(LangContext)
