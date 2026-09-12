# CFP copy: Test data as code

Paste these blocks into TestCon, EuroSTAR, DevDays, and similar forms. Edit the first person details if a co-speaker joins. Do **not** paste a vendor tagline as the title.

**Working title**

> Stop hand-writing fake APIs: record real HTTP as git-reviewed test data

**Subtitle** (if the form has one)

> Scenarios as product states, frozen time, and traces you can actually follow

---

## One-liner (for lists / tweets / speaker cards)

Record the APIs your app already calls, keep the fixtures in git, switch whole product worlds with a scenario name, and freeze the clock so date-sensitive tests stop lying.

---

## Abstract (~1,400 characters — TestCon / Airtable)

Most teams maintain a second, fictional product: a pile of MSW handlers, WireMock stubs, or “just hit staging.” The fiction drifts. Staging dies on demo day. Date-sensitive tests pass on Tuesday and fail on Wednesday. React Native cannot hide behind a Service Worker.

I got tired of that loop while building and testing apps that talk to real HTTP. The pattern that stuck is boring on purpose:

1. Intercept axios/fetch and **record** the real request/response as JSON in the repo.
2. Name **scenarios** as product states (`empty-cart`, `check-in-open`, `booking-error`) instead of scattering files.
3. Drive clocks through one helper (`getCurrentDate()`) so app logic and payload dates move together.
4. When a UI field looks wrong, follow the **multi-hop trace** instead of guessing which service lied.

This is a how-to, not a keynote. I will record a live call, switch a scenario, break a date, and walk a request across services on a dashboard. I built Mockifyer to make that workflow local; the takeaways work even if you stay on MSW or WireMock. I will also say what not to record (secrets, PII) and where this pattern is the wrong tool.

Attendees leave with a checklist they can run in their own repo the same week.

---

## Abstract, EuroSTAR flavour (~same length)

EuroSTAR 2027 asks us to open the toolbox. Mine has four tools I reach for before I write another fake handler:

- **Capture**, not invent: real HTTP as JSON fixtures the PR can review.
- **Name the world**: one scenario env var instead of a matrix of stubs.
- **Own the clock**: `getCurrentDate()` plus response date overlays so “expires in 10 hours” is deterministic.
- **Follow the hop**: a request id that survives BFF → service → upstream so “where did this field come from?” is a lookup, not a meeting.

I will show the failures first — a demo that needs a live backend, an E2E that flakes on the calendar, a GraphQL mock that matches the operation name and still returns the wrong document. Then I will apply the four tools live. The implementation I maintain is Mockifyer (axios/fetch, including React Native). The craft is the workflow: record, review, scenario, freeze, trace. I will be honest about PII, about not replacing consumer-driven contracts, and about when a dedicated mock server is still the better hammer.

Takeaways are concrete: a recording policy, a scenario naming scheme, and a 15-minute trace drill.

---

## Three takeaways (required on most forms)

1. **Record, don’t invent.** Capture real axios/fetch traffic as JSON in git so demos and CI share production-shaped payloads, and reviewers see API behaviour in the PR diff.
2. **Scenarios are product states.** One named world (`empty`, `check-in-open`, `outage`) beats a folder of unrelated stubs; pair it with a single clock helper so dates in the UI and dates in the fixture cannot disagree.
3. **Traces beat folklore.** Propagate a request id across hops and look up the chain when a field is wrong — including on React Native, where Service Worker mocks never existed.

---

## Session formats

### Conference talk — 45 minutes including Q&A (TestCon default)

| Min | Beat |
|-----|------|
| 0–4 | The second product: handlers that describe an API nobody shipped |
| 4–10 | Record real HTTP into git; show a fixture file and a PR-sized diff |
| 10–20 | **Live demo:** record → replay with the backend off → switch scenario |
| 20–28 | Freeze time (`getCurrentDate` + date overlays); a check-in window that does not flake |
| 28–35 | Multi-hop: BFF chain, request id, dashboard trace (“which service?”) |
| 35–38 | Limits: PII/redaction, not a polyglot mock server, contracts still matter |
| 38–45 | Q&A |

Cinema note: prefer one terminal + one dashboard window at large type. Have `mockifyer.dev` and a pre-recorded screen capture as wifi backup.

### EuroSTAR track talk — 30 min + 15 Q&A

Drop the GraphQL aside. Keep record, scenario, clock, one trace. Put RN in a single slide + 30s clip.

### Workshop — 6 hours (optional second submission)

