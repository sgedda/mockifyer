import { useLocation } from 'react-router-dom'
import { getPageSeo, NOT_FOUND_SEO } from '@/lib/seo'
import { usePageSeo } from '@/lib/use-page-seo'

export default function PageSeoManager() {
  const { pathname } = useLocation()
  const seoConfig = getPageSeo(pathname) || NOT_FOUND_SEO
  usePageSeo(seoConfig)
  return null
}
