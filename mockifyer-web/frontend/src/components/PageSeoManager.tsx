import { useLocation } from 'react-router-dom'
import { getPageSeo } from '@/lib/seo'
import { usePageSeo } from '@/lib/use-page-seo'

export default function PageSeoManager() {
  const { pathname } = useLocation()
  usePageSeo(getPageSeo(pathname))
  return null
}
