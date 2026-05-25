import { useEffect } from 'react'
import { HOME_FAQ } from './faq'
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_KEYWORDS,
  DEFAULT_TITLE,
  HERO_TAGLINE,
  OG_IMAGE_URL,
  SITE_NAME,
  SITE_URL,
  TWITTER_HANDLE,
  absoluteUrl,
  buildFaqPageJsonLd,
  buildSoftwareApplicationJsonLd,
  formatPageTitle,
  type PageSeoConfig,
} from './seo'

const JSON_LD_ID = 'mockifyer-json-ld'
const FAQ_JSON_LD_ID = 'mockifyer-faq-json-ld'

function upsertMeta(name: string, content: string, attribute: 'name' | 'property' = 'name'): void {
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[${attribute}="${name}"]`,
  )

  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, name)
    document.head.appendChild(element)
  }

  element.content = content
}

function upsertLink(rel: string, href: string): void {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)

  if (!element) {
    element = document.createElement('link')
    element.rel = rel
    document.head.appendChild(element)
  }

  element.href = href
}

function upsertJsonLd(
  id: string,
  data: Record<string, unknown> | null,
): void {
  let element = document.getElementById(id) as HTMLScriptElement | null

  if (!data) {
    element?.remove()
    return
  }

  if (!element) {
    element = document.createElement('script')
    element.id = id
    element.type = 'application/ld+json'
    document.head.appendChild(element)
  }

  element.textContent = JSON.stringify(data)
}

/**
 * Updates document title and head meta tags for the active route.
 */
export function usePageSeo(config: PageSeoConfig): void {
  useEffect(() => {
    const title = formatPageTitle(config.title)
    const description = config.description
    const canonicalUrl = absoluteUrl(config.path ?? '/')
    const robots = config.noIndex ? 'noindex, nofollow' : 'index, follow'

    document.title = title

    upsertMeta('description', description)
    upsertMeta('keywords', DEFAULT_KEYWORDS)
    upsertMeta('author', 'Sebastian Gedda')
    upsertMeta('robots', robots)

    upsertLink('canonical', canonicalUrl)

    upsertMeta('og:site_name', SITE_NAME, 'property')
    upsertMeta('og:type', 'website', 'property')
    upsertMeta('og:title', title, 'property')
    upsertMeta('og:description', description, 'property')
    upsertMeta('og:url', canonicalUrl, 'property')
    upsertMeta('og:locale', 'en_US', 'property')
    upsertMeta('og:image', OG_IMAGE_URL, 'property')
    upsertMeta('og:image:width', '1200', 'property')
    upsertMeta('og:image:height', '630', 'property')
    upsertMeta('og:image:alt', `${SITE_NAME} — Record & Replay HTTP API Mocks`, 'property')

    upsertMeta('twitter:card', 'summary_large_image')
    upsertMeta('twitter:image', OG_IMAGE_URL)
    upsertMeta('twitter:site', TWITTER_HANDLE)
    upsertMeta('twitter:title', title)
    upsertMeta('twitter:description', description)

    const isHome = config.path === '/'
    upsertJsonLd(JSON_LD_ID, isHome ? buildSoftwareApplicationJsonLd() : null)
    upsertJsonLd(FAQ_JSON_LD_ID, isHome ? buildFaqPageJsonLd(HOME_FAQ) : null)

    return () => {
      document.title = DEFAULT_TITLE
      upsertMeta('description', DEFAULT_DESCRIPTION)
      upsertLink('canonical', SITE_URL)
      upsertMeta('og:title', DEFAULT_TITLE, 'property')
      upsertMeta('og:description', DEFAULT_DESCRIPTION, 'property')
      upsertMeta('og:url', SITE_URL, 'property')
      upsertMeta('twitter:title', DEFAULT_TITLE)
      upsertMeta('twitter:description', DEFAULT_DESCRIPTION)
      upsertMeta('og:image', OG_IMAGE_URL, 'property')
      upsertMeta('twitter:image', OG_IMAGE_URL)
      upsertJsonLd(JSON_LD_ID, buildSoftwareApplicationJsonLd())
      upsertJsonLd(FAQ_JSON_LD_ID, buildFaqPageJsonLd(HOME_FAQ))
    }
  }, [config.description, config.noIndex, config.path, config.title])
}

export { HERO_TAGLINE }
