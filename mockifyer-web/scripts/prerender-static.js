#!/usr/bin/env ts-node
"use strict";
/**
 * Static HTML generator for SEO - generates per-route HTML files without needing a browser.
 * This runs during the CI build to create prerendered HTML for each route.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prerender = prerender;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Import the SEO configuration
const PAGE_SEO = {
    '/': {
        title: 'Mockifyer — Record & Replay HTTP API Mocks',
        description: 'Record axios and fetch calls as JSON and replay them in Node and React Native. Selective recording by default; mocks stay in your repo.',
        path: '/',
    },
    '/getting-started': {
        title: 'Getting Started with Mockifyer | Mockifyer',
        description: 'Install @sgedda/mockifyer-axios or mockifyer-fetch, configure mock data paths, and start recording or replaying HTTP API responses in minutes.',
        path: '/getting-started',
    },
    '/date-config': {
        title: 'Date Configuration | Mockifyer',
        description: 'Control time in tests with Mockifyer date manipulation — fixed dates, offsets, and deterministic time-dependent API behavior.',
        path: '/date-config',
    },
    '/config-reference': {
        title: 'Configuration Reference | Mockifyer',
        description: 'Complete reference for Mockifyer environment variables, mock data paths, recording modes, and activation settings.',
        path: '/config-reference',
    },
    '/faq': {
        title: 'Mockifyer FAQ: Record-Replay API Mocks | Mockifyer',
        description: 'Frequently asked questions about Mockifyer: how to record API calls, switch scenarios, and use the dashboard and MCP tools.',
        path: '/faq',
    },
    '/contact': {
        title: 'Contact | Mockifyer',
        description: 'Get in touch about Mockifyer — questions, feedback, and support for API mocking and record-replay testing.',
        path: '/contact',
    },
    '/e2e-tutorial': {
        title: 'E2E Tutorial: Multi-Service Mocks | Mockifyer',
        description: 'End-to-end walkthrough using the WanderWeird demo: a multi-service Expo app with scenarios, dashboard control, and nested request tracing.',
        path: '/e2e-tutorial',
    },
    '/guides/mock-at-the-network-edge': {
        title: 'Mock at the Network Edge - Testing Guide | Mockifyer',
        description: 'Stop mocking hooks and components. Mock HTTP at the network edge to test what users see. Real response shapes, survive refactors, catch breaking API changes.',
        path: '/guides/mock-at-the-network-edge',
    },
    '/guides/reproduce-tester-bugs': {
        title: 'Reproduce Tester Bugs Locally - Testing Guide | Mockifyer',
        description: 'Capture API calls from tester devices, trace requests across services via x-mockifyer-request-id, export as curl, and replay bugs locally.',
        path: '/guides/reproduce-tester-bugs',
    },
    '/guides/stable-react-native-e2e': {
        title: 'Stable React Native E2E Tests - Detox, Appium, Maestro | Mockifyer',
        description: 'Stop Detox, Appium, and Maestro flakes. Lock scenarios with launch arguments, freeze dates, and make the backend deterministic.',
        path: '/guides/stable-react-native-e2e',
    },
    '/guides/mock-drift': {
        title: 'Stop Hand-Written API Mocks from Drifting | Mockifyer',
        description: 'Hand-written mocks drift from real APIs. Record real responses, re-record when APIs change, and git diff to catch breaking changes.',
        path: '/guides/mock-drift',
    },
    '/guides/react-native-without-msw': {
        title: 'MSW vs Recording in React Native | Mockifyer',
        description: 'Compare MSW and Mockifyer for React Native. Recording works on device with no service worker, supports Expo and bare React Native.',
        path: '/guides/react-native-without-msw',
    },
    '/guides/browser-record-replay': {
        title: 'Record and Replay HTTP in the Browser | Mockifyer',
        description: 'Use Mockifyer to record and replay HTTP fetch calls in browser environments, Expo web builds, and Vite projects with the memory provider.',
        path: '/guides/browser-record-replay',
    },
    '/features': {
        title: 'Mockifyer Features: Record, Replay, Scenarios | Mockifyer',
        description: 'Selective recording, scenario switching, date freezing, React Native support, GraphQL matching, and a local dashboard for editing mocks.',
        path: '/features',
    },
    '/packages': {
        title: 'Mockifyer npm Packages for Axios and Fetch | Mockifyer',
        description: '@sgedda/mockifyer-core, mockifyer-axios, mockifyer-fetch for recording and replay. Optional dashboard package for browsing mocks.',
        path: '/packages',
    },
    '/dashboard': {
        title: 'Mockifyer Dashboard and MCP Tools | Mockifyer',
        description: 'Local UI and CLI to browse scenarios, edit mocks, visualize traffic, and expose MCP tools to Cursor and Claude Desktop.',
        path: '/dashboard',
    },
    '/comparisons': {
        title: 'Mockifyer vs MSW, Polly.js, and Nock | Mockifyer',
        description: 'Compare Mockifyer with MSW, Polly.js, and Nock. Learn when record-replay fits better than in-code handlers for API testing.',
        path: '/comparisons',
    },
};
const SITE_URL = 'https://mockifyer.dev';
const SITE_NAME = 'Mockifyer';
function formatTitle(title) {
    if (title.includes(SITE_NAME)) {
        return title;
    }
    return `${title} | ${SITE_NAME}`;
}
function generateHtml(routePath, seoConfig, baseHtml) {
    const title = formatTitle(seoConfig.title);
    const canonical = `${SITE_URL}${routePath}`;
    // Replace title
    let html = baseHtml.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);
    // Replace meta description
    html = html.replace(/<meta name="description" content=".*?"(\s*\/)>/, `<meta name="description" content="${seoConfig.description}" />`);
    // Replace canonical
    html = html.replace(/<link rel="canonical" href=".*?"(\s*\/)>/, `<link rel="canonical" href="${canonical}" />`);
    // Replace OG tags
    html = html.replace(/<meta property="og:title" content=".*?"(\s*\/)>/, `<meta property="og:title" content="${title}" />`);
    html = html.replace(/<meta property="og:description" content=".*?"(\s*\/)>/, `<meta property="og:description" content="${seoConfig.description}" />`);
    html = html.replace(/<meta property="og:url" content=".*?"(\s*\/)>/, `<meta property="og:url" content="${canonical}" />`);
    // Replace Twitter tags
    html = html.replace(/<meta name="twitter:title" content=".*?"(\s*\/)>/, `<meta name="twitter:title" content="${title}" />`);
    html = html.replace(/<meta name="twitter:description" content=".*?"(\s*\/)>/, `<meta name="twitter:description" content="${seoConfig.description}" />`);
    // Add visible H1 and intro text inside #root for SEO
    // This provides search engines with visible content before JavaScript loads
    // React will replace this with the actual app content
    const h1Text = seoConfig.title
        .replace(' | Mockifyer', '')
        .replace(' | ' + SITE_NAME, '')
        .replace(' - Testing Guide', '')
        .replace(' - ', ': ');
    const seoContent = `<div id="root"><div style="max-width:1200px;margin:0 auto;padding:2rem"><h1>${h1Text}</h1><p>${seoConfig.description}</p><noscript><p>This site requires JavaScript to be enabled.</p></noscript></div></div>`;
    html = html.replace(/<div id="root"><\/div>/, seoContent);
    return html;
}
async function prerender() {
    const publicDir = path_1.default.join(__dirname, '../public');
    const indexPath = path_1.default.join(publicDir, 'index.html');
    if (!fs_1.default.existsSync(indexPath)) {
        console.error('❌ public/index.html not found. Run frontend build first.');
        process.exit(1);
    }
    console.log('📄 Starting static HTML generation for SEO...');
    // Read the original template ONCE before any modifications
    const baseHtml = fs_1.default.readFileSync(indexPath, 'utf-8');
    let count = 0;
    for (const [routePath, seoConfig] of Object.entries(PAGE_SEO)) {
        // Use the original baseHtml for all routes (not the modified one)
        const generatedHtml = generateHtml(routePath, seoConfig, baseHtml);
        if (routePath === '/') {
            // Homepage is index.html
            fs_1.default.writeFileSync(indexPath, generatedHtml, 'utf-8');
            console.log(`  ✓ / → index.html`);
            count++;
            continue;
        }
        // Create nested directories if needed
        const routePathClean = routePath.substring(1); // Remove leading slash
        const routeDir = path_1.default.dirname(routePathClean);
        if (routeDir && routeDir !== '.') {
            const fullDir = path_1.default.join(publicDir, routeDir);
            fs_1.default.mkdirSync(fullDir, { recursive: true });
        }
        const outputPath = path_1.default.join(publicDir, `${routePathClean}.html`);
        fs_1.default.writeFileSync(outputPath, generatedHtml, 'utf-8');
        console.log(`  ✓ ${routePath} → ${routePathClean}.html`);
        count++;
    }
    console.log(`\n✅ Generated ${count} static HTML files for SEO`);
}
// Run if called directly
if (require.main === module) {
    prerender().catch((error) => {
        console.error('❌ Static HTML generation failed:', error);
        process.exit(1);
    });
}
