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

// scripts/generate-sitemap.ts
var generate_sitemap_exports = {};
__export(generate_sitemap_exports, {
  generateSitemap: () => generateSitemap,
  writeSitemap: () => writeSitemap
});
module.exports = __toCommonJS(generate_sitemap_exports);
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));

// frontend/src/lib/seo-config.ts
var SITE_URL = "https://mockifyer.dev";
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

// scripts/generate-sitemap.ts
var ROUTE_CONFIG = {
  "/": { priority: "1.0", changefreq: "weekly" },
  "/getting-started": { priority: "0.9", changefreq: "monthly" },
  "/features": { priority: "0.8", changefreq: "monthly" },
  "/faq": { priority: "0.8", changefreq: "monthly" },
  "/packages": { priority: "0.8", changefreq: "monthly" },
  "/dashboard": { priority: "0.8", changefreq: "monthly" },
  "/e2e-tutorial": { priority: "0.8", changefreq: "monthly" },
  "/comparisons": { priority: "0.7", changefreq: "monthly" },
  "/config-reference": { priority: "0.7", changefreq: "monthly" },
  "/date-config": { priority: "0.7", changefreq: "monthly" },
  "/guides/mock-at-the-network-edge": { priority: "0.7", changefreq: "monthly" },
  "/guides/mock-drift": { priority: "0.7", changefreq: "monthly" },
  "/guides/react-native-without-msw": { priority: "0.7", changefreq: "monthly" },
  "/guides/reproduce-tester-bugs": { priority: "0.7", changefreq: "monthly" },
  "/guides/stable-react-native-e2e": { priority: "0.7", changefreq: "monthly" },
  "/guides/browser-record-replay": { priority: "0.7", changefreq: "monthly" },
  "/contact": { priority: "0.5", changefreq: "yearly" }
};
var ROUTES = Object.keys(PAGE_SEO).map((loc) => ({
  loc,
  priority: ROUTE_CONFIG[loc]?.priority || "0.5",
  changefreq: ROUTE_CONFIG[loc]?.changefreq || "monthly"
}));
function generateSitemap() {
  const lastmod = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const urls = ROUTES.map(
    (route) => `  <url>
    <loc>${SITE_URL}${route.loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}
function writeSitemap() {
  const sitemap = generateSitemap();
  const outputPath = import_path.default.join(__dirname, "../public/sitemap.xml");
  import_fs.default.writeFileSync(outputPath, sitemap, "utf-8");
  console.log(`\u2713 Sitemap generated: ${outputPath}`);
}
if (require.main === module) {
  writeSitemap();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  generateSitemap,
  writeSitemap
});
