# 11 Explainer clips: style study, tool choice, product-name decision

Date 2026-11-24. Tags: **verified** = I ran it or looked at it myself this session; **read** = taken from a page or a research report and not re-checked; **inferred** = my reasoning.

## 1. What was studied, and how little it shows
The two reference Shorts were studied from the public thumbnail frames YouTube serves (one 1280 px frame and three small frames each). **I did not see them move or hear them.** So everything below is about composition and treatment, not timing.

| Short | What the frames show (verified) | Technique taken as an idea |
|---|---|---|
| `kaGP7tuTmeE` "SaaS Explainer Video: simple and practical UI design" (a bank's mobile app) | Glass-like white cards stacked in perspective, one card large and in focus ("Wallet", currency rows), soft teal-to-green gradient, a brand mark top left, small legal line at the foot. The vertical video sits on a blurred, enlarged copy of itself. | Cards tilted in depth; one idea per video; brand mark in a corner; a calm gradient instead of a busy scene |
| `y0DMsRT2U1U` "SaaS product demo video (UI animation)" | Three large white rounded cards on a blue-to-pale-cyan gradient: a coloured file icon, a file name, and a grey "Analyzing..." line. Same blurred-copy background. | A state that changes (working to done); three cards, no more; big rounded shapes; one colour per object |

Nothing was copied: no layout, colour, text or asset. What the clips take from them: **one idea per clip, three or four large cards, a visible state change, a tilted entrance, a calm gradient, the brand mark in one corner.**

## 2. What the clips are, and what they are not
- Five clips (Core, Learn, CCB, Insight, Compass), 15 seconds each, in 9:16 and 16:9. Text lives in `content/clips.json`; every capability line cites a claim in the ledger; the checker (`check-story.mjs`) applies the slide rules to it (status words, percentages, money, unverified claims, a claim on every capability line). Four mutations were tried and each was caught.
- **They are motion graphics with made-up school data, not recordings of the running product.** The plan was to record the running product on a demo tenant. That was not possible safely: the local backend points at the shared database that the repo's own notes call production, and no demo login was available to me. So every clip says "Illustrative school data" on screen, the register says "not a screen recording", and the presenter notes carry the same line.
- To make real recordings later: a demo-tenant login in environment variables, the owner's confirmation that the tenant is demo-only, and the no-write rule (no fee save, no question generation, no agent run). The recorder would reuse `render-clip.mjs`'s browser setup; the privacy guard (page text must hold no e-mail or phone number) is already in it.

## 3. Tool choice (rule written before the choice)
Rule: pick the route that is open source or free for a company, repeatable frame by frame, built from tools already in the repo, and small in output.

| Route | Facts | Verdict |
|---|---|---|
| Remotion | Source-available, not open source; free for one person or up to three people, a paid Company licence above that (read from the licence page by the research step, not re-checked). | Not used. The owner asked for open source, and the licence is unclear for a company. |
| Motion Canvas | MIT licence (read). Not tried. | Kept as a fallback. |
| **React + GSAP timeline, Playwright frame stepping, ffmpeg** | Built and run this session (verified): one paused GSAP timeline per clip; the page exposes `window.__clip.seek(t)`; Playwright opens it at the exact stage size, seeks every 1/30 s and screenshots; the JPEGs go to ffmpeg (H.264, yuv420p, BT.709, faststart, no audio). 56 to 75 s to render a 15 s clip. 10 files, 1.35 to 1.52 MB each. | **Chosen.** The same component plays live inside the slides (crisp at any size, no video weight) and renders to video for sharing. |
`ffmpeg-static` (npm, installed in `D:/client-presentation-assets/_video`, not in the repo) is a Windows build under a GPL licence. It is used only to encode our own files; it is not shipped or linked into the app.

## 4. Product name: "Teach Connect" or Scholar names (decided)
The running product is branded **Teach Connect**; the words Scholar Core, Learn, CCB, Insight, Compass never appear in its screens (read, from the code review).
Both versions were built: **A** shows a "Teach Connect" bar above the cards (`?ui=shown`); **B** shows no product screen name. Scenarios compared:

| Scenario | A (name shown) | B (name hidden) |
|---|---|---|
| 9:16 clip on LinkedIn or WhatsApp, seen cold | A name nobody knows next to a name they do | Reads as one brand: ScholarClone |
| 16:9 clip inside the deck in a live meeting | Raises "is Teach Connect a different product?" | No question to answer |
| Five-slide first meeting | Same as above | Cleaner |
| Follow-up e-mail with the clip | Same as above | Cleaner |
| PowerPoint copy | Same as above | Cleaner |
| The moment a school logs in and sees Teach Connect | Consistent, but only if the clip were a real recording of that screen | Not contradicted, because the clip does not pretend to be that screen |

Rule: pick the version that (a) outside leaders explain correctly, (b) does not contradict what the customer sees after login, (c) keeps the claims ledger intact; on a tie, A.
**Decision: B for these five clips.** (a) cannot be measured yet (no outside leaders have seen them). On (b) and (c): these clips are illustrative cards, not the product's screens, so putting the product's screen name on them would claim a fidelity they do not have. A also had a layout fault (the label slid under the cards); it is fixed but A is not published.
**When real recordings exist, use A**: a true recording shows the true screen, and honesty about what the customer will see wins the tie.
The product-name question itself (one name across the website, the screens and the deck) is for the owner; this document only records that the clips do not add a third answer.

## 5. Still not checked by anyone but me
- Each module owner confirming "this is what the product does" (the register's `confirmed_by_module_owner` is null for all ten files).
- Five outside school leaders passing a two-second recall test, and saying what each clip is for.
- Playback on an actual phone (WhatsApp, LinkedIn): the files pass the format checks (H.264 High, yuv420p, size, duration, shape) but were not played on one.
- A real screen recording of any flow.

## 6. Reproduce
```
node scripts/client-presentation/render-clip.mjs --clip all --ratio both --ui hidden      # needs the dev server on :3210
node scripts/client-presentation/register-clips.mjs --publish                              # checks, copies, writes clips-register.json
node scripts/client-presentation/render-clip.mjs --clip core --ratio v --stills 4,8,12     # stills only, for design review
```

## 7. The 59-second film (2026-11-24)
The owner asked for one advanced motion-graphics film, silent with burned-in captions, built from the topics of the G2G "Repository" artifact (Summary, Problems, Modules, Workflows, Stakeholder views, Reports, AI capabilities, Connects to, Screenshots, Benefits, FAQs, Proof, Fit) but for ScholarClone K-12, with the topics that do not fit going into the PowerPoint. It sits at slide 6 of 17 in the web deck and at slide 6 of the editable PowerPoint, after "Introducing ScholarClone".

- **What is in the film** (`content/film.json`, nine beats timed for reading, about 0.5 s plus 0.3 s a word): Hook, Problems, Summary, Modules, Workflows + AI, Stakeholder views, Connects to + Reports, Benefits + Fit, End card. **PowerPoint appendix** (four editable slides, `appendix` in the story file, every row cites a verified claim): Stakeholder views, Reports and connections, FAQs, Fit. **Not used anywhere**: Screenshots (no real ones exist yet), Proof (no customer, number or testimonial is allowed); FAQ answers that need facts the ledger does not hold (hosting, data protection, price) are listed in the slide notes as "owner to confirm".
- **How it is made**: one paused GSAP master timeline (`film/film-scenes.tsx`) on a 1920 x 1080 stage, rendered frame by frame by `render-film.mjs` (Playwright seeks, ffmpeg encodes H.264, BT.709, no audio). Techniques: offset tile-mask kinetic type and mixed light and heavy weights (from the two references), a drawn ring that zooms through into the next beat, a real photograph on a 3D plane, flying paper slips and a camera drive-through, a logo ring and wordmark reveal, six 3D slabs with an orbiting camera and a counter, a DrawSVG chain with a MorphSVG circle-to-spark, a cursor that clicks through four windows, DrawSVG connections, report sheets, grain, vignette, microtext chapter labels. Five kinds of seam only (zoom-through, colour flood, object-becomes-world, directional whip, dip cut), each caused by something on screen.
- **Motion blur**: eight fast windows (the seams) are rendered as four sub-frames across a 180-degree shutter and averaged by ffmpeg `tmix` (776 extra frames); the rest is sharp. Checked on the encoded MP4: real directional streaks on the whips, no ghosting.
- **Skills and tools** (agent research, 2026-11-24): kept my own React + GSAP + Playwright + ffmpeg pipeline; read the rules of HyperFrames (Apache-2.0: easing by role, exits 40 to 50 percent shorter than entrances, text holds, shot lengths, transition kinds) without installing it. Not used: Remotion (licence), gsap-skills (large, mostly ScrollTrigger and React), Motion Canvas and Revideo (rewrite), Canva video (needs a paid plan).
- **References** (stills only, motion not seen): the YouTube Short "Master Motion Graphics Complete Free Course" (tile-mask type on a person) and the Pinterest pin "Motion inspiration - Frames" (a light weight against a heavy coloured one, overlap for depth, microtext). Ideas only; no asset was copied.
- **Known small flaws**: the last audience chip ("Academic leaders") wraps to a second row in the closing seconds of the Benefits beat; the dev-server badge is hidden in the render but appears in a development browser.
- **Not verified here**: PowerPoint opening the file without a repair prompt and starting the videos by itself (no PowerPoint on this machine; the autoplay timing block is the structure PowerPoint writes and was checked as well-formed XML with matching shape ids); playback on a phone or projector; the outside-leader two-second test; module-owner sign-off.


## 8. Film version 2: 3D motion graphics (2026-11-24, night)
**Owner feedback on version 1:** he liked the film but the pictures repeated (the same rounded boxes, cards and chips taken from the slides); he wants unique, advanced motion graphics, and asked for the best Claude skill or tool to be found by deep research and used with full effort. Then, on the modules frame: "not a proper grid layout, and no meaning connected with these models. Re-design this frame."

**Research** (`D:\client-presentation-assetsesearcheports\Advanced motion film toolchain.md`, five researchers and a report writer): no single skill is installable and better than the stack below; the winning approach is three.js (WebGL2, MIT) for real 3D with a paused GSAP master timeline and a `seek(t)` function, rendered frame by frame on the installed Chrome with the NVIDIA GPU flags. Rejected with reasons: Remotion (licence), OpenMontage (AGPL), Blender Cycles (about 129 hours on this laptop), Spline and Unicorn Studio (hosted), AI video (kept optional, not used), Canva video (paid plan).

**What changed in the picture (every beat has its own world, nothing is a card):**
| Beat | What the viewer sees |
|---|---|
| 1 Hook | a real magnifier (aperture) clip-masks the words; dithered ink resolves to cream under the lens |
| 2 Problems | a dark desk from above, one pool of light on the student photograph, three paper records at different heights, blue threads that stop just short |
| 3 Reveal | the ring floods ink to cream; the seal and the approved sentence, underlines drawn on |
| 4 Modules | one slab with a 3 x 2 blueprint grid; six bays in reading order, each with a real model doing its product's job: desk and chair (Core), encyclopedias falling into line under a lit bulb (Learn), microscope (CCB), a magnifier over dots that resolve to blue (Insight), a compass whose needle settles (Compass), the seal (One); one ring then draws round the whole slab |
| 5 Workflow and AI | one thread through six equal stations on cream paper, dotted while the information is raw, a literal gap that closes at "Deciding what to do", green at "Taking action", an arc back for review; the Learn path as a centred second thread; the AI line drafted in pencil grey and inked |
| 6 Stakeholder views | four round windows in four equal columns (three stock photographs, a real wall clock for operations staff), each with role, question, line and answering product in the same places |
| 7 Connects to + Reports | a 2 x 2 grid of the four parts of the school, three threads with pulses, two report sheets leaving the leadership node |
| 8 Benefits + Fit | a loose pile of three report sheets that tidies into one column at "without compiling by hand"; who it is for in five equal columns |
| 9 End card | back on the dark desk of beat 2, now clear: the seal lands, the wordmark, the approved invitation, the closing line held for the last two seconds |

**Layout rule added after the owner's remark:** every beat sits on a fixed grid (columns and baselines are exact), names and lines are set in the same place in every column, and an object is only used if it does what its product does. The beat-4 first draft (five plinths on an arc, objects unrelated to their names) was thrown away.

**Method:** `film-studio/` (see its README): `shot.mjs` for stills during design, `render.mjs` for the film (Chrome DevTools capture, ffmpeg H.264 BT.709). Real CC0 models, HDRIs and textures (credits in `film-studio/CREDITS.json`), stock photographs credited on screen. The words and timings are unchanged from version 1 (`content/film.json`); the checker rules and claims are unchanged.

**Not verified:** the film was reviewed from still frames and encoded frames, not on a phone, projector or in PowerPoint; the stock photographs stand in for a principal, a teacher and a student and are labelled illustrative (the owner decides whether to replace them with consented photographs of real staff); the operations window uses a wall clock, not a photograph; GSAP licence terms for company use were not read by a lawyer.


## 9. The Product Atlas: every module and sub-module (2026-11-25)
*(The slide structure described in the first paragraphs below, topical and 25 slides, was replaced the same day by the product-by-product flow; see "Redesign: product by product" at the end of this section. The data, rules, screenshots and open points still apply unchanged.)*
**Owner request:** the deck and film are liked but "not complete": for every module and sub-module the deck must say what it is, which problem it solves, its features, the research behind them, the technology (knowledge graph, AI without naming any outside model, intelligence), workflows, AI capabilities and benefits, and, at the end of the PowerPoint, real K12 screenshots, edited and animated, feature by feature. Big-letter slides alternate with animated slides; the number of new slides has no maximum.

**Product to K12 module map (owner):** Scholar Core = Institute ERP; Scholar Learn = LMS + PAL; Scholar CCB = People & Competency; Scholar Insight = Enterprise Brain; Scholar Compass = Career Counseling. The live menu (demo login, 2026-11-25) lists 26 + 5 + 6 + 7 + 4 sub-modules and 226 screens (`content/atlas/k12-menu-2026-11-25.json`, names and routes only).

**Data (one source, three renderings):** `content/atlas/part-*.json` hold one sheet per sub-module (summary, problem, features, research only where a document proves it, technology only where the code does it, benefit, workflow, data live/static/mixed, evidence paths, owner-to-confirm notes). `scripts/client-presentation/build-atlas.mjs` merges and checks them (word limits, banned words and status words, outside AI company or model names, evidence paths that exist) and writes `lib/client-presentation/generated/atlas.json` and `atlas-plan.json` (and `atlas-notes.json` for presenter notes). The web deck (`scenes/atlas-scenes.tsx`), the PowerPoint (`pptx-atlas.mjs`) and the tests read the same data. 49 sub-module sheets across 5 families; 25 web slides (big letters, family summaries, problem map, 17 sub-module spotlights, workflows, AI and technology, benefits, screens), 7 big-letter slides; the PowerPoint has one slide per sub-module and one overview slide per family, and the screen gallery as its last slides.

**Rules kept:** no result, percentage, price, customer or status word; no outside AI company, model or payment or messaging vendor on any slide; "designed from" instead of "research-backed" or "validated"; no learning styles; Insight is described as rule-based with a person approving; screens that are hidden, unfinished or call missing routes are not described as features (they sit in the sheet's owner-to-confirm notes, which go to the speaker notes only).

**Screenshots:** captured by `scripts/client-presentation/capture-k12.mjs` from the live K12 site with the owner's demo login (authorised in chat 2026-11-25), read-only (sign in, open pages by URL, screenshot; any write-looking request is aborted). The live school holds real student and staff data, so every page is masked in the page before the picture is taken: default-deny (only known interface words, numbers and dates stay readable; names, usernames, photos, initials, e-mails, phone numbers and long ids are blurred or replaced), then a scan of the text that is still readable; the still-readable text of every page is reviewed before a screenshot is approved. No unmasked image or page text is written anywhere.

**Not verified:** the new text has no module-owner sign-off yet; the sheets rest on source files, not on a run of the product; the screenshots come from one live school's data (aggregate counts on a screen are that school's own numbers); PowerPoint was not opened here.

**Status at the end of 2026-11-25 (checked):** 49 sub-module sheets, 25 new web slides (ids 201 to 225, before the invitation; the deck is 42 slides), 46 masked screenshots, one MP4 per atlas slide (25 videos, 18 MB, each fully decoded with no error), the editable PowerPoint is 110 slides with 31 autoplay videos (43.9 MB): each atlas slide is a video slide followed by its editable slides (one per sub-module, an overview per family) and the screen gallery is the last slides of the file. Checks: 2,420 unit tests, tsc and eslint clean, story checker `--ship` OK, `layout-lint` 0 fail on all 42 slides, axe 0 serious or critical on the 25 atlas slides, `verify.mjs` all checks passed, a real-time walk with Next presses from slide 201 to the invitation with 0 page errors.
**Sources on screen:** at the owner's request no photographer or site name is shown on any slide or in the film (the film's two credit lines now read "Illustrative stock imagery."); credits stay in `assets/assets.json` and in the deck's opt-in Credits panel. Only no-attribution licences are used for new assets.
**Open (for the owner):** `atlas-owner-questions.md` lists 306 points (hidden or unfinished screens, places where the menu document and the code disagree, wording to confirm); module-owner sign-off; a second person to read the still-readable text of every screenshot (`D:\client-presentation-incoming\k12*\manifest.json`, field `visible`); PowerPoint opening and autoplay.

**Fix after the owner's review (2026-11-25, later):** three screens were wrong: Consent had no picture (the live menu lists no screens under it, so its two screens were opened by their route), Capability Intelligence showed an error panel (replaced by its Capability Library), and Insight Overview had only a text card (its screen is the Enterprise Brain home). Every one of the 49 sub-modules now has a real screenshot (48 pictures, one shared). The picture card is removed whenever a sub-module has no picture (the features move up and the card is not drawn), the screens row is hidden when there are none to name, and the five affected videos were re-rendered. An error panel is not caught by the text scan because its words are blurred: check each picture by eye.

**Redesign: product by product (2026-11-25, owner's second review).** Owner: "after slide 17 start product 1, then only that product's details (the problem it solves, the technology, what is under it), then the module is complete and the next one starts; give a shortcut so after slide 16 I can start any product and go from one module to another directly, because a client may be interested in some modules and not want to see the others." The topical atlas (all summaries, then all problems, then all sub-modules, then all workflows) is replaced by this flow, built from the same 49 sheets:
- **Slide 17 (id 201) is the product hub:** five big buttons (Core, Learn, CCB, Insight, Compass), each with its K12 module, a two-line summary and its sub-module count. Click one, or press the key 1 to 5 from any slide, or press Next to see them in order.
- **Each product is one section, in this order:** opener (what it is, the problem it removes, the technology, the benefit, where AI and intelligence help), its sub-modules five at a time (one press of Next each: screenshot with a magnifier, what it is, problem, what could become easier, technology, designed from), "how it works" (the workflow chain, what it runs on, where AI and intelligence help) and its screens (up to nine edited screenshots, three by three). A product with no screenshot for a sub-module simply has no tile for it.
- **Shortcuts:** a product rail (All products, Core, Learn, CCB, Insight, Compass) is on every atlas slide of the web deck (the current product is lit), and the keys 1 to 5 work everywhere. The product sections run on into each other, so Next still walks the whole atlas; the last product runs on into the invitation.
- **Numbers:** 30 web slides (ids 201 to 230: 1 hub, 5 openers, 12 sub-module slides, 5 how-it-works, 7 screens), so the web deck is 47 slides (17 + 30). Core 25 sub-modules, Learn 7, CCB 6, Insight 7, Compass 4.
- **PowerPoint:** the hub is slide 17 and is an editable slide whose five product names and "Open" links jump to the first slide of each product; every atlas slide carries a hyperlinked product strip at the top (All products · Core · Learn · CCB · Insight · Compass) and a "Next product" link at the bottom (the last product's link goes to the invitation). Per web slide there is an autoplay video slide followed by its editable slides (one per sub-module). The gallery is no longer last: each product ends with its own screens. The video files are `atlas-a2` to `atlas-a30` (the hub has no video).
- **Re-rendering:** the render keys changed with the plan, so the old topical videos were moved to `D:\client-presentation-assets\atlas-video-old-topical` (not used). `render-atlas.mjs` holds each kind a set time (opener 4.2 s, how-it-works 3.6 s, sub-modules 3.6 s a beat, screens 3.4 s).
- **Status (checked, 2026-11-25):** 29 videos (`atlas-a2` to `atlas-a30`, 16.1 MB, each fully decoded with no error, posters present); the PowerPoint is 117 slides (hub at slide 17), 35 autoplay video slides, 45.5 MB, every slide link resolves; 21 atlas and navigation unit tests, tsc and eslint clean, story checker `--ship` OK, `layout-lint` 0 fail on all 30 atlas slides (29 near-alignment warnings of 3 to 9 px, none blocking), axe 0 serious or critical on the 30 atlas slides, `verify.mjs` all checks passed; in a browser the hub shows 17/47, key 3 opens CCB (33/47), key 5 opens Compass (43/47), the rail and the hub tiles open a product, and Next from the last Compass slide (46/47) reaches the invitation (47/47), 0 page errors. Not verified: PowerPoint opening the file without a repair prompt and autoplaying the videos, and the hyperlinks inside PowerPoint's slideshow (checked in the file, not in PowerPoint).
- **Small fix found on the way:** a button centres its content vertically unless it is a flex container, so the hub's columns drifted with the length of each summary; the columns are flex containers now. The CCB family summary lost its closing "all under People & Competency" (the module label already says it).
