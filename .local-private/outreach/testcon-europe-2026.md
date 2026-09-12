# TestCon Europe 2026 — is it a good idea?

**Conference:** [TestCon Europe](https://testcon.lt/) · 11th edition · Vilnius + online  
**When:** 20 Oct 2026 workshops (Simbiocity Nova) · 21–23 Oct conference (Forum Cinemas Vingis)  
**Scale:** 800+ attendees, 60+ talks, 8+ workshops, 4 tracks, 35+ countries  
**Organiser:** UAB DATA MINER (same company as DevDays Europe)  
**Checked:** 2 September 2026

## Short answer

**Good conference for Mockifyer. Late for a 2026 talk. Still worth submitting as a backup, and worth attending.**

TestCon is a software-testing / QA conference, not a generic JS meetup. That is the right room: people who fight flaky E2E, rotten fixtures, and “the staging API is down again.” A developer conference is a second room (DevDays), not a substitute.

Do **not** show up with “let me introduce my npm package.” TestCon’s own CFP call asks for **how-to sessions, actionable talks, and real-world case studies**. Teach a pattern. Use Mockifyer as the vehicle. Name the tool once the audience already wants the workflow.

## Why the audience fit is strong

Published attendee mix: **53% QA & test engineers, 18% testers, 15% managers/leads, 5% developers/DevOps**. Experience: **56% senior**.

2026 themes that map to Mockifyer without stretching:

| TestCon 2026 theme | Mockifyer angle |
|--------------------|-----------------|
| **Test Data Engineering** | Record real HTTP as JSON fixtures; scenarios as product states; same data in demo and CI |
| **TestOps / CI/CD** | Git-reviewed goldens, scenario locks, client lanes for parallel Playwright |
| **Traceability** | Multi-hop `X-Mockifyer-Request-Id` + dashboard network trace |
| **Mobile Testing** | fetch/axios in React Native — MSW Service Workers are not a given |
| **Test Environment Automation** | Replay without a live backend; Redis proxy for shared dashboard |
| **AI-assisted testing** | MCP tools to promote fixtures / switch scenarios — only as a *supporting* demo, not the headline |

The cinema venue is an advantage. Large screens and cinema sound reward a **live record → replay → scenario switch**. Rehearse the demo until it is boring.

## Why a 2026 speaking slot is a long shot

- The [programme is published](https://testcon.lt/schedule/) (LinkedIn, 10 Aug 2026).
- 60+ talks and 8+ workshops are already named.
- Late Bird pricing runs until **10 September 2026** — they are selling tickets against a finished agenda.
- The [CFP page](https://testcon.lt/cfp/) and FAQ still say the call is open, and third-party listings show a close date of **19 October 2026**. That is almost certainly **rolling replacements** (cancellations, no-shows), not a first-wave selection.

Two 2026 talks already occupy nearby ground:

- *Synthetic testdata on the fly? Solved!* — Dag Nygaard & Erik Rogstad (DSL for synthetic data)
- *The Death of Anonymization: Scaling with Test Data as Service* — Vaclav Broz (provisioning consistent data across microservices)

That is **not** a reason to stay away. It is a reason to differentiate: those talks generate or provision data. Ours is **capture production-shaped HTTP, version it in git, switch whole product worlds, freeze time**. Complementary, not a clone. Mention those sessions in the proposal so reviewers see you read the programme.

## What “good idea” means for 2026 vs later

| Play | 2026 | 2027 |
|------|------|------|
| 45-min conference talk | Submit as **backup**; low probability | Primary TestCon target (CFP typically opens January) |
| Full-day workshop | Even lower unless a workshop drops | Strong if the 45-min talk lands first |
| Track host | Reasonable late offer — they still need hall hosts | Also fine |
| Attend as a participant | **High value** — meet programme people, watch the test-data talks, hallway-track the demo | Come back as a known name |
| Sponsor / expo booth | Separate path: `info@testcon.lt` | Only if you want vendor presence, not a talk |
| Speaker intro video | Record anyway; TestCon publishes a speaker video library | Reuse |

Accepted speakers get a **complimentary conference registration** and an invitation as a guest of honor the following year. If you are not accepted, a Late Bird ticket (until 10 Sep) is the fallback.

## How to submit for 2026

1. **Form (required):** [TestCon CFP Airtable](https://airtable.com/appwHoM853A0uvnaR/pag6bCDEHgNxguykQ/form)  
   Copy fields from [cfp-talk.md](./cfp-talk.md). Session type: **Conference Talk** (45 min including Q&A). Optionally also tick **Track Hosting**.
2. **Email (do this the same day):** `speakers@testcon.lt` and `speakers@testconeurope.lt`  
   Use the late-submission email in the CFP doc. Be explicit that you know the schedule is live and you are offering a **replacement slot**.
3. **Do not wait for a reply before submitting EuroSTAR.** That deadline is 30 Sep 2026.

Code of conduct: [testcon.lt/code-of-conduct](https://testcon.lt/code-of-conduct/).

## Neighbouring conferences (same season / same organiser)

Same organiser, developer audience: **DevDays Europe 2027**, Riga, 25–28 May 2027. CFP open: [Airtable](https://airtable.com/appHxAEL0xN1OErFQ/pag3NDDzoyeWtaF4H/form), questions `speakers@devdayseurope.eu`. One ticket also covers co-located DevOps Pro and CyberWiseCon. Reframe the talk toward in-process mocking for Node / React Native rather than QA test-data language.

Prestige testing stage: **EuroSTAR 2027**, Copenhagen, 11–14 May 2027. Theme *Sharpening the Craft*. **Submit by 30 September 2026.**

Autumn 2026, CFP already closed: Agile Testing Days (Potsdam, 16–19 Nov 2026). Useful to attend if TestCon does not work out; too late to speak.

## Live demo sources in this repo

Do not promise the unbuilt trips showcase on stage.

| Asset | Use on stage |
|-------|----------------|
| [mockifyer.dev](https://mockifyer.dev/) | Zero-setup playground if wifi is bad |
| `mockifyer-web` | Weather / football record-replay + dates |
| `example-projects/multi-service-example` | Multi-hop chain + dashboard trace |
| `example-projects/react-native-expo-example` | Mobile story (video backup if no device) |
| `.cursor/plans/mockifyer-why-awesome.md` | Positioning — not a slide deck |
