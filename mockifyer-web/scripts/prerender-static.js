#!/usr/bin/env ts-node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// scripts/prerender-static.ts
var prerender_static_exports = {};
__export(prerender_static_exports, {
  prerender: () => prerender
});
module.exports = __toCommonJS(prerender_static_exports);
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));

// frontend/src/lib/seo-config.ts
var SITE_URL = "https://mockifyer.dev";
var SITE_NAME = "Mockifyer";
var DEFAULT_TITLE = "Mockifyer \u2014 Record & Replay HTTP API Mocks";
var DEFAULT_DESCRIPTION = "Record axios and fetch calls as JSON and replay them in Node and React Native. Selective recording by default; mocks stay in your repo.";
var PAGE_SEO = {
  "/": {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    path: "/"
  },
  "/getting-started": {
    title: "Getting Started with Mockifyer",
    description: "Install @sgedda/mockifyer-axios or mockifyer-fetch, configure mock data paths, and start recording or replaying HTTP API responses in minutes.",
    path: "/getting-started"
  },
  "/date-config": {
    title: "Date Configuration",
    description: "Control time in tests with Mockifyer date manipulation \u2014 fixed dates, offsets, and deterministic time-dependent API behavior.",
    path: "/date-config"
  },
  "/config-reference": {
    title: "Configuration Reference",
    description: "Complete reference for Mockifyer environment variables, mock data paths, recording modes, and activation settings.",
    path: "/config-reference"
  },
  "/faq": {
    title: "Mockifyer FAQ: Record-Replay API Mocks",
    description: "Frequently asked questions about Mockifyer: how to record API calls, switch scenarios, and use the dashboard and MCP tools.",
    path: "/faq"
  },
  "/contact": {
    title: "Contact",
    description: "Get in touch about Mockifyer \u2014 questions, feedback, and support for API mocking and record-replay testing.",
    path: "/contact"
  },
  "/e2e-tutorial": {
    title: "E2E Tutorial: Multi-Service Mocks",
    description: "End-to-end walkthrough using the WanderWeird demo: a multi-service Expo app with scenarios, dashboard control, and nested request tracing.",
    path: "/e2e-tutorial"
  },
  "/guides/mock-at-the-network-edge": {
    title: "Mock at the Network Edge - Testing Guide",
    description: "Stop mocking hooks and components. Mock HTTP at the network edge to test what users see. Real response shapes, survive refactors, catch breaking API changes.",
    path: "/guides/mock-at-the-network-edge"
  },
  "/guides/reproduce-tester-bugs": {
    title: "Reproduce Tester Bugs Locally - Testing Guide",
    description: "Capture API calls from tester devices, trace requests across services via x-mockifyer-request-id, export as curl, and replay bugs locally.",
    path: "/guides/reproduce-tester-bugs"
  },
  "/guides/stable-react-native-e2e": {
    title: "Stable React Native E2E Tests - Detox, Appium, Maestro",
    description: "Stop Detox, Appium, and Maestro flakes. Lock scenarios with launch arguments, freeze dates, and make the backend deterministic.",
    path: "/guides/stable-react-native-e2e"
  },
  "/guides/mock-drift": {
    title: "Stop Hand-Written API Mocks from Drifting",
    description: "Hand-written mocks drift from real APIs. Record real responses, re-record when APIs change, and git diff to catch breaking changes.",
    path: "/guides/mock-drift"
  },
  "/guides/react-native-without-msw": {
    title: "MSW vs Recording in React Native",
    description: "Compare MSW and Mockifyer for React Native. Recording works on device with no service worker, supports Expo and bare React Native.",
    path: "/guides/react-native-without-msw"
  },
  "/guides/browser-record-replay": {
    title: "Record and Replay HTTP in the Browser",
    description: "Use Mockifyer to record and replay HTTP fetch calls in browser environments, Expo web builds, and Vite projects with the memory provider.",
    path: "/guides/browser-record-replay"
  },
  "/features": {
    title: "Mockifyer Features: Record, Replay, Scenarios",
    description: "Selective recording, scenario switching, date freezing, React Native support, GraphQL matching, and a local dashboard for editing mocks.",
    path: "/features"
  },
  "/packages": {
    title: "Mockifyer npm Packages for Axios and Fetch",
    description: "@sgedda/mockifyer-core, mockifyer-axios, mockifyer-fetch for recording and replay. Optional dashboard package for browsing mocks.",
    path: "/packages"
  },
  "/dashboard": {
    title: "Mockifyer Dashboard and MCP Tools",
    description: "Local UI and CLI to browse scenarios, edit mocks, visualize traffic, and expose MCP tools to Cursor and Claude Desktop.",
    path: "/dashboard"
  },
  "/comparisons": {
    title: "Mockifyer vs MSW, Polly.js, and Nock",
    description: "Compare Mockifyer with MSW, Polly.js, and Nock. Learn when record-replay fits better than in-code handlers for API testing.",
    path: "/comparisons"
  }
};
function formatPageTitle(title) {
  if (title.includes("\u2014")) {
    return title;
  }
  if (title.endsWith(` | ${SITE_NAME}`)) {
    return title;
  }
  return `${title} | ${SITE_NAME}`;
}

