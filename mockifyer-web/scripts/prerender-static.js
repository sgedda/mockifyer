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
  HOMEPAGE_CANONICAL: () => HOMEPAGE_CANONICAL,
  NOT_FOUND_SEO: () => NOT_FOUND_SEO,
  PAGE_SEO: () => PAGE_SEO,
  SITE_NAME: () => SITE_NAME,
  SITE_URL: () => SITE_URL,
  formatPageTitle: () => formatPageTitle,
  generateHtml: () => generateHtml,
  normalizeShellHtml: () => normalizeShellHtml,
  prerender: () => prerender
});
module.exports = __toCommonJS(prerender_static_exports);
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));

// frontend/src/lib/seo-config.ts
var SITE_URL = "https://mockifyer.dev";
var SITE_NAME = "Mockifyer";
var DEFAULT_TITLE = "Mockifyer \u2014 Record & Replay HTTP API Mocks";
var DEFAULT_DESCRIPTION = "Open-source API mocking for JavaScript and React Native. Record and replay HTTP, edit mocks in a dashboard, catch API drift in CI. Mocks stay in your repo.";
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
  "/guides": {
    title: "Mockifyer Guides",
    description: "Practical guides for record-replay API mocking: network-edge testing, React Native E2E, mock drift, Atlas maps, and browser record-replay.",
    path: "/guides"
  },
  "/guides/mock-at-the-network-edge": {
    title: "Mock at the Network Edge - Testing Guide",
    description: "Stop mocking hooks and components. Mock HTTP at the network edge to test what users see. Real shapes, survive refactors, catch API breaks.",
    path: "/guides/mock-at-the-network-edge"
  },
  "/guides/reproduce-tester-bugs": {
    title: "Reproduce Tester Bugs Locally - Testing Guide",
    description: "Capture API calls from tester devices, trace requests across services via x-mockifyer-request-id, export as curl, and replay bugs locally.",
    path: "/guides/reproduce-tester-bugs"
  },
  "/guides/stable-react-native-e2e": {
    title: "Stable React Native E2E: Detox & Maestro",
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
  },
  "/atlas/wanderweird": {
    title: "WanderWeird Atlas \u2014 Live Architecture Map",
    description: "Interactive Mockifyer Atlas generated from real WanderWeird E2E traffic: endpoints, request chains, and mocked vs live flows.",
    path: "/atlas/wanderweird"
  }
};
function formatPageTitle(title) {
  if (title.includes("\u2014") || title.includes(SITE_NAME)) {
    return title;
  }
  if (title.endsWith(` | ${SITE_NAME}`)) {
    return title;
  }
  return `${title} | ${SITE_NAME}`;
}

