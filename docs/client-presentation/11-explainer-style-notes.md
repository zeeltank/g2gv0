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
