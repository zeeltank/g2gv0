# 17. Handover and playbook: safe stop, 26 Nov 2026 (night)

One file for tomorrow. Part A is the state (what is done, where it is, what is next). Part B is **how I work**, in particular how I find assets and facts from several deep-research streams in parallel, quickly and safely. Read Part A, then `docs/client-presentation/16-illustrated-tours.md` (the style bible), then start.

---------------------------------------------------------------------------------------------------
## UPDATE 27 NOV 2026, EVENING: FINISHED AND PUSHED (read this before everything below)
**State:** all five products have the illustrated (sketchbook) tour, including Scholar Core (its original ink tour is kept as `content/atlas/_drafts/tour-core.ink.json`; to go back, copy it over `tour-core.json` and run `build-atlas.mjs`). The Core film is gone from the web deck and the PowerPoint. The owner approved the generated pictures on 27 Nov (recorded in `assets/tour-art.json`). The final PowerPoint is `D:\client-presentation-assets\out\ScholarClone-Client-Presentation.pptx` (the five-slide short version sits beside it). The work is committed and pushed to `milan1` and a PR is open (see `00-PROGRESS.md`, last entry).
**Provisional:** Core's figures were taken from pictures generated earlier that day because the free allowance ran out: three of Core's six roles (Admission and front office, Accounts, Operations) show no figure. Core-specific figures: prompts in `D:/client-presentation-assets/tour-masters/core-slots.json`; after the quota resets (00:00 UTC) run `generate-tour-art.mjs --family core --slots ... --out <scratch>` with a Cloudflare token in `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` (the owner must revoke the token he pasted in chat), cut out, pick by eye (reject laptops with logos), register under the same ids or new ids and edit the `art` map in `tour-core.json`, then lint, purity, verify, render the Core video, rebuild the PPTX.
**Open for the owner:** Insight's hidden Research tab (the research-list mapping is SETTLED: on 27 Nov evening the owner answered "EB to Insight, CCB to G2G", i.e. his mapping stands although the code supports the opposite; the EB list names nothing Insight uses, so its Research tab stays hidden unless he asks for the product's own model to be shown there); the unDraw licence position (masters kept unregistered); the security findings in each tour's `owner_to_confirm` (forward to whoever owns `next_lms_erp`); the generated-image terms (unverified; AI-only output may not be copyrightable).
**Still not done by anyone:** a cold read by an outsider (a pack exists for Learn: `_handover/learn-cold-read`), the PowerPoint opened on a real machine (autoplay and no repair prompt), a production build of the public share link.