// frontend/src/lib/faq.ts
var HOME_FAQ = [
  {
    question: "What is Mockifyer?",
    answer: "Mockifyer is an open-source monorepo of npm packages (@sgedda/mockifyer-core, mockifyer-axios, mockifyer-fetch, and optional dashboard/MCP tools) that record and replay HTTP calls as JSON mocks in your repository."
  },
  {
    question: "How do I record API calls with Mockifyer?",
    answer: 'Install @sgedda/mockifyer-axios or mockifyer-fetch, call setupMockifyer({ mockDataPath: "./mock-data", recordMode: true }) before your HTTP client imports, then run with MOCKIFYER_RECORD=true. Responses are saved under mock-data/<scenario>/.'
  },
  {
    question: "How is Mockifyer different from MSW?",
    answer: "MSW uses in-code handlers. Mockifyer is record-and-replay at the axios/fetch layer: capture live responses once, store searchable JSON, switch scenarios, use the dashboard to activate passthrough mocks, and optionally connect mockifyer-mcp for IDE assistants."
  },
  {
    question: "Does Mockifyer support GraphQL?",
    answer: "Yes. Matching uses the normalized GraphQL query string plus sorted variables JSON \u2014 not operationName or headers alone."
  },
  {
    question: "What is MOCKIFYER_MODE vs MOCKIFYER_ACTIVATION_MODE?",
    answer: "MOCKIFYER_MODE (on | launch_client | manual | off) gates React Native fetch patching at startup: on = always active, launch_client = only when scenario/mockifyerClientId launch args are present, manual = programmatically controlled (aliases: e2e/maestro for manual, gui/toggle), off = disabled. MOCKIFYER_ACTIVATION_MODE (always | client_id_header | off) controls per-request interception on Node axios/fetch \u2014 use client_id_header with X-Mockifyer-Client-Id for multi-service setups."
  },
  {
    question: "What are the dashboard and MCP packages for?",
    answer: "@sgedda/mockifyer-dashboard is a local UI/CLI to browse and edit mocks, switch scenarios, and run a Redis proxy with client lanes. The MCP server (in packages/mockifyer-mcp, not on npm) exposes 42 tools including search, AI context, field overrides, and explain_value to Cursor or Claude Desktop while the dashboard is running. Build from source."
  },
  {
    question: "Where is the official documentation?",
    answer: "https://mockifyer.dev \u2014 Getting Started, config reference, E2E tutorial, features. Source: https://github.com/sgedda/mockifyer. AI summaries: https://mockifyer.dev/llms.txt"
  },
  {
    question: "What Mockifyer doesn't do (yet)",
    answer: "Server-side fetch interception in Nuxt/Nitro is not supported yet (tracked in GitHub issue #497: https://github.com/sgedda/mockifyer/issues/497). For React Native, recording from a physical device requires a dashboard connection: iOS Simulator and Android Emulator can save mocks locally via ExpoFileSystemProvider and sync them back to your project via Metro HTTP endpoints, but physical devices lack filesystem access from the development machine, so they must route through the dashboard proxy (Redis or SQLite) to persist recordings."
  }
];

// frontend/src/lib/product-docs.ts
var GUIDE_ITEMS = [
  { href: "/guides/mock-at-the-network-edge", label: "Mock at the Network Edge" },
  { href: "/guides/reproduce-tester-bugs", label: "Reproduce Tester Bugs" },
  { href: "/guides/stable-react-native-e2e", label: "Stable React Native E2E" },
  { href: "/guides/mock-drift", label: "Stop Mock Drift" },
  { href: "/guides/mockifyer-atlas", label: "Mockifyer Atlas: Architecture Visualization" },
  { href: "/guides/react-native-without-msw", label: "React Native: Handlers vs Recording" },
  { href: "/guides/browser-record-replay", label: "Record and Replay HTTP in the Browser" }
];

