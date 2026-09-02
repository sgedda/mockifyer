# How to get chosen as a speaker

Programme committees are not looking for the best product. They are looking for a session attendees will stay in the cinema for, tell a colleague about, and apply. Below is the selection logic for TestCon-class events, then a calendar.

## What reviewers score (even when the form does not say so)

1. **Audience problem in the first two sentences.** Testers already feel “our mocks are a second product.” Lead with that. Tool name comes later.
2. **Takeaways they can use without buying anything.** A recording policy, a scenario naming scheme, a clock helper, a trace drill.
3. **Evidence it is a real how-to.** Live demo, fixture file, PR diff — not architecture origami.
4. **Fit to this year’s published themes.** Mirror their words: Test Data Engineering, TestOps, Mobile Testing, Traceability. Do not invent a “Mockifyer track.”
5. **Honesty.** Limits, PII, “I built the library.” Committees smell stealth vendor talks. Naming the tool after the pattern is fine; keynoting the changelog is not.
6. **Speaker can hold a room.** First-time speakers get through when the abstract is specific and a short video exists. Record 60–90 seconds: who you are, the pain, the one thing they will leave with. TestCon already runs a speaker intro video library. EuroSTAR accepts a ≤3 minute support clip.
7. **No duplicate of a talk they already accepted.** Read the live schedule. Position against synthetic-data and TDaaS sessions instead of pretending they do not exist.

EuroSTAR’s 2027 chair said the quiet part out loud: **generic AI-written abstracts get rejected because they are bad**, not because they are AI. Write in your voice. Use a spellchecker. Do not outsource the thinking.

## Formats that get in more easily than “give me a keynote”

| Format | When to choose it |
|--------|-------------------|
| 45-min how-to (TestCon) / 30+15 (EuroSTAR) | Default. Highest chance if the demo is real. |
| Workshop | Only if you can run a 6-hour lab without wifi heroics. |
| Track host | Late 2026 play; you meet every speaker in that hall. |
| Lightning / community | If the conference adds them; good rehearsal. |
| Sponsor session | Paid, different review bar, weaker trust. Use `info@testcon.lt` only if you want a booth. |

Accepted TestCon speakers receive a complimentary ticket. That is the cheapest way to attend. It is not a reason to submit a weak talk.

## Demo bar (this is how you actually get chosen)

Reviewers imagine the room. A cinema in Vilnius with a 15-metre screen will expose a 10-point terminal font and a flaky live backend.

Rehearse this loop until it is muscle memory:

1. App calls a real API (weather, football, or the multi-service chain).
2. Turn recording on; click once; show the JSON file that appeared under `mock-data/<scenario>/`.
3. Kill the network / skip the API key; click again; same UI.
4. Switch `MOCKIFYER_SCENARIO` (or dashboard) to `empty` / `error`; UI changes without new handlers.
5. Move the clock; a date-sensitive CTA appears or vanishes.
6. Optional: show the hop list for one request id.

Wifi backup: local `mockifyer-web` + a 3-minute screen recording on a USB-C stick. Public backup: [mockifyer.dev](https://mockifyer.dev/).

The smallest setup that proves the talk:

```ts
import { setupMockifyer } from '@sgedda/mockifyer-axios';
import { getCurrentDate } from '@sgedda/mockifyer-core';

setupMockifyer({
  mockDataPath: './mock-data',
  dateManipulation: { fixedDate: '2026-10-21T09:00:00.000Z' },
});

// App code uses getCurrentDate() — not new Date() — so UI and fixtures share a clock.
const now = getCurrentDate();
```

Do not demo features that only exist in `.cursor/plans/`.

## Off-stage work that changes the odds

- **Submit on time for the conference you can still win.** EuroSTAR 2027 closes **30 Sep 2026**. TestCon 2026 is a backup email. TestCon 2027: submit in the January CFP window, not in October.
- **Attend first if the CFP already closed.** Hallway-track the test-data speakers, talk to track hosts, leave a URL. Next year’s committee remembers people who showed up.
- **Be findable.** `mockifyer.dev`, GitHub README, and a 90s video should all tell the same story as the abstract.
- **Do not spam.** One form + one short email. Follow up once after two weeks if you heard nothing on a still-open CFP.
- **Meet the other test-data speakers as peers**, not as competition. Citing their sessions in your proposal is a signal you read the programme.
- **Community reps:** Ministry of Testing, local QA meetups, a written experience report. A TestCon committee that has seen your name once already will read the abstract slower.

## Calendar (as of 2 Sep 2026)

| When | What |
|------|------|
| **Now → 10 Sep 2026** | TestCon Late Bird tickets. Buy if you will attend without a speaker pass. |
| **Now** | Submit TestCon 2026 backup talk + email `speakers@testcon.lt`. |
| **Now** | Submit DevDays Europe 2027 (Riga, 25–28 May 2027). |
| **Now → 30 Sep 2026** | **EuroSTAR 2027 CFP** (Copenhagen, 11–14 May 2027). Highest-priority form. |
| Oct 2026 | TestCon week: attend, demo in the hallway, collect 2027 CFP date. |
| ~Jan 2027 | TestCon Europe 2027 CFP typically opens (same pattern as 2026). Submit in week one. |
| Nov 2026 | Agile Testing Days — CFP already closed; attend only if useful. |

Links:

- TestCon CFP page: https://testcon.lt/cfp/
- TestCon form: https://airtable.com/appwHoM853A0uvnaR/pag6bCDEHgNxguykQ/form
- TestCon schedule: https://testcon.lt/schedule/
- EuroSTAR CFP: https://conference.eurostarsoftwaretesting.com/call-for-submissions/
- DevDays form: https://airtable.com/appHxAEL0xN1OErFQ/pag3NDDzoyeWtaF4H/form

## 90-second intro video (script)

Do not read the abstract. Talk to the camera.

> I am Sebastian Gedda. I got stuck maintaining a fake API that was almost, but not quite, the real one — and then demos died when staging did. I started recording the HTTP my apps already make, keeping those JSON files in git, and naming whole product states as scenarios. I also stopped calling `new Date()` in tests. In the session I will record a live call, unplug the backend, switch a scenario, and follow a request across services. You can do the same workflow with the tools you have; I will show the version I maintain, Mockifyer, because that is what I can demo without lying.

## After you submit

1. Save PDFs / screenshots of the confirmation.
2. Put the 30 Sep EuroSTAR deadline on a calendar with a two-week reminder to follow up.
3. Rehearse the 20-minute demo on the actual laptop you will take to Vilnius/Copenhagen.
4. If accepted: ask about recording rights (TestCon publishes recordings; useful marketing that is still not a vendor booth).
5. If rejected: ask whether they want the talk in the 2027 pool. Many committees keep a warm list.