// scripts/prerender-static.ts
function generateHtml(routePath, seoConfig, baseHtml) {
  const title = formatPageTitle(seoConfig.title);
  const canonical = `${SITE_URL}${routePath}`;
  let html = baseHtml.replace(
    /<title>.*?<\/title>/,
    `<title>${title}</title>`
  );
  html = html.replace(
    /<meta name="description"[\s\S]*?content=".*?"[\s\S]*?\/>/,
    `<meta name="description" content="${seoConfig.description}" />`
  );
  html = html.replace(
    /<link rel="canonical" href=".*?"(\s*\/)>/,
    `<link rel="canonical" href="${canonical}" />`
  );
  html = html.replace(
    /<meta property="og:title" content=".*?"(\s*\/)>/,
    `<meta property="og:title" content="${title}" />`
  );
  html = html.replace(
    /<meta property="og:description"[\s\S]*?content=".*?"[\s\S]*?\/>/,
    `<meta property="og:description" content="${seoConfig.description}" />`
  );
  html = html.replace(
    /<meta property="og:url" content=".*?"(\s*\/)>/,
    `<meta property="og:url" content="${canonical}" />`
  );
  html = html.replace(
    /<meta name="twitter:title" content=".*?"(\s*\/)>/,
    `<meta name="twitter:title" content="${title}" />`
  );
  html = html.replace(
    /<meta name="twitter:description"[\s\S]*?content=".*?"[\s\S]*?\/>/,
    `<meta name="twitter:description" content="${seoConfig.description}" />`
  );
  html = html.replace(
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
    ""
  );
  const h1Text = seoConfig.title.replace(" | Mockifyer", "").replace(" | " + SITE_NAME, "").replace(" - Testing Guide", "").replace(" - ", ": ");
  const seoContent = `<div id="root"><div style="max-width:1200px;margin:0 auto;padding:2rem"><h1>${h1Text}</h1><p>${seoConfig.description}</p><noscript><p>This site requires JavaScript to be enabled.</p></noscript></div></div>`;
  html = html.replace(
    /<div id="root"><\/div>/,
    seoContent
  );
  return html;
}
async function prerender() {
  const publicDir = import_path.default.join(__dirname, "../public");
  const indexPath = import_path.default.join(publicDir, "index.html");
  if (!import_fs.default.existsSync(indexPath)) {
    console.error("\u274C public/index.html not found. Run frontend build first.");
    process.exit(1);
  }
  console.log("\u{1F4C4} Starting static HTML generation for SEO...");
  const baseHtml = import_fs.default.readFileSync(indexPath, "utf-8");
  let count = 0;
  for (const [routePath, seoConfig] of Object.entries(PAGE_SEO)) {
    const generatedHtml = generateHtml(routePath, seoConfig, baseHtml);
    if (routePath === "/") {
      import_fs.default.writeFileSync(indexPath, generatedHtml, "utf-8");
      console.log(`  \u2713 / \u2192 index.html`);
      count++;
      continue;
    }
    const routePathClean = routePath.substring(1);
    const routeDir = import_path.default.dirname(routePathClean);
    if (routeDir && routeDir !== ".") {
      const fullDir = import_path.default.join(publicDir, routeDir);
      import_fs.default.mkdirSync(fullDir, { recursive: true });
    }
    const outputPath = import_path.default.join(publicDir, `${routePathClean}.html`);
    import_fs.default.writeFileSync(outputPath, generatedHtml, "utf-8");
    console.log(`  \u2713 ${routePath} \u2192 ${routePathClean}.html`);
    count++;
  }
  console.log(`
\u2705 Generated ${count} static HTML files for SEO`);
}
if (require.main === module) {
  prerender().catch((error) => {
    console.error("\u274C Static HTML generation failed:", error);
    process.exit(1);
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  prerender
});