// frontend/src/lib/prerender-content.ts
var CONTENT_ROUTES_WITH_FULL_BODY = /* @__PURE__ */ new Set([
  "/guides",
  "/guides/mock-at-the-network-edge",
  "/guides/reproduce-tester-bugs",
  "/guides/stable-react-native-e2e",
  "/guides/mock-drift",
  "/guides/react-native-without-msw",
  "/guides/browser-record-replay",
  "/guides/mockifyer-atlas",
  "/comparisons",
  "/faq",
  "/getting-started",
  "/e2e-tutorial"
]);
var NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/getting-started", label: "Getting Started" },
  { href: "/features", label: "Features" },
  { href: "/guides", label: "Guides" },
  { href: "/faq", label: "FAQ" },
  { href: "/comparisons", label: "Comparisons" },
  { href: "/packages", label: "Packages" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/e2e-tutorial", label: "E2E Tutorial" },
  { href: "/contact", label: "Contact" }
];
function relatedGuideLinks(currentPath) {
  return GUIDE_ITEMS.filter((guide) => guide.href !== currentPath).map((guide) => ({
    href: guide.href,
    label: guide.label
  }));
}
function seoOrThrow(path2) {
  const seo = PAGE_SEO[path2];
  if (!seo) {
    throw new Error(`Missing PAGE_SEO for ${path2}`);
  }
  return seo;
}
var GUIDE_BODIES = {
  "/guides/mock-at-the-network-edge": {
    h1: "Mock at the Network Edge",
    summary: "Your tests pass but bugs ship when you mock hooks and components instead of HTTP. Mock at the network boundary so tests exercise real response shapes, survive refactors, and catch breaking API changes.",
    sections: [
      {
        heading: "The Principle",
        paragraphs: [
          "Mock what leaves your process (HTTP requests), not what stays inside it (hooks, components, parsers). Record real axios or fetch responses once, store them as JSON in your repo, and replay them in CI.",
          "This keeps UI tests focused on what users see while the backend contract stays honest. When APIs rename fields or change shapes, re-record and git-diff the mocks instead of rewriting hand-written stubs."
        ]
      },
      {
        heading: "How Mockifyer Helps",
        paragraphs: [
          "Install @sgedda/mockifyer-axios or @sgedda/mockifyer-fetch, call setupMockifyer before your HTTP client imports, then record with MOCKIFYER_RECORD=true. Switch scenarios for empty, one, or many states without changing test code."
        ]
      }
    ]
  },
  "/guides/reproduce-tester-bugs": {
    h1: "Reproduce Tester Bugs Locally",
    summary: "Capture API calls from tester devices, correlate multi-service hops with x-mockifyer-request-id, export as curl, and replay the exact failure on your machine.",
    sections: [
      {
        heading: "Capture Once, Replay Anywhere",
        paragraphs: [
          "When a tester hits a flaky flow, Mockifyer can record the outbound HTTP chain from the device or service under test. Request IDs stitch nested hops together so you can see which upstream response poisoned the UI.",
          "Export the failing request as curl, drop the recorded JSON into a local scenario, and reproduce without waiting for staging to re-enter the same state."
        ]
      }
    ]
  },
  "/guides/stable-react-native-e2e": {
    h1: "Stable React Native E2E Tests",
    summary: "Stop Detox, Appium, and Maestro flakes by locking Mockifyer scenarios with launch arguments, freezing dates, and making the backend deterministic.",
    sections: [
      {
        heading: "Lock the Mock World",
        paragraphs: [
          "Pass scenario and client-lane launch arguments so every E2E run boots into the same recorded HTTP world. Combine with date freezing so \u201Copens today\u201D stay stable across timezones and CI clocks.",
          "Mockifyer works on device without a service worker: use @sgedda/mockifyer-fetch with Expo or bare React Native, optional Metro sync, and dashboard proxy lanes for physical devices."
        ]
      }
    ]
  },
  "/guides/mock-drift": {
    h1: "Catch API Drift Before Production",
    summary: "Hand-written mocks drift from real APIs. Record real responses, re-record when APIs change, and use the drift-check CLI so breaking changes surface in CI instead of production.",
    sections: [
      {
        heading: "Why Hand-Written Mocks Rot",
        paragraphs: [
          "A common failure: staging renames name to title while tests still assert on name. Hand-written stubs stay green; production breaks. Recorded JSON mocks make contract changes visible in git diff.",
          "The mockifyer-drift-check CLI in @sgedda/mockifyer-core compares recorded mocks against live staging APIs. Run it nightly in GitHub Actions to catch breaking changes before they ship."
        ]
      }
    ]
  },
  "/guides/react-native-without-msw": {
    h1: "MSW vs Recording in React Native",
    summary: "Compare MSW and Mockifyer for React Native. Recording works on device with no service worker and supports Expo and bare React Native.",
    sections: [
      {
        heading: "Why Recording Fits Mobile",
        paragraphs: [
          "MSW relies on service workers in the browser and Node interception on the server. React Native has neither. Mockifyer patches fetch at the app layer so the same record-replay workflow works on simulators and devices.",
          "Use launch_client mode for Maestro or Detox, Hybrid storage for Expo, and the dashboard proxy when physical devices need a shared mock lane."
        ]
      }
    ]
  },
  "/guides/browser-record-replay": {
    h1: "Record and Replay HTTP in the Browser",
    summary: "Use Mockifyer to record and replay HTTP fetch calls in browser environments, Expo web builds, and Vite projects with the memory provider.",
    sections: [
      {
        heading: "Browser-Friendly Setup",
        paragraphs: [
          "Point setupMockifyer at a memory or filesystem provider depending on your runtime. Record once against a real API, then replay offline in Storybook, Playwright, or local Vite apps.",
          "The interactive browser guide embeds a WebContainer demo so you can try record and replay without installing packages locally."
        ]
      }
    ]
  },
  "/guides/mockifyer-atlas": {
    h1: "Visualize Architecture with Mockifyer Atlas",
    summary: "Generate interactive traffic maps from recorded HTTP hops. See hosts, request chains, search payloads, and trace multi-service flows.",
    sections: [
      {
        heading: "Atlas Traffic Maps",
        paragraphs: [
          "Atlas turns recorded hops into an interactive map of hosts and request chains. Search payloads, follow nested calls, and export HTML docs for architecture reviews.",
          "In Metro, press t to start live hop capture while you exercise the app. Combine with x-mockifyer-request-id to understand multi-service graphs end to end."
        ]
      }
    ]
  }
};
function buildGuidesHub() {
  const seo = seoOrThrow("/guides");
  return {
    h1: "Mockifyer Guides",
    summary: seo.description,
    sections: [
      {
        heading: "Published Guides",
        paragraphs: [
          "Practical guides for record-replay API mocking: network-edge testing, React Native E2E stability, mock drift detection, Atlas architecture maps, and browser record-replay.",
          "Each guide links to install steps, configuration tips, and related docs so you can go from concept to a working setup quickly."
        ]
      }
    ],
    links: [
      ...NAV_LINKS.filter((link) => link.href !== "/guides"),
      ...GUIDE_ITEMS.map((guide) => ({ href: guide.href, label: guide.label }))
    ]
  };
}
function buildFaqBody() {
  const seo = seoOrThrow("/faq");
  return {
    h1: "Frequently Asked Questions",
    summary: seo.description,
    sections: HOME_FAQ.map((item) => ({
      heading: item.question,
      paragraphs: [item.answer]
    })),
    links: NAV_LINKS.filter((link) => link.href !== "/faq")
  };
}
function buildGettingStartedBody() {
  const seo = seoOrThrow("/getting-started");
  return {
    h1: "Getting Started",
    summary: seo.description,
    sections: [
      {
        heading: "Quick Start: 2 Minutes",
        paragraphs: [
          "Try the demo with npx -p @sgedda/mockifyer-core mockifyer try, then initialize your project with mockifyer init. The CLI detects axios, fetch, or React Native and writes selective-recording defaults.",
          "Browse and activate mocks in the local dashboard. Requests land as request-only stubs until you activate them, so live APIs stay reachable while you curate recordings."
        ]
      },
      {
        heading: "Install for Your Stack",
        paragraphs: [
          "Node services typically install @sgedda/mockifyer-core with @sgedda/mockifyer-axios. React Native and browser fetch apps use @sgedda/mockifyer-fetch. Optional @sgedda/mockifyer-dashboard adds a UI, Redis/SQLite lanes, and MCP tooling.",
          "Set MOCKIFYER_PATH, MOCKIFYER_RECORD, and scenario env vars, then call setupMockifyer before importing your HTTP client so interception is ready on the first request."
        ]
      }
    ],
    links: [
      ...NAV_LINKS.filter((link) => link.href !== "/getting-started"),
      { href: "/config-reference", label: "Configuration Reference" },
      ...GUIDE_ITEMS.slice(0, 4).map((guide) => ({ href: guide.href, label: guide.label }))
    ]
  };
}
function buildComparisonsBody() {
  const seo = seoOrThrow("/comparisons");
  return {
    h1: "Mockifyer vs MSW, Polly.js, and Nock",
    summary: seo.description,
    sections: [
      {
        heading: "When Record-Replay Fits",
        paragraphs: [
          "MSW shines with in-code handlers and Service Workers. Polly.js offers framework-agnostic recording. Nock is excellent for Node unit tests with expectations in code. Mockifyer focuses on committed JSON recordings, scenario switching, React Native, and a local dashboard.",
          "Choose Mockifyer when you want searchable mocks in git, multi-service request tracing, date freezing, and the same recordings across Node, Expo, and CI without rewriting handlers for every shape change."
        ]
      },
      {
        heading: "Feature Highlights",
        paragraphs: [
          "Record from real APIs into repo JSON, switch scenario worlds at runtime, isolate client lanes, freeze dates, match GraphQL by normalized query plus variables, and inspect hops in the dashboard or Atlas maps."
        ]
      }
    ],
    links: [
      ...NAV_LINKS.filter((link) => link.href !== "/comparisons"),
      { href: "/guides/react-native-without-msw", label: "MSW vs Recording in React Native" },
      { href: "/guides/mock-drift", label: "Stop Mock Drift" }
    ]
  };
}
function buildE2ETutorialBody() {
  const seo = seoOrThrow("/e2e-tutorial");
  return {
    h1: "Controlling a Nested Multi-Service Stack with Mockifyer",
    summary: seo.description,
    sections: [
      {
        heading: "WanderWeird Walkthrough",
        paragraphs: [
          "This tutorial runs Playwright against the WanderWeird demo: an Expo app plus multiple Node services with scenarios, dashboard control, and nested request tracing.",
          "Each GUI test drives the real Mockifyer dashboard and shows the change land in a running app. Use it to learn scenario switching, lane isolation, and end-to-end hop inspection."
        ]
      },
      {
        heading: "What You Will Learn",
        paragraphs: [
          "How to lock a multi-service graph into a known mock world, inspect nested outbound calls, and keep E2E runs deterministic when upstream APIs would otherwise flake."
        ]
      }
    ],
    links: [
      ...NAV_LINKS.filter((link) => link.href !== "/e2e-tutorial"),
      { href: "/guides/reproduce-tester-bugs", label: "Reproduce Tester Bugs" },
      { href: "/guides/stable-react-native-e2e", label: "Stable React Native E2E" },
      { href: "/guides/mockifyer-atlas", label: "Mockifyer Atlas" }
    ]
  };
}
function getPrerenderBodyContent(routePath) {
  if (!CONTENT_ROUTES_WITH_FULL_BODY.has(routePath)) {
    return null;
  }
  if (routePath === "/guides") {
    return buildGuidesHub();
  }
  if (routePath === "/faq") {
    return buildFaqBody();
  }
  if (routePath === "/getting-started") {
    return buildGettingStartedBody();
  }
  if (routePath === "/comparisons") {
    return buildComparisonsBody();
  }
  if (routePath === "/e2e-tutorial") {
    return buildE2ETutorialBody();
  }
  const guide = GUIDE_BODIES[routePath];
  if (!guide) {
    return null;
  }
  return {
    ...guide,
    links: [
      { href: "/guides", label: "All Guides" },
      ...NAV_LINKS.filter((link) => !link.href.startsWith("/guides")),
      ...relatedGuideLinks(routePath)
    ]
  };
}
function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}
function renderPrerenderBodyHtml(content) {
  const sectionsHtml = content.sections.map((section) => {
    const paragraphs = section.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
    return `<section><h2>${escapeHtml(section.heading)}</h2>${paragraphs}</section>`;
  }).join("");
  const linksHtml = content.links.map((link) => `<li><a href="${escapeAttr(link.href)}">${escapeHtml(link.label)}</a></li>`).join("");
  return [
    '<article style="max-width:1200px;margin:0 auto;padding:2rem">',
    `<h1>${escapeHtml(content.h1)}</h1>`,
    `<p>${escapeHtml(content.summary)}</p>`,
    sectionsHtml,
    '<nav aria-label="Related pages"><h2>Related pages</h2>',
    `<ul>${linksHtml}</ul>`,
    "</nav>",
    "<noscript><p>This site requires JavaScript for the full interactive experience. The content above is available without JavaScript.</p></noscript>",
    "</article>"
  ].join("");
}
function buildFaqPageJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: HOME_FAQ.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer
      }
    }))
  };
}
function buildTechArticleJsonLd(seo) {
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: seo.title,
    description: seo.description,
    url: `${SITE_URL}${seo.path}`,
    author: {
      "@type": "Person",
      name: "Sebastian Gedda",
      url: "https://github.com/sgedda"
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL
    },
    mainEntityOfPage: `${SITE_URL}${seo.path}`
  };
}
function getRouteJsonLd(routePath) {
  if (routePath === "/faq") {
    return buildFaqPageJsonLd();
  }
  if (routePath.startsWith("/guides/") && PAGE_SEO[routePath]) {
    return buildTechArticleJsonLd(PAGE_SEO[routePath]);
  }
  return null;
}

