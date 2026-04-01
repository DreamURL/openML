import type { Lang } from '@/i18n/strings'

export const BASE_URL = 'https://openml.dreamurl.biz'
export const LANGS: Lang[] = ['en', 'ko', 'zh', 'ja', 'es']

export function isLang(value: string | null): value is Lang {
  return value === 'en' || value === 'ko' || value === 'zh' || value === 'ja' || value === 'es'
}

export function buildLocalizedPath(pathname: string, search: string, lang: Lang): string {
  const params = new URLSearchParams(search)

  if (lang === 'en') {
    params.delete('lang')
  } else {
    params.set('lang', lang)
  }

  const query = params.toString()
  return `${pathname}${query ? `?${query}` : ''}`
}

export function buildLocalizedUrl(pathname: string, search: string, lang: Lang): string {
  return `${BASE_URL}${buildLocalizedPath(pathname, search, lang)}`
}

export function sanitizeSeoText(value: string): string {
  return value.replace(/\s*\?\?\s*/g, ' - ').replace(/\s+/g, ' ').trim()
}
