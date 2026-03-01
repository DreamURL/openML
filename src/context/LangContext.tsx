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
    return (saved === 'en' || saved === 'ko') ? saved : 'en'
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
