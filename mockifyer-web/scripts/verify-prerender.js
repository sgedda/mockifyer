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

// scripts/verify-prerender.ts
var verify_prerender_exports = {};
__export(verify_prerender_exports, {
  verify: () => verify
});
module.exports = __toCommonJS(verify_prerender_exports);
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));

// frontend/src/lib/seo-config.ts
var SITE_URL = "https://mockifyer.dev";
var DEFAULT_TITLE = "Mockifyer \u2014 Record & Replay HTTP API Mocks";
var DEFAULT_DESCRIPTION = "Open-source API mocking for JavaScript and React Native. Record and replay HTTP calls, tweak fields in a dashboard, catch API drift in CI. Mocks stay in your repo.";
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
  "/guides/mockifyer-atlas": {
    title: "Visualize Architecture with Mockifyer Atlas",
    description: "Generate interactive traffic maps from recorded HTTP hops. See hosts, request chains, search payloads, and trace multi-service flows.",
    path: "/guides/mockifyer-atlas"
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

// scripts/verify-prerender.ts
var HOMEPAGE_CANONICAL = `${SITE_URL}/`;
function htmlPathForRoute(publicDir, routePath) {
  if (routePath === "/") {
    return import_path.default.join(publicDir, "index.html");
  }
  return import_path.default.join(publicDir, `${routePath.replace(/^\//, "")}.html`);
}
function verify() {
  const publicDir = import_path.default.join(__dirname, "../public");
  const failures = [];
  const titles = /* @__PURE__ */ new Map();
  if (!import_fs.default.existsSync(import_path.default.join(publicDir, "index.html"))) {
    console.error("\u274C public/index.html missing \u2014 run frontend build + prerender first");
    process.exit(1);
  }
  if (!import_fs.default.existsSync(import_path.default.join(publicDir, "404.html"))) {
    failures.push({ route: "/404", reason: "404.html missing" });
  } else {
    const notFoundHtml = import_fs.default.readFileSync(import_path.default.join(publicDir, "404.html"), "utf-8");
    if (!/name="robots"\s+content="[^"]*noindex/i.test(notFoundHtml)) {
      failures.push({ route: "/404", reason: "missing noindex robots meta" });
    }
    if (!/<h1[\s>]/.test(notFoundHtml)) {
      failures.push({ route: "/404", reason: "missing <h1>" });
    }
  }
  for (const routePath of Object.keys(PAGE_SEO)) {
    const filePath = htmlPathForRoute(publicDir, routePath);
    if (!import_fs.default.existsSync(filePath)) {
      failures.push({ route: routePath, reason: `missing file ${import_path.default.relative(publicDir, filePath)}` });
      continue;
    }
    const html = import_fs.default.readFileSync(filePath, "utf-8");
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const canonicalMatch = html.match(/<link rel="canonical" href="([^"]+)"/i);
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const expectedCanonical = routePath === "/" ? HOMEPAGE_CANONICAL : `${SITE_URL}${routePath}`;
    if (!titleMatch?.[1]?.trim()) {
      failures.push({ route: routePath, reason: "missing <title>" });
    } else {
      const title = titleMatch[1];
      const previous = titles.get(title);
      if (previous && previous !== routePath) {
        failures.push({
          route: routePath,
          reason: `duplicate title with ${previous}: ${title}`
        });
      }
      titles.set(title, routePath);
    }
    if (!canonicalMatch?.[1]) {
      failures.push({ route: routePath, reason: "missing canonical" });
    } else if (canonicalMatch[1] !== expectedCanonical) {
      failures.push({
        route: routePath,
        reason: `canonical is ${canonicalMatch[1]}, expected ${expectedCanonical}`
      });
    } else if (routePath !== "/" && canonicalMatch[1] === HOMEPAGE_CANONICAL) {
      failures.push({
        route: routePath,
        reason: "canonical points at homepage"
      });
    }
    if (!h1Match?.[1]?.trim()) {
      failures.push({ route: routePath, reason: "missing <h1> in initial HTML" });
    }
    if (routePath !== "/" && /id="root"><\/div>/.test(html)) {
      failures.push({ route: routePath, reason: "empty #root (SPA shell only)" });
    }
  }
  if (failures.length > 0) {
    console.error("\u274C Prerender verification failed:\n");
    for (const failure of failures) {
      console.error(`  - ${failure.route}: ${failure.reason}`);
    }
    process.exit(1);
  }
  console.log(
    `\u2705 Prerender verification passed for ${Object.keys(PAGE_SEO).length} sitemap HTML routes + 404.html`
  );
}
if (require.main === module) {
  verify();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  verify
});
