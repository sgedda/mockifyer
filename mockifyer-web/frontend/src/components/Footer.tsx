import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { GUIDE_ITEMS } from '@/lib/product-docs'

export default function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30 mt-20">
      <div className="mx-auto max-w-[1200px] px-5 py-12">
        <div className="grid md:grid-cols-4 gap-8">
          <div>
            <h3 className="font-semibold mb-4">Resources</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/getting-started" className="hover:text-foreground transition-colors">
                  Getting Started
                </Link>
              </li>
              <li>
                <Link to="/features" className="hover:text-foreground transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link to="/faq" className="hover:text-foreground transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <Link to="/e2e-tutorial" className="hover:text-foreground transition-colors">
                  E2E Tutorial
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold mb-4">Documentation</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/config-reference" className="hover:text-foreground transition-colors">
                  Config Reference
                </Link>
              </li>
              <li>
                <Link to="/date-config" className="hover:text-foreground transition-colors">
                  Date Config
                </Link>
              </li>
              <li>
                <Link to="/packages" className="hover:text-foreground transition-colors">
                  Packages
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="hover:text-foreground transition-colors">
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold mb-4">Guides</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {GUIDE_ITEMS.map((guide) => (
                <li key={guide.href}>
                  <Link to={guide.href} className="hover:text-foreground transition-colors">
                    {guide.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold mb-4">More</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/comparisons" className="hover:text-foreground transition-colors">
                  Comparisons
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-foreground transition-colors">
                  Contact
                </Link>
              </li>
              <li>
                <a 
                  href="https://github.com/sgedda/mockifyer" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors inline-flex items-center gap-1"
                >
                  GitHub
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li className="pt-2 text-xs">
                MIT License
              </li>
            </ul>
          </div>
        </div>
        
        <div className="mt-12 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>No account, no cloud, no telemetry — everything runs locally</p>
        </div>
      </div>
    </footer>
  )
}
