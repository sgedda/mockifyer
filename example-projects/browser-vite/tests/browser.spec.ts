import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

test.describe('Browser Mockifyer Example', () => {
  test('should display mocked and live results correctly', async ({ page }) => {
    // Capture console logs
    const consoleLogs: string[] = []
    page.on('console', msg => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`)
    })

    await page.goto('/?test=true')
    
    // Wait for both requests to complete and UI to update
    await page.waitForFunction(() => {
      const mockedBadge = document.getElementById('mocked-badge')?.textContent || ''
      const liveBadge = document.getElementById('live-badge')?.textContent || ''
      const mockedData = document.getElementById('mocked-data')?.textContent || ''
      const liveData = document.getElementById('live-data')?.textContent || ''
      
      // Both must have loaded (not Loading/Fetching) and live must have test-server data
      return !mockedData.includes('Loading') && !mockedData.includes('Fetching') &&
             !liveData.includes('Loading') && !liveData.includes('Fetching') &&
             (liveBadge === 'LIVE' || liveBadge === 'ERROR') &&  // Must be resolved
             liveData.includes('test-server')  // Must have actual data
    }, { timeout: 15000 })

    // Verify mocked request (uses preloaded fixture)
    const mockedBadge = await page.textContent('#mocked-badge')
    expect(mockedBadge).toBe('MOCKED')

    const mockedStatus = await page.textContent('#mocked-status')
    expect(mockedStatus).toContain('200')
    expect(mockedStatus).toContain('fixture')

    const mockedData = await page.textContent('#mocked-data')
    expect(mockedData).toContain('"base": "USD"')
    expect(mockedData).toContain('"date": "2024-01-15"')
    expect(mockedData).toContain('"EUR": 0.92')

    // Verify live request (no fixture, goes to real API)
    const liveBadge = await page.textContent('#live-badge')
    expect(liveBadge).toBe('LIVE')

    const liveStatus = await page.textContent('#live-status')
    expect(liveStatus).toContain('200')
    expect(liveStatus).toContain('network')

    const liveData = await page.textContent('#live-data')
    
    // Verify live request went to test server (proves no fixture was used)
    expect(liveData).toContain('"source"')
    expect(liveData).toContain('test-server')
    expect(liveData).toContain('"timestamp"')
    
    // Verify it's different from fixture data
    expect(liveData).not.toContain('USD')
    expect(liveData).not.toContain('EUR')
    expect(liveData).not.toContain('2024-01-15')

    // Verify Mockifyer initialized
    const mockifyerLog = consoleLogs.find(log => log.includes('[Mockifyer] Initialized'))
    expect(mockifyerLog).toBeTruthy()
    
    console.log('✓ Mocked request returned fixture data')
    console.log('✓ Live request returned test server data (no fixture used)')
  })

  test('production bundle should have no Node built-ins', async ({ page }) => {
    // Build the app
    const { execSync } = await import('child_process')
    const projectRoot = path.join(__dirname, '..')
    
    console.log('Building production bundle...')
    execSync('npm run build', { 
      cwd: projectRoot,
      stdio: 'inherit'
    })

    // Read the built JavaScript files
    const distDir = path.join(projectRoot, 'dist', 'assets')
    const jsFiles = fs.readdirSync(distDir).filter(f => f.endsWith('.js'))
    
    console.log(`Checking ${jsFiles.length} JavaScript files for Node built-ins...`)

    const nodeBuiltins = [
      'require("fs")',
      'require("path")',
      'require("net")',
      'require("http")',
      'require("https")',
      'require("child_process")',
      'require("crypto")',
      'require("os")',
      'require("util")',
      'require("stream")',
      'require("buffer")',
      'require("events")',
      'require("assert")',
      'require("url")',
      'require("querystring")',
      'from "fs"',
      'from "path"',
      'from "net"',
      'from "http"',
      'from "https"',
      'from "child_process"',
      'from "os"',
      'from "util"',
      'from "stream"',
      'from "buffer"',
      'from "events"',
      'from "assert"',
      'from "url"',
      'from "querystring"',
    ]

    let foundBuiltins: string[] = []

    for (const file of jsFiles) {
      const content = fs.readFileSync(path.join(distDir, file), 'utf-8')
      
      for (const builtin of nodeBuiltins) {
        if (content.includes(builtin)) {
          foundBuiltins.push(`${file}: ${builtin}`)
        }
      }
    }

    if (foundBuiltins.length > 0) {
      console.error('❌ Found Node built-ins in production bundle:')
      foundBuiltins.forEach(b => console.error(`  - ${b}`))
      throw new Error(`Production bundle contains ${foundBuiltins.length} Node built-in imports`)
    }

    console.log('✅ No Node built-ins found in production bundle')
  })
})
