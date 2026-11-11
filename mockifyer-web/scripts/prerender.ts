import { launch } from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Core routes
const CORE_ROUTES = [
  '/',
  '/getting-started',
  '/date-config',
  '/config-reference',
  '/contact',
  '/e2e-tutorial',
  '/features',
  '/faq',
  '/packages',
  '/dashboard',
  '/comparisons',
  '/guides',
];

async function getContentRoutes() {
  try {
    const { getAllExistingContent } = await import('../frontend/src/lib/content-registry.js');
    const contentPages = getAllExistingContent();
    return contentPages.map((item) => item.path);
  } catch (e) {
    console.warn('Could not load content registry, using core routes only');
    return [];
  }
}

async function prerender() {
  const contentRoutes = await getContentRoutes();
  const ROUTES = [...CORE_ROUTES, ...contentRoutes];
  const publicDir = path.join(__dirname, '../../public');
  
  // Use the built static files - serve them via http-server or similar
  // For now, we'll prerender from the Vite preview server
  // In production build: npm run build:frontend creates the public/ dir
  const baseUrl = process.env.PRERENDER_URL || 'http://localhost:4173';

  console.log('Starting prerender...');
  console.log(`Public directory: ${publicDir}`);
  console.log(`Base URL: ${baseUrl}`);
  console.log('Note: Make sure the preview server is running (npm run preview:frontend)');

  const browser = await launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    for (const route of ROUTES) {
      console.log(`Prerendering ${route}...`);
      
      const page = await browser.newPage();
      
      // Set a reasonable viewport
      await page.setViewport({ width: 1280, height: 720 });
      
      // Navigate and wait for network to be idle
      await page.goto(`${baseUrl}${route}`, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });

      // Wait a bit more for React to fully render and SEO updates to apply
      await page.waitForTimeout(1000);

      // Get the fully rendered HTML
      const html = await page.content();

      // Determine output path
      let outputPath: string;
      if (route === '/') {
        outputPath = path.join(publicDir, 'index.html');
      } else {
        // Create nested directories if needed
        const routePath = route.substring(1); // Remove leading slash
        const routeDir = path.dirname(routePath);
        
        if (routeDir && routeDir !== '.') {
          const fullDir = path.join(publicDir, routeDir);
          fs.mkdirSync(fullDir, { recursive: true });
        }
        
        outputPath = path.join(publicDir, `${routePath}.html`);
      }

      // Write the HTML file
      fs.writeFileSync(outputPath, html, 'utf-8');
      console.log(`  ✓ Saved to ${outputPath}`);

      await page.close();
    }

    console.log('\n✓ Prerendering complete!');
  } catch (error) {
    console.error('Error during prerendering:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Run
prerender().catch((error) => {
  console.error('Prerender failed:', error);
  process.exit(1);
});

export { prerender };
