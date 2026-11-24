# 09 Scene build contract (ScholarClone client presentation)

Applies to every scene file in `components/domain/lms/client-presentation/scenes/`. Quality bar: the four finished scenes `s01-hook`, `s04-info-to-action`, `s05-introducing`, `s15-invitation` (look at their screenshots before you start).

## 1. Ground rules
- You own ONLY the files named in your brief (the scene `.tsx` and its own `.css`). Do not edit anything else: not the shell, `ui/primitives.tsx`, `styles/base.css`, `motion/*`, `lib/**`, the story, the deck JSON, package files, or another scene. If you need a shared helper, put it in your own file.
- Never commit, push, deploy or touch any database. No `npm install`. Do not start sub-agents. Never use a code-drawn picture (no SVG illustrations of people, schools, books, robots, dashboards). Diagrams, lines, shapes, frames and type are allowed and encouraged.
- All on-screen words come from `slide.lines` (see `lib/client-presentation/generated/scholarclone.deck.json`, read it for your slides): use `textOf`, `textsOf`, `linesOf` from `@/lib/client-presentation/deck`. Do not type your own copy. Only purely structural characters (numbers "01", arrows, "+") may be yours. If a design needs a label that is not in the lines, do NOT invent it: lay the scene out without it and say so in your report.
- Every line you render must be present in the DOM at its final beat (a test checks that each `lines[].text` appears in the server-rendered markup). Hidden-until-a-beat is fine (opacity 0 via GSAP); not-rendered is not.
- Status badges: use `StatusBadge` for `slide.badge` and for line `badge` fields. `mark` on a step line (built / partial / concept) is shown with `StepMark` (shape as well as colour). Roles `today`, `ahead`, `limit`, `tag`, `proof`, `note` carry meaning: show what works today in a solid panel, anything "not built / design intent" in a visibly different dashed one, and keep the "Illustrative ..." tag on screen on any scene that has one. Never hide or shrink a limit.
- Photos: `assetOf(deck, slotId)` then `<Photo asset=... />`. A slot may be `null` (img-principal and img-staffroom are empty today): the scene must look finished without it (no empty grey box, no "pending" label). Screenshots: `<ShotFrame asset={assetOf(deck, 'shot-x')} label={slot.brief} proof={textOf(slide,'proof')} />`; they are labelled placeholders today. Never draw a fake interface.

## 2. Design language
- Fixed 1920 x 1080 stage (the shell scales it). Themes: `data-theme="ink"` (deep navy, cinematic) or `"paper"` (warm paper, reading). Set `style={themeVars(theme)}` on the scene root (from `@/lib/client-presentation/palette`).
- Type: `cp-display` (Fraunces, for questions and statements), Manrope for everything else. Sizes at stage scale: statements 58 to 104 px, body 28 to 34 px, labels never under 20 px. Generous margins (about 140 px sides), asymmetric editorial layouts, thin rules, hairlines, one idea per area. NOT a grid of identical rounded cards; vary the composition from slide to slide. No emoji, no stock-icon rows, no purple gradients, no glow-everything.
- Brand colours only (`--cp-*` variables in `styles/base.css`): ink, navy, blue `#1088F6`, green `#74CD23` (use sparingly, for LIVE), paper. Photos get a scrim so text stays at 4.5:1.
- Text must never overflow its box or overlap other text at 1920 x 1080 or at 1366 x 768.

## 3. Motion rules
- Every animation must reveal, connect or compare something. If it only decorates, delete it.
- GSAP is the only choreography engine inside a scene, through `useBeatTimeline(ref, build, { beat, beats, entry, reduced })` (`motion/use-beat-timeline.ts`). Build the whole scene on one paused timeline with labels `b0` (end of the entrance) ... `b<BEATS>`; each Next press moves to the next label. Use `tl.fromTo` so hidden start states apply immediately. Plugins available: SplitText (`SplitText.create`), DrawSVG (`drawSVG`), Flip, via `../motion/gsap`.
- Motion (`framer-motion`) may only own interface state: hover/press on a button, expanding rows, presence. Never let GSAP and Motion animate the same element's transform: GSAP on the wrapper, Motion on an inner element.
- The hook handles reduced motion (it shows the finished state at once). Do not add your own infinite loops unless `!reduced` and they carry meaning.
- Export `BEATS` (number of Next presses after the entrance). You may change your scene's BEATS (1 to 8) if the design needs it, and must report the final value.

## 4. How to work and prove it
- Study: `scenes/s04-info-to-action.tsx` and `.css`, `scenes/s05-introducing.tsx` (patterns for timelines, SplitText, DrawSVG, Motion hover), `ui/primitives.tsx`, `docs/client-presentation/content/scholarclone.story.json` (for your slide: `visual` and `motion` give the design intent; `on_slide` the roles).
- A dev server runs at http://localhost:3210 (do not start another). Screenshots: `node scripts/client-presentation/shoot.mjs --out <your folder under the scratchpad> --slides N --beats all --wait 1800` then LOOK at every PNG with the Read tool. Also run it with `--vp 1366x768` and with `--reduced`. Iterate until it is polished. Fix anything that overlaps, clips, is cramped or looks generic.
- Typecheck your files: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json 2>&1 | grep client-presentation` (about a minute; must print nothing) and lint: `node node_modules/eslint/bin/eslint.js <your files>`. Do not use npx.
- Report back (short): files written, final BEATS per scene, screenshot paths you checked, any label you wanted but did not have, anything you could not fix.