// scripts/prerender-static.ts
var NOT_FOUND_SEO = {
  title: "Page Not Found",
  description: "The page you are looking for does not exist.",
  path: "/404",
  noIndex: true
};
var HOMEPAGE_CANONICAL = `${SITE_URL}/`;
function normalizeShellHtml(html) {
  return html.replace(/<div id="root">[\s\S]*?<\/div>/, '<div id="root"></div>');
}
function escapeHtml2(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr2(value) {
  return escapeHtml2(value).replace(/"/g, "&quot;");
}
function buildRootInnerHtml(routePath, seoConfig) {
  const fullBody = getPrerenderBodyContent(routePath);
  if (fullBody) {
    return renderPrerenderBodyHtml(fullBody);
  }
  const h1Text = seoConfig.title.replace(` | ${SITE_NAME}`, "").replace(" - Testing Guide", "").replace(" - ", ": ");
  return `<div style="max-width:1200px;margin:0 auto;padding:2rem"><h1>${escapeHtml2(h1Text)}</h1><p>${escapeHtml2(seoConfig.description)}</p><noscript><p>This site requires JavaScript to be enabled.</p></noscript></div>`;
}
function generateHtml(routePath, seoConfig, baseHtml) {
  const title = formatPageTitle(seoConfig.title);
  const isNotFound = Boolean(seoConfig.noIndex) || routePath === "/404";
  const canonical = routePath === "/" ? HOMEPAGE_CANONICAL : `${SITE_URL}${routePath}`;
  let html = baseHtml.replace(/<title>.*?<\/title>/, `<title>${escapeHtml2(title)}</title>`);
  html = html.replace(
    /<meta name="description"[\s\S]*?content=".*?"[\s\S]*?\/>/,
    `<meta name="description" content="${escapeAttr2(seoConfig.description)}" />`
  );
  const robotsContent = isNotFound ? "noindex, nofollow" : "index, follow";
  html = html.replace(
    /<meta name="robots" content=".*?"(\s*\/)?>/,
    `<meta name="robots" content="${robotsContent}" />`
  );
  if (isNotFound) {
    html = html.replace(/<link rel="canonical" href=".*?"(\s*\/)?>\s*/i, "");
    html = html.replace(/<meta property="og:url" content=".*?"(\s*\/)?>\s*/i, "");
  } else {
    html = html.replace(
      /<link rel="canonical" href=".*?"(\s*\/)?>/,
      `<link rel="canonical" href="${canonical}" />`
    );
    html = html.replace(
      /<meta property="og:url" content=".*?"(\s*\/)?>/,
      `<meta property="og:url" content="${canonical}" />`
    );
  }
  html = html.replace(
    /<meta property="og:title" content=".*?"(\s*\/)?>/,
    `<meta property="og:title" content="${escapeAttr2(title)}" />`
  );
  html = html.replace(
    /<meta property="og:description"[\s\S]*?content=".*?"[\s\S]*?\/>/,
    `<meta property="og:description" content="${escapeAttr2(seoConfig.description)}" />`
  );
  html = html.replace(
    /<meta name="twitter:title" content=".*?"(\s*\/)?>/,
    `<meta name="twitter:title" content="${escapeAttr2(title)}" />`
  );
  html = html.replace(
    /<meta name="twitter:description"[\s\S]*?content=".*?"[\s\S]*?\/>/,
    `<meta name="twitter:description" content="${escapeAttr2(seoConfig.description)}" />`
  );
  const routeJsonLd = getRouteJsonLd(routePath);
  if (routePath === "/") {
  } else if (routeJsonLd) {
    html = html.replace(
      /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
      `<script type="application/ld+json">${JSON.stringify(routeJsonLd)}</script>`
    );
  } else {
    html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, "");
  }
  const seoContent = `<div id="root">${buildRootInnerHtml(routePath, seoConfig)}</div>`;
  html = html.replace(/<div id="root"><\/div>/, seoContent);
  return html;
}
function writeRouteHtml(publicDir, routePath, html) {
  if (routePath === "/") {
    const indexPath = import_path.default.join(publicDir, "index.html");
    import_fs.default.writeFileSync(indexPath, html, "utf-8");
    return "index.html";
  }
  const routePathClean = routePath.replace(/^\//, "");
  const routeDir = import_path.default.dirname(routePathClean);
  if (routeDir && routeDir !== ".") {
    import_fs.default.mkdirSync(import_path.default.join(publicDir, routeDir), { recursive: true });
  }
  const relativePath = `${routePathClean}.html`;
  import_fs.default.writeFileSync(import_path.default.join(publicDir, relativePath), html, "utf-8");
  return relativePath;
}
async function prerender() {
  const publicDir = import_path.default.join(__dirname, "../public");
  const indexPath = import_path.default.join(publicDir, "index.html");
  if (!import_fs.default.existsSync(indexPath)) {
    console.error("\u274C public/index.html not found. Run frontend build first.");
    process.exit(1);
  }
  console.log("\u{1F4C4} Starting static HTML generation for SEO...");
  const shellHtml = normalizeShellHtml(import_fs.default.readFileSync(indexPath, "utf-8"));
  import_fs.default.writeFileSync(import_path.default.join(publicDir, "_shell.html"), shellHtml, "utf-8");
  const manifest = {};
  let count = 0;
  for (const [routePath, seoConfig] of Object.entries(PAGE_SEO)) {
    if (routePath.startsWith("/atlas/")) {
      const staticIndex = import_path.default.join(publicDir, routePath.replace(/^\//, ""), "index.html");
      if (!import_fs.default.existsSync(staticIndex)) {
        console.warn(`  \u26A0 ${routePath} listed in PAGE_SEO but ${staticIndex} is missing`);
      } else {
        console.log(`  \u2713 ${routePath} \u2192 atlas static asset (skipped SPA prerender)`);
      }
      manifest[routePath] = {
        title: formatPageTitle(seoConfig.title),
        description: seoConfig.description,
        path: routePath,
        noIndex: seoConfig.noIndex
      };
      count++;
      continue;
    }
    const generatedHtml = generateHtml(routePath, seoConfig, shellHtml);
    const relativePath = writeRouteHtml(publicDir, routePath, generatedHtml);
    const bodyContent = getPrerenderBodyContent(routePath);
    const jsonLd = getRouteJsonLd(routePath);
    manifest[routePath] = {
      title: formatPageTitle(seoConfig.title),
      description: seoConfig.description,
      path: routePath,
      noIndex: seoConfig.noIndex,
      bodyHtml: bodyContent ? renderPrerenderBodyHtml(bodyContent) : void 0,
      jsonLd: jsonLd ?? void 0
    };
    console.log(`  \u2713 ${routePath} \u2192 ${relativePath}`);
    count++;
  }
  const notFoundHtml = generateHtml("/404", NOT_FOUND_SEO, shellHtml);
  import_fs.default.writeFileSync(import_path.default.join(publicDir, "404.html"), notFoundHtml, "utf-8");
  manifest["/404"] = {
    title: formatPageTitle(NOT_FOUND_SEO.title),
    description: NOT_FOUND_SEO.description,
    path: "/404",
    noIndex: true
  };
  console.log("  \u2713 /404 \u2192 404.html");
  count++;
  import_fs.default.writeFileSync(
    import_path.default.join(publicDir, "seo-manifest.json"),
    JSON.stringify({ siteUrl: SITE_URL, routes: manifest }, null, 2),
    "utf-8"
  );
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
  HOMEPAGE_CANONICAL,
  NOT_FOUND_SEO,
  PAGE_SEO,
  SITE_NAME,
  SITE_URL,
  formatPageTitle,
  generateHtml,
  normalizeShellHtml,
  prerender
});