---------------------------------------------------------------------------------------------------
## UPDATE 27 NOV 2026 (read this first; Part A below is the state of the night of 26 Nov)
**Owner answers (27 Nov):** Learn style approved, "improve it more"; no Canva top-up (credits rechecked: still `quota_exceeded`), use a free-tier tool; the three Learn roles confirmed; research lists stand (EB to Insight, G2G to CCB, career list to Compass), but see the evidence below.
**Done 27 Nov:** Learn polish (pills, cut-out sizing, bigger shots, chalk band, the hand-drawn boil, contrast fix: dimmed tabs 0.5/0.45 to 0.65 = 4.55:1), lint rule `picture-over-text`, Learn PowerPoint slides (`B.tourSketch`), Learn MP4 re-rendered (67.7 s, decode 0 errors), PPTX 94 slides / 24 videos / 802 links none broken, real-font text-fit check of all Core and Learn slides (0 issues; the check also fixed small Core overflows), OCR check of the pictures, cold-read pack (`D:\client-presentation-assets\_handover\learn-cold-read\`), purity tool now measures a differing hash (tolerance 100 px / 4 levels, printed), free-tier generator script `generate-tour-art.mjs` (dry-run proven; needs the owner's free Cloudflare token), full-deck layout lint 0 failures. **Engine:** labels apply/discard optional (a read-only sample card shows no buttons), sketchbook tours may have 1 to 6 roles, `verify-tour.mjs` handles one role, one group, a hidden Research tab and the last product.
**Research + evidence for the other three products (27 Nov, six read-only agents, every claim tabulated):** registers `assets/{insight,ccb,compass}-research-sources.json`; tours drafted from the evidence: `content/atlas/tour-{insight,ccb,compass}.json` (text validated with the full rule set; they still need their pictures: the validator refuses a sketchbook tour with unknown art ids). **The pasted lists do not match the code:** no repo cites any G2G item for CCB; "decision intelligence", "organizational learning" and "human-in-the-loop" are Insight (Enterprise Brain) screens, the capability items of the EB list sit in CCB; Insight's code uses neither O*NET nor ESCO (Insight's Research tab is therefore HIDDEN); Compass's code supports only O*NET (Interest Profiler, occupation data) and named entry-requirement sources, and none of the ten feature names in the career list exists in code. Insight has NO AI at all; CCB's AI quiz questions go live at once, an SOP is published only on Save and Publish; Compass has only one provable role (Students). Each tour's `owner_to_confirm` lists every correction and the security findings (routes without auth that trust the request body, a hard-coded O*NET login in `SyncONetOccupationData.php:37`, an unauthenticated route that returns employer contact columns).
**In progress at the stop of this update:** two sourcing agents (Pexels photos for 3 products; unDraw cut-outs + a Compass sketch band). When they report: `node <scratchpad>/prep-art.js <product>` (recolours to the palette; the copy lives in the session scratchpad: rewrite it from `recolor-cc0.js` logic if gone: MAP = unDraw purple to 1088F6, dark to 0C2A4A / 35495F, pale greys to B9CBDF / DCE8F5 / FFFDF6), then `register-tour-art.mjs --family <p> --manifest ...` for photos and cut-outs, `node scripts/client-presentation/build-atlas.mjs`, lint strict / purity / verify-tour `--family` / OCR / PPT check / MP4 render per product.
**Questions still open for the owner:** (1) [ANSWERED 27 Nov evening: keep his mapping, EB list to Insight, G2G list to CCB]; (2) create a free Cloudflare account and an API token (Workers AI permission) as environment variables `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` if he wants generated art; (3) Insight Research hidden: confirm; (4) forward the security findings to whoever owns `next_lms_erp`.

---------------------------------------------------------------------------------------------------
## PART A. STATE

### A1. What the owner asked (this session, in order)
1. Public share link, never-expiring option, the Vercel key/value (done earlier, PR merged).
2. A seven-tab product tour for each product after the hub (Summary, Problem told like a salesperson, Intelligence, AI capability, Research, Features and modules, Role-wise benefits). Scholar Core first (done, pushed, in main; slide 19 now).
3. A Scholar Core film, then its Research tab filled from his UNESCO / Ed-Fi list, film on the web deck, PR (done, pushed as f05ac74 into PR #401).
4. **Tonight:** "remove the video we made for Scholar Core from the PPT, we do not like it" and (his later answer) from the web deck too; **"we like slide 20 [the Core tour]: make the same type for the other products, one by one, but with different motion and with realistic, cartoon and sketch images based on the problem scenario and the modules; use the best Claude Code motion skills (deep research)"**. Then: research lists for the other products, "speed up, work in parallel, do not lose quality", "safe stop, continue tomorrow, one detailed document".
5. His standing wish (every message): the "deeper, not bigger" four-question template. Answered once in the plan file (`.claude/plans/pasted-content-id-fb39-i-want-snoopy-catmull.md`, last section).

### A2. Decisions already made by the owner
- Scope: the **other four products, one by one, Scholar Learn first**; Core's slide stays untouched.
- Film: out of the PowerPoint **and** the web deck.
- Images: **real stock photos + generated cartoon and sketch**. (Generation is blocked, see A5; the licensed fallback is in use until he decides.)
- Research lists: **EB list -> Scholar Insight, G2G list -> Scholar CCB, the untitled career list -> Scholar Compass**. Learn: use its own checked research line (Bloom, Webb DOK, CASEL, NGSS, NCDG, NCF, NCERT).
- Rules that never change: no status labels on slides; "designed from" never "validated / research-backed"; no outside AI vendor names, unsourced percentages, prices or customer names; fixed grid layouts, no repeated cards; real downloaded files, never code-drawn pictures; all words are live text; minors only in positive generic contexts; stage only my own files; **commit and push only when he says so**; branch `milan1` only; `git ls-remote` before any push.

### A3. Progress (about 37% of the whole programme, about 75% of Scholar Learn)
| # | Checkpoint | Share | State |
|---|---|---|---|
| 0 | Film removed from web deck and PPT | 5% | DONE (deck 39 slides, PPTX 96, no film media) |
| 1 | Engine: per-tour `style`, caps, intelligence `basis`, `labels`, `art` slots, register, validator mutation-tested | 10% | DONE |
| 2 | Learn content + research register + evidence pass | 6% | DONE (owner confirmations pending) |
| 3 | Style bible + images + owner gate | 9% | MOSTLY: bible written, 2 photos + 5 cartoons + 1 sketch registered; **gate with the owner not done** |
| 4 | Learn scene (7 tabs), PPT slides, MP4 | 13% | scene DONE and checked; **PPT editable slides NOT done; MP4 is STALE (rendered before the art went in: re-render)** |
| 5 | Learn outside verification | 7% | tools done (lint, purity, 30 interaction checks); **not done: a person outside the team reading each tab cold, PowerPoint on a real machine** |
| 6 | Insight (EB list), CCB (G2G list), Compass (career list), about 15% each | 45% | NOT STARTED |
| 7 | Whole-deck re-render, PPTX, final checks, docs | 5% | NOT STARTED |

### A4. Where everything is (nothing is committed or pushed)
- Repo `C:\Users\MILAN\Downloads\g2gv0`, branch `milan1`, local head = origin = `de7eae7` (the other session's commit). **37 changed/new files, uncommitted.** Backup of all of them: `D:\client-presentation-assets\_handover\g2gv0-uncommitted-2026-11-26.zip` (list in `uncommitted-files.txt`, same folder). Unzip with `tar -xf` from the repo root to restore.
- New: `scenes/sketch-tour-scene.tsx`, `scenes/sketch-tour.css`, `lib/client-presentation/sketch-motion.ts` (+ test), `scripts/client-presentation/register-tour-art.mjs`, `content/atlas/tour-learn.json`, `assets/tour-art.json`, `assets/learn-research-sources.json`, `public/client-presentation/tour/learn/*.webp` (8 files), docs 16 and 17.
- Changed: `atlas.ts`, `tour.ts`, `build-atlas.mjs`, `build-pptx.mjs`, `render-atlas.mjs`, `shoot-tour.mjs`, `verify-tour.mjs`, `layout-lint.mjs`, tests, generated atlas files, `part-learn.json` (two overclaiming lines corrected), `tour-core.json` (film block removed), progress docs. Deleted: `film-scene.tsx` and the 12 MB web film (kept in git history).
- Masters outside the repo (`D:\client-presentation-assets\`): `tour-masters\learn\photos` (5 Pexels originals + manifest), `tour-masters\learn\cc0` (+ `web\` recoloured copies, `originals\`, `cc0.json`), `atlas-video-v2\atlas-learn-tour.mp4` (stale), `out\ScholarClone-Client-Presentation.pptx` (96 slides, built before the Learn tour existed: rebuild).
- The Core film source stays in git (`film-studio/`, `15-core-film.md`) as a record; nothing plays it.

### A5. What was verified, and what was not
Verified (numbers): 68 deck tests pass; tsc and eslint clean in client-presentation; validator rejects 10 deliberately corrupted copies; Core regression: 15 of 16 stills byte-identical, 1 differs by 14 px of anti-aliasing; Learn tour: layout lint strict 0 fail / 0 warn on all 10 steps, purity byte-identical at 8 probe times, `verify-tour.mjs --family learn` 30 checks pass, MP4 decoded with 0 errors (but stale). The film was removed and the PPTX rebuilt (733 links, none broken).
**Not verified:** PowerPoint opening and autoplay (no PowerPoint here); the Learn PPT editable slides (not built); a production build of the public link after tonight's changes; reverse-image search and OCR on the pictures; a cold read by an outsider; Canva's output terms (page unreadable, HTTP 403).
**Blocker:** Canva image generation returned `quota_exceeded` (26 Nov). The owner chose "generated" for cartoon and sketch, so he decides: top up credits / give another generator, or accept the licensed pictures. Until then none of the art is generated.

### A6. Facts the evidence pass changed (do not lose these)
Source: a read-only agent read `next_lms_erp` and `lms_k12` (tables in the transcript; summary here).
- **"Staff review and approve every AI draft before it goes live" is FALSE for Learn.** AI-generated questions are saved live (status 1) with a Hold button; the content drawer stores AI output visible at once. Real draft-then-approve exists only for content-model tags (only approved are served), prerequisite links (approved or rejected), exam sheets (only Approved publish), branching scenarios. Text in a form (homework, exam, assign-work description) waits for Apply and then Save. The tour and the checked sheet now say only that. Presenter note: never say generated questions wait for approval.
- Rules, not AI, choose each learning step (skip at mastery 0.80 or more; a prerequisite under 0.75 blocks; recheck after 2, 7, 30, 60, 180 days); AI only phrases it. "Show why" has no source: removed.
- Roles: Teacher and Student are read in source. There is **no academic-coordinator / HOD role** and **no parent view** in Learn. "School leaders" (principal, administrators) is inferred from the admin tier: confirm.
- Menu rights per profile live in the database (`tblgroupwise_rights`), not in source.
- Side findings for the owner (not on any slide): Portfolio and Virtual Classroom call routes that do not exist (demo data); Export PDF has no handler; `next_lms_erp routes/api.php` lines 251-255 (question-bank review), 688-709 (lesson-intelligence) and 299-313 (homework assign) run **without middleware and trust `sub_institute_id` from the request body**. That is a security question.
- Research (Learn): each source opened on its official site. NGSS and CASEL are tag vocabularies in the code (NGSS: practices only; roadmap lists NGSS alignment as coming soon; CASEL: self-awareness left unmapped on purpose), so the Research lead for Learn is **"Frameworks it draws on"**, not "Designed from" (the lead is now data: `research.lead`). Open: Webb DOK scope (the question generator derives DOK from Bloom), NCDG version, NCERT outcomes cover the elementary stage only.

### A7. Questions for the owner tomorrow (the gate)
1. **Style:** look at the Learn tour stills (paper, tape, marker, taped photos, cartoon cut-outs, chalk sketch). Approve, or say what to change, before the other products copy it.
2. **Generated vs licensed art:** top up Canva credits / name another generator, or keep the licensed pictures (unDraw cut-outs, one Degas chalk drawing, Pexels photos)?
3. Confirm the three Learn roles (Teachers, Students, School leaders) and that no coordinator / parent role is shown.
4. Read the unDraw licence once (it excludes redistributing files "in packs" and AI training; a few cut-outs inside a page is normal use) and the Met's open-access page (its policy page was rate-limited here; the CC0 wording was read from the Met's GitHub/API).
5. Keep `film-studio/` source in git (default: yes)?
6. The security finding in A6: forward to whoever owns `next_lms_erp`?

### A8. Next actions, in order (tomorrow)
1. `cd C:\Users\MILAN\Downloads\g2gv0`; `git status` (expect the 37 files); `git fetch`; if the other session has pushed, nothing here conflicts (different files).
2. Start the dev server: `node node_modules/next/dist/bin/next dev -p 3412` (background). **Use `http://localhost:3412`, never 127.0.0.1.** Delete `.next` when finished.
3. Show the owner the gate (A7). While waiting, work on what does not depend on his answer:
4. **Learn PPT editable slides:** `pptx-atlas.mjs` `B.tour` uses Core coordinates on a dark theme; add a `B.tourSketch` branch (paper background, the same coordinates as `sketch-tour-scene.tsx`, pictures via `addImage` from `tour.art`, webp converted to PNG with sharp). Check shapes numerically (no PowerPoint here).
5. **Re-render the Learn tour MP4** (art changed): `node scripts/client-presentation/render-atlas.mjs --name auto --keys a5 --base http://localhost:3412 --out D:/client-presentation-assets/atlas-video-v2`, full-decode with ffmpeg, rebuild the PPTX (`node scripts/client-presentation/build-pptx.mjs`), `node <scratchpad>/inspect-pptx.mjs <pptx>`.
6. **Outside checks on Learn:** OCR (tesseract) on each registered picture, reverse-image search, a cold read by one outsider, WCAG contrast of text on its block.
7. **Next product:** the plan's order was Insight (EB list), CCB (G2G list), Compass (career list). For each: (a) `part-<family>.json` sheet -> draft `tour-<family>.json` with `"style": "sketchbook"`; (b) read-only evidence agent per area; (c) research register from the owner's list (open every source on the web); (d) photos + cut-outs via the pipeline in B3; (e) lint, purity, verify, render. Insight and CCB have **no "rule-based insights"**: give each Intelligence module a `basis` that appears in its sheet's technology list. Compass has 4 modules: one group of 4.
8. Commit only when he says so: stage own files only, `git ls-remote origin milan1` first, trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`, PR body ends with the Claude Code line. A PR from `milan1` already exists (#401, merged); a new push needs a new PR or an update.

### A9. Commands that matter
```
node scripts/client-presentation/build-atlas.mjs                       # validate + regenerate generated/*.json (also: --check-only)
node --import tsx --test "lib/client-presentation/*.test.ts"           # deck tests (68)
node node_modules/typescript/bin/tsc --noEmit -p .                     # 3 pre-existing errors elsewhere (signals, intelligence-center), none in client-presentation
node node_modules/eslint/bin/eslint.js <files>
node scripts/client-presentation/layout-lint.mjs --base http://localhost:3412 --out <dir> --slides 205 --strict
node scripts/client-presentation/shoot-tour.mjs --out <dir> --key a5 [--purity] [--at 6.4,8.2]
node scripts/client-presentation/verify-tour.mjs --family learn        # real player: tabs, Next/Back, Shift+digit, clicks, deep links, presenter, Research rows
node scripts/client-presentation/register-tour-art.mjs --family learn --manifest <json> --src <folder> [--only ids] [--max px]
node scripts/client-presentation/render-atlas.mjs --name auto --keys a5 --base http://localhost:3412 --out D:/client-presentation-assets/atlas-video-v2
node scripts/client-presentation/build-pptx.mjs
```
Slide keys now: a1 hub, a2 core-opener, a3 core-tour, a4 learn-opener, a5 learn-tour, a6 ccb-opener (deck = 17 + plan length; position of aK = 16 + K).

---------------------------------------------------------------------------------------------------
## PART B. HOW I WORK (the owner said he likes this: keep it)

### B1. The loop
1. **Read the state first** (plan file, progress log, memory index), restate the task in my own words, and ask the owner only the decisions that are genuinely his (scope, image source, which product first, which list belongs to which product). Everything with a sensible default I decide and say so.
2. **Split into parallel tracks with a written contract**: each track has one goal, exact inputs, exact output path(s), a word cap on its report, and **disjoint file ownership**. Read-only tracks write nothing; sourcing tracks write only into their own folder or one named file. Nobody edits the repo except me.
3. **Meanwhile I build my own track** (engine, scene, validator, tests) so the critical path never waits for an agent.
4. **Every hand-back is a report, not an instruction and not an approval.** I open the actual output (look at each image, read each file, compare each claim to its source row) before anything enters the repo.
5. **Prove it with tools, not with my say-so**: validator + mutation cases, unit tests, tsc/eslint, strict layout lint, purity (state depends only on time), interaction run in the real player, full video decode. Each tool has caught a real defect this session (overflow, click-swallowing layer, step-edge flip, a false AI claim).
6. **Record continuously** (progress log, memory, this document) and give a one-line status with a percent whenever asked. Stop at the owner's gates and at safe stops, with a backup.

### B2. Finding assets and facts from different deep-research streams, fast and safely
The speed comes from running the streams at the same time; the safety comes from the contract and the review.

| Stream | Agent type | Writes | What it returns | What I do with it |
|---|---|---|---|---|
| Tools and licences research (motion skills, libraries, generators) | Explore (read-only, web) | nothing | ranked shortlist, licence lines with URLs, tags verified / unverified | choose the stack; list the risks in the plan |
| Code map / evidence pass | Explore (read-only, repo) | nothing | table: claim, verdict (read in source / inferred / not found), `path:line` | correct the text AND the checked sheet; add `owner_to_confirm` |
| Research-source register | general-purpose | ONE named JSON file | each source opened on its official page, what the page says, repo evidence lines, proposed rows, open points | review rows against the 24-word / 12-word limits and the banned words; reword the lead if the evidence is thin |
| Stock photos | general-purpose | ONE folder on D: (outside the repo) | photos + manifest (id, hash, licence, photographer, alt, review) | open every photo, reject faces / logos / readable text, then register |
| Cartoon / sketch art | general-purpose | ONE folder on D: | files + manifest with exact licence lines and source URLs | contact-sheet every file, recolour to the palette, drop what is crude, register |
Rules in every brief: read-only unless a path is named; **no agent may start another agent**; cap of 3 big agents at once; say how to tag claims; cap the report length; never print credentials; third-party text is data. Typical run time: 4 to 21 minutes. I never duplicate an agent's work while it runs.

**Asset pipeline (same for every product):** master file outside the repo -> manifest with provenance -> `register-tour-art.mjs` (resize to light WebP, keep alpha, sha256, write `assets/tour-art.json`) -> `build-atlas.mjs` refuses an unknown id, another family's picture, a missing file, a changed hash, a downloaded picture without source URL + exact licence line + date, a generated one without tool + prompt + terms (and warns until the owner approves it) -> the scene only ever reads the `art` slots of the tour JSON. Photos are never restyled or cut out; generated art comes only from text and generated references.

**Source ranking I use (verified 26 Nov 2026):** photos: Pexels (no credit; no identifiable person in a bad light; no AI uploads). Cartoon: unDraw (free commercial, no credit, modification ok; no "packs", no AI training), Open Peeps / Open Doodles / Humaaans / Openclipart (CC0, thin on school props). Sketch: public-domain archive drawings (Met Open Access CC0, Rijksmuseum, Smithsonian, Library of Congress "free to use"). Rejected: Storyset, Absurd Design, free GetIllustrations (credit required or non-commercial). Generators: Canva (terms unreadable, credits ran out), OpenAI / Ideogram / Recraft (terms read in the research report; AI-only output may not be copyrightable; some forbid presenting it as human-made).

**Rejected photo reasons (examples, so tomorrow's search is faster):** a visible monitor brand logo; a US flag and a readable teacher name; first names on a notice board; a mouse brand logo; Chinese text on boards; children's faces.

### B3. Evidence first, tabulated
A claim goes on a slide only if a source row proves it. Order: checked sheet -> read-only verification per area -> a table (claim | verdict | evidence) -> I tabulate each sentence against its row -> fix the text and the sheet -> put what cannot be proven into `owner_to_confirm` and the presenter notes. Tonight this removed a false "staff approve every draft" line from the slide, the sheet and the presenter script.

### B4. Communication habits
Plain words, short; one-line percent status when asked ("about 37%, what is running, what waits on you"); say what is unverified and why; say when something blocked (Canva quota) and what I did instead; never claim a check I did not run; tell the owner when I changed something he did not ask for (e.g. the checked Learn sheet).

### B5. Safety habits
Only my own files are staged; no commit or push unless asked; `git ls-remote` before a push; the other Claude session shares this tree and identity (do not attribute commits by author); delete `.next` after every dev run (it grew to 5.5 GB and filled `C:`); back up uncommitted work to D: at a stop; never touch scene files while a render runs (hot reload breaks it); run probes one at a time (the dev server is single-threaded); secrets only in the environment.

### B6. Traps found (so I do not meet them twice)
- Dev pages are **blank on `127.0.0.1`** (hot-reload socket blocked): always `localhost`; allow loopback in test origin blocks (the API is `127.0.0.1:8000`).
- A full-stage layer swallows clicks meant for buttons under it: `pointer-events: none` on layers, `auto` on controls (hit in both scenes).
- A purity probe that lands exactly on a **stepped-ease edge** flips by float rounding: probes carry +0.0137 s.
- `fromTo` on a property shared with later tweens paints its start at time 0: use chained `to`/`set`; jitter is laid down as one `set` per frame from a seeded function.
- Fixed row heights clip long text: let rows grow and cap the number of rows in the validator.
- Windows paths and backslashes in a bash/python heredoc (`\U`, `\a`) corrupt text: write scripts with the Write tool and use forward slashes.
- Git Bash rewrites a leading `/` argument (`MSYS_NO_PATHCONV=1`); `npx` resolves the wrong eslint/tsc (call `node node_modules/<tool>/bin/...`).
- `next build` rewrites `next-env.d.ts` (restore it); the other session's dev server may share the directory.
- An agent's "done" is a claim: two photo candidates had logos and readable names; the AI-approval line in the sheet had passed an earlier check.
- `gh pr create` is refused when an open PR already exists for the same branches: comment on it instead, and say so.

### B7. Pointers
Plan: `C:\Users\MILAN\.claude\plans\pasted-content-id-fb39-i-want-snoopy-catmull.md`. Memory: `C:\Users\MILAN\.claude\projects\c--Users-MILAN-Downloads-hp-erp\memory\g2g-client-presentation-deck.md` (round 14) and `feedback-parallel-tracks-with-a-contract.md`. Docs: `00-PROGRESS.md` (round 11), `14-tour-pilot.md`, `16-illustrated-tours.md`, registers `assets/tour-art.json`, `assets/learn-research-sources.json`, `assets/core-research-sources.json`. Backup: `D:\client-presentation-assets\_handover\`.