Title: *Record, replay, scenario: a lab for API test data that does not rot*

Labs: intercept fetch; record a third-party API; add `empty` and `error` scenarios; freeze a date; run the same fixtures from Playwright with a client id; optional MCP “promote this response.” Needs Node 20, this repo’s `mockifyer-web` or `multi-service-example`, and a printed cheatsheet. Only propose if you can staff the room.

### Track hosting (TestCon / DevDays)

Offer this in the same form if the talk is waitlisted: introduce speakers, keep time, run Q&A. Useful 2026 late play.

---

## Topics / tags to tick

**TestCon:** Test Data Engineering, TestOps, Test Automation, Mobile Testing, Traceability, Shift-Left Testing, Test Environment Automation.  
**DevDays:** testing, Node.js, React Native, developer experience, open source.  
Avoid leading with “AI” unless you actually show MCP as a 2-minute sidecar.

---

## Speaker

**Name:** Sebastian Gedda  
**Role:** Creator of Mockifyer  
**Affiliation:** Independent / Mockifyer  
**Location:** (fill on the form)  
**Email:** sebastian.gedda@gmail.com  
**GitHub:** [github.com/sgedda](https://github.com/sgedda) · repo [github.com/sgedda/mockifyer](https://github.com/sgedda/mockifyer)  
**Site:** [mockifyer.dev](https://mockifyer.dev/)

**Bio (~80 words)**

Sebastian Gedda builds Mockifyer, an open-source record/replay toolkit for axios and fetch (including React Native). He works on the unglamorous layer between UI and HTTP: fixtures that look like production, scenarios you can switch without redeploying a mock server, and clocks that tests can trust. He is based in the GitHub issues and the dashboard at 2 a.m. as often as on a stage — this talk is the workflow he wished someone had shown him before he wrote the third fake API.

**Bio, short (~40 words)**

Sebastian Gedda is the author of Mockifyer. He helps teams record real HTTP as git-reviewed fixtures, switch product states with scenarios, and keep time-dependent tests deterministic — on Node and on React Native.

**Speaking experience**

First major European testing conference talk (be honest on the form). Offer a 60–90s intro video. TestCon publishes a speaker video library; EuroSTAR accepts a ≤3 minute support video.

**Headshot:** use a well-lit, high-res photo. Cinema screens punish casual selfies.

---

## Why this talk (reviewer-facing paragraph)

TestCon 2026 already has talks on *generating* synthetic data and on *provisioning* Test Data as a Service. This session is the missing third leg: **capturing the HTTP the app already makes**, putting it in git, and operating it as scenarios. It is a how-to with a live demo. The speaker maintains the open-source implementation but will teach the pattern first. Audience: mid-to-senior QA and automation engineers who own E2E data, plus the few developers in the room who ship React Native.

---

## Email: late TestCon 2026 submission

To: `speakers@testcon.lt`, `speakers@testconeurope.lt`  
Subject: Backup speaker — recorded HTTP as git-reviewed test data (45 min how-to)

```
Hi TestCon team,

I know the 2026 schedule is already live — I am not expecting a first-wave slot.
I am submitting via the CFP form as a replacement speaker if a 45-minute
how-to opens up (cancellation, travel, track gap).

Title: Stop hand-writing fake APIs: record real HTTP as git-reviewed test data

It is a practitioner session (record → scenario → freeze time → multi-hop
trace), aimed at Test Data Engineering / TestOps / mobile. Complementary to
the synthetic-data and TDaaS talks already on the programme, not a repeat.

Happy to track-host as well. Form submitted today. Happy to send a 90-second
intro video.

I will also be in Vilnius as an attendee if a hall seat is all that is left.

Thanks,
Sebastian Gedda
https://mockifyer.dev
https://github.com/sgedda/mockifyer
sebastian.gedda@gmail.com
```

---

## Email: EuroSTAR / DevDays (on-time)

Subject: CFP — Stop hand-writing fake APIs (track talk)

```
Hello,

Submitted via the speaker form:

Title: Stop hand-writing fake APIs: record real HTTP as git-reviewed test data
Format: track talk (how-to + live demo)
Theme fit: test data / toolbox for HTTP fixtures, scenarios, deterministic time

Happy to record a short intro video if useful.

Sebastian Gedda
https://mockifyer.dev
```

---

## What not to write

- “The ultimate mocking platform for the AI era”
- Fake customer counts or unnamed “Fortune 500” case studies
- A feature tour of the dashboard
- Promising the unbuilt `trips-showcase` example as the live demo
