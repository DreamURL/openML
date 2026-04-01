import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useLang } from '@/context/LangContext'
import { t, type StringKey } from '@/i18n/strings'
import { BASE_URL, LANGS, buildLocalizedUrl, sanitizeSeoText } from '@/utils/seo'

const LOCALE_MAP: Record<string, string> = {
  en: 'en_US',
  ko: 'ko_KR',
  zh: 'zh_CN',
  ja: 'ja_JP',
  es: 'es_ES',
}

interface HeadProps {
  titleKey: StringKey
  descriptionKey: StringKey
  noIndex?: boolean
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

export function Head({ titleKey, descriptionKey, noIndex = false }: HeadProps) {
  const { lang } = useLang()
  const { pathname, search } = useLocation()

  useEffect(() => {
    const title = sanitizeSeoText(t(titleKey, lang))
    const description = sanitizeSeoText(t(descriptionKey, lang))
    const keywords = t('seoKeywords', lang)
    const url = buildLocalizedUrl(pathname, search, lang)
    const shouldIndex = !noIndex && pathname === '/'
    const robots = shouldIndex
      ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
      : 'noindex, follow'

    document.title = title
    document.documentElement.lang = lang
    document.documentElement.setAttribute('dir', 'ltr')

    setMeta('description', description)
    setMeta('keywords', keywords)
    setMeta('author', 'openML')
    setMeta('robots', robots)
    setMeta('googlebot', robots)

    setLink('canonical', url)

    setMeta('og:title', title, 'property')
    setMeta('og:description', description, 'property')
    setMeta('og:type', 'website', 'property')
    setMeta('og:url', url, 'property')
    setMeta('og:site_name', 'openML', 'property')
    setMeta('og:image', `${BASE_URL}/openGraphic_openML.jpg`, 'property')
    setMeta('og:image:alt', 'openML browser machine learning preview', 'property')
    setMeta('og:locale', LOCALE_MAP[lang] || 'en_US', 'property')

    setMeta('twitter:card', 'summary_large_image')
    setMeta('twitter:title', title)
    setMeta('twitter:description', description)
    setMeta('twitter:image', `${BASE_URL}/openGraphic_openML.jpg`)
    setMeta('twitter:image:alt', 'openML browser machine learning preview')

    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((link) => link.remove())
    if (shouldIndex) {
      for (const locale of LANGS) {
        setLink('alternate', buildLocalizedUrl(pathname, search, locale), { hreflang: locale })
      }
      setLink('alternate', `${BASE_URL}/`, { hreflang: 'x-default' })
    }

    const schemaId = 'openml-jsonld'
    let script = document.getElementById(schemaId) as HTMLScriptElement | null
    if (!script) {
      script = document.createElement('script')
      script.id = schemaId
      script.type = 'application/ld+json'
      document.head.appendChild(script)
    }

    script.textContent = JSON.stringify(
      shouldIndex
        ? [
            {
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'openML',
              url,
              description,
              inLanguage: lang,
            },
            {
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'openML',
              url,
              applicationCategory: 'EducationalApplication',
              operatingSystem: 'Any',
              isAccessibleForFree: true,
              browserRequirements: 'Requires JavaScript and WebGL',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
              },
              description,
              availableLanguage: LANGS.map((item) => LOCALE_MAP[item]),
              featureList: [
                'Multiple Regression',
                'Logistic Regression',
                'Random Forest',
                'Neural Network (ANN)',
                'XGBoost',
                'K-Means Clustering',
                'PCA',
              ],
            },
          ]
        : {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: title,
            url,
            description,
            inLanguage: lang,
          },
    )
  }, [descriptionKey, lang, noIndex, pathname, search, titleKey])

  return null
}
