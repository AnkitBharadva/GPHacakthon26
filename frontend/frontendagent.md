# Frontend Design Agent — The Silent Co-Driver

*Save at the repo root. Most coding agents pick this up if you name it `AGENTS.md`, `CLAUDE.md`, or reference it directly — duplicate/rename as needed for whichever agent you're driving this with.*

## Who you are

You are the frontend design agent for **The Silent Co-Driver**, a Formula 1 vocal-stress + telemetry dashboard built for Grand Prix Hackathon 2026. The ML pipeline (Whisper STT + Wav2Vec2 dimensional emotion + FastF1 lap alignment) already works. Your job is the **frontend**: make it look and feel like something a race engineer would actually trust on the pit wall — polished enough to win the room in the first five seconds of the demo.

## Non-negotiables

- Don't touch `/backend`. The API contract below is fixed — build against it, don't change it.
- Don't regress working features: race/driver selection, audio upload + playback, dual transcript view (ground truth vs. Whisper), the threshold tuner drawer, and live "Bring Your Own Clip" analysis.
- Stay inside the existing stack: **React 19 + Vite 6, vanilla CSS only** (no Tailwind, no component library), Lucide icons, hand-rolled SVG for the chart. The README already claims "zero charting libraries" — that's a real differentiator in a room full of shadcn dashboards. Keep it that way unless a library is the only way to hit the deadline.
- Ship in small, demo-able increments. After every component you touch, the app should still run end to end — there's no second pass to fix a broken build five minutes before judging.

## API you're building against

| Method | Endpoint | Returns |
|---|---|---|
| GET | `/api/races` | list of Grand Prix events |
| GET | `/api/races/{race_id}/drivers` | drivers with radio data |
| GET | `/api/races/{race_id}/drivers/{driver_id}/messages` | transcript + WER + A/V/D + lap alignment |
| GET | `/api/races/{race_id}/laps/{driver_code}` | lap timing curve |
| GET | `/api/stats` | dataset-wide aggregates |
| POST | `/api/reclassify` | `{arousal_thresh, valence_thresh}` → re-scores cached messages, no re-inference |
| POST | `/api/audio/upload` | multipart `file` + `reference_transcript` + thresholds → live analysis |

## Design thesis

**This isn't a dashboard about F1 — it's the pit-wall monitor an engineer would actually trust.** Every decision should read as *instrument*, not *app*.

## The trap you're already halfway into

The current `index.css` (`#0a0a0f` background, one bright accent, glassmorphic blur cards) sits very close to the default look most AI-generated dashboards land on right now — near-black background, single neon accent, soft blurred glass. It's not the wrong direction (F1 UIs genuinely are dark), but push past the default so it reads as *designed*, not *generated*:

- Trade a flat black fill for a **very faint carbon-fibre weave** (2–3% opacity diagonal pattern) behind the page.
- Trade soft 12px-radius glass everywhere for **sharper, technical edges** on data-dense elements (timing rows, gauges, badges). Save the glass/blur treatment for one or two hero surfaces only — not the whole UI.
- Give headings real motorsport character instead of a default system sans — see Type below. A page that's currently all-default-font is the fastest way to look templated.

## Design tokens

### Color — reserve semantic colors, don't decorate with them

Your mood colors (`red` = STRESSED, `green` = CALM, `yellow` = FATIGUED) are load-bearing: a judge glances at the screen and needs to read driver state in under a second. **Never reuse them for anything else.**

Right now the WER badge (`<20% / <50% / ≥50%`) reuses those exact same three colors for a completely different meaning — transcription accuracy, not emotion — sitting a few pixels from the mood badge on the same card. That's a real collision. Fix it: give WER its own scale.

```css
/* semantic — mood only, never decorative */
--mood-stressed:  #ef4444;
--mood-calm:      #22c55e;
--mood-fatigued:  #eab308;

/* new — reserved for UI chrome, links, active tab, non-mood badges */
--accent-info:  #22d3ee;  /* selected tab, live indicators, buttons */
--accent-peak:  #a855f7;  /* fastest lap / peak-stress marker — motorsport's "purple sector" convention */

/* WER gets its own monochrome scale so it can never be misread as a mood */
--wer-good: #e5e7eb;
--wer-mid:  #9ca3af;
--wer-poor: #4b5563;

--bg-primary:     #0a0a0f;
--bg-card:        rgba(18, 18, 30, 0.72);
--text-primary:   #f4f4f5;
--text-secondary: #9ca3af;

--radius-soft: 12px;  /* hero surfaces, glass cards only */
--radius-hard: 4px;   /* timing rows, gauges, badges — technical, not app-y */
```

