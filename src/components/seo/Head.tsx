import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useLang } from '@/context/LangContext'
import { t, type StringKey } from '@/i18n/strings'

const BASE_URL = 'https://openml.dreamurl.biz'

const LOCALE_MAP: Record<string, string> = {
  en: 'en_US',
  ko: 'ko_KR',
  zh: 'zh_CN',
  ja: 'ja_JP',
  es: 'es_ES',
}

const LANG_LIST = ['en', 'ko', 'zh', 'ja', 'es'] as const

interface HeadProps {
  titleKey: StringKey
  descriptionKey: StringKey
}

function setMeta(name: string, content: string, attr: 'name' | 'property' = 'name') {
  let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setLink(rel: string, href: string, attrs?: Record<string, string>) {
  const selector = attrs
    ? `link[rel="${rel}"]${Object.entries(attrs).map(([k, v]) => `[${k}="${v}"]`).join('')}`
    : `link[rel="${rel}"]`
  let el = document.querySelector(selector) as HTMLLinkElement | null
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    if (attrs) Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v))
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

export function Head({ titleKey, descriptionKey }: HeadProps) {
  const { lang } = useLang()
  const { pathname } = useLocation()

  useEffect(() => {
    const title = t(titleKey, lang)
    const description = t(descriptionKey, lang)
    const keywords = t('seoKeywords', lang)
    const url = `${BASE_URL}${pathname}`

    // Title
    document.title = title

    // HTML lang
    document.documentElement.lang = lang
    document.documentElement.setAttribute('dir', 'ltr')

    // Basic meta
    setMeta('description', description)
    setMeta('keywords', keywords)
    setMeta('author', 'openML')

    // Canonical
    setLink('canonical', url)

    // Open Graph
    setMeta('og:title', title, 'property')
    setMeta('og:description', description, 'property')
    setMeta('og:type', 'website', 'property')
    setMeta('og:url', url, 'property')
    setMeta('og:site_name', 'openML', 'property')
    setMeta('og:locale', LOCALE_MAP[lang] || 'en_US', 'property')

    // Twitter Card
    setMeta('twitter:card', 'summary', 'name')
    setMeta('twitter:title', title, 'name')
    setMeta('twitter:description', description, 'name')

    // hreflang alternate links
    for (const l of LANG_LIST) {
      setLink('alternate', `${BASE_URL}${pathname}`, { hreflang: l })
    }
    setLink('alternate', `${BASE_URL}${pathname}`, { hreflang: 'x-default' })

    // JSON-LD Schema
    const schemaId = 'openml-jsonld'
    let script = document.getElementById(schemaId) as HTMLScriptElement | null
    if (!script) {
      script = document.createElement('script')
      script.id = schemaId
      script.type = 'application/ld+json'
      document.head.appendChild(script)
    }
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'openML',
      url: BASE_URL,
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Any',
      browserRequirements: 'Requires JavaScript and WebGL',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      description: t('seoAppDescription', lang),
      inLanguage: LANG_LIST.map(l => LOCALE_MAP[l]),
      featureList: [
        'Multiple Regression',
        'Logistic Regression',
        'Random Forest',
        'Neural Network (ANN)',
        'XGBoost',
        'K-Means Clustering',
        'PCA',
      ],
    })
  }, [lang, pathname, titleKey, descriptionKey])

  return null
}
