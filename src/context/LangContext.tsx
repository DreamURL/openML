import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Lang } from '@/i18n/strings'
import { isLang } from '@/utils/seo'

interface LangContextType {
  lang: Lang
  setLang: (lang: Lang) => void
}

const LangContext = createContext<LangContextType>({ lang: 'en', setLang: () => {} })

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const queryLang = new URLSearchParams(window.location.search).get('lang')
    if (isLang(queryLang)) return queryLang

    const saved = localStorage.getItem('openml-lang')
    if (isLang(saved)) return saved

    const browserLang = (navigator.language || navigator.languages?.[0] || 'en').toLowerCase()
    if (browserLang.startsWith('ko')) return 'ko'
    if (browserLang.startsWith('zh')) return 'zh'
    if (browserLang.startsWith('ja')) return 'ja'
    if (browserLang.startsWith('es')) return 'es'
    return 'en'
  })

  const setLang = (nextLang: Lang) => {
    setLangState(nextLang)
    localStorage.setItem('openml-lang', nextLang)
  }

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      {children}
    </LangContext.Provider>
  )
}

export const useLang = () => useContext(LangContext)