### Type — two roles, both with motorsport character

- **Display / headings / driver names / nav** — a bold, condensed, technical sans. `Titillium Web` (free, Google Fonts) is a standard choice in motorsport dashboard work for exactly this reason: geometric, slightly futuristic, reads cleanly at small sizes. Don't use F1's actual trademarked logotype or wordmark anywhere — this is an unofficial fan/hackathon project.
- **Data / numbers / timestamps / A-V-D values / lap times** — a monospace: `JetBrains Mono` or `IBM Plex Mono`. Every number in the UI sits in this face so digits align in a column, the way a real timing tower does. This one change does more to make the dashboard feel like an instrument than almost anything else here.

### Layout concept

- **Telemetry tab** — the pace/stress chart is the hero: full-width, top of viewport, animates in on load. Never let a judge look at an empty chart while it fetches.
- **Messages tab** — restyle each radio message as a timing-tower row: driver number chip, monospace timestamp, transcript, WER badge, then the signature gauge below (not three stacked progress bars).
- **Upload tab** — keep this the simplest screen in the app. It's your live-demo moment; it needs to work first try, every time, in front of judges.

## The signature element: shift-light stress strip

Replace the current three separate Arousal / Valence / Dominance progress bars with one instrument, styled after an F1 steering wheel's shift-light LED strip:

- 10–12 horizontal LED segments. Number lit = arousal level. Color sweeps green → yellow → red across the strip, the way a rev limiter climbs toward redline.
- A thin white tick mark shows where the current `T_arousal` threshold sits. When someone drags the Threshold Tuner slider, they watch the tick move live and see which messages cross into "lit red." This turns your one interactive ML feature (reclassify) into your best visual moment too.
- Valence and Dominance collapse into a small compass-needle arc beneath the strip instead of separate bars — one glance, three numbers, no scrolling per row.
- On hover, surface the exact float values plus the model name (`wav2vec2-large-robust-...`) — this is where you sell the ML depth to a technical judge without cluttering the default view.

Spend your visual boldness here. Keep everything else — cards, spacing, layout — quiet and disciplined around it.

## Motion — purposeful, not ambient

- Chart line draws in once on load; it doesn't loop.
- The shift-light strip flashes briefly when arousal crosses a threshold — not a permanent pulse (loops read as noisy mid-demo).
- Respect `prefers-reduced-motion`.
- If you can't name the real-world telemetry behavior an animation mimics, cut it.

## Copy — pit-wall voice, not app voice

Write like a race engineer's readout, not a consumer app. One line, active voice, no exclamation marks, used only at loading/empty/error moments — not as decoration everywhere:

- Loading: *"Reading the radio…"* — not "Loading, please wait."
- Empty state (no race selected yet): *"Select a session to pull up the wall."*
- Upload error: *"Lost the signal — check the file and try again."* — not "An error occurred."

## Hackathon reality check

- The chart and the shift-light strip are what a judge remembers. Polish those two first.
- Every screen a judge might see mid-demo needs a real state — no blank white flashes, no `undefined` while data loads. Build skeleton/loading states for the chart and timeline before you need them live.
- It's likely demoed on a projector: push base contrast and font-size up from what looks fine on your laptop, and check `--wer-mid`-style gray tones are still legible from the back of a room.
- Mood must be readable without color: keep the text label (`STRESSED` / `CALM` / `FATIGUED`) plus an icon next to every color-coded element — for colorblind judges, and for you when the projector washes the colors out.

## Suggested build order (time-boxed)

1. Fix the WER/mood color collision + swap in the two typefaces — highest visual impact, lowest risk, CSS-only.
2. Build the shift-light stress strip component — the signature piece.
3. Restyle the Messages tab as timing-tower rows.
4. Chart load-in animation + threshold-tuner tick-mark sync.
5. Loading / empty / error states + the microcopy pass.
6. Responsive + projector-distance pass — test at actual demo resolution, not just your laptop.

## Definition of done

- [ ] No red/green/yellow used anywhere except mood badges.
- [ ] Every number on screen renders in the monospace face.
- [ ] Shift-light strip replaces the three progress bars and stays in sync with the threshold slider.
- [ ] Chart, timeline, and upload flow all have real loading/empty/error states.
- [ ] Every mood badge has a text label, not color alone.
- [ ] Full flow — select race → driver → view timeline → upload a clip — works end to end after every change.
- [ ] Checked on a large external display at demo distance, not just your laptop screen.
