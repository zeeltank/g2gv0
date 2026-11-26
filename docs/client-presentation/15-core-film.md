# 15. The Scholar Core film (26 Nov 2026)

An 82-second silent product film for Scholar Core, built as ONE continuous 3D world that a camera travels through: a real school-office desk, a wall of the 25 real K12 screens, the six modules that ask questions of the school's records, an AI draft that waits for a person, and six role stages. 1920x1080, 30 fps, no audio (captions only). All words are the checked text of the Scholar Core tour (`lib/client-presentation/generated/atlas.json`, `tour`), so nothing is typed twice and nothing is claimed that the tour does not say.

## Story (seconds)
| Time | Layout | Subject | Words (from the tour) |
|---|---|---|---|
| 0 to 3.6 | FULL | a real photograph (Pexels, a school bus in Chandigarh); the camera pushes through it | the morning situation, tagged illustrative |
| 3.2 to 9.4 | SPLIT | the desk: three papers (clipboard, notepads), a real laptop | three books, three versions of the truth |
| 9.4 to 13.6 | SPLIT | the laptop shows the real Fees screen; the three papers fly into it | "One record" and "Scholar Core gives every desk one record to open" |
| 13.6 to 28.3 | WIDE | the wall: 25 real screens fly out of the laptop into five rows; the camera settles on each group | "Scholar Core", the tagline, a counter to 25, each group title and its module names |
| 28.3 to 42.3 | SPLIT | the intelligence ring: six real screens around the school's records, threads drawn to each | the lead, then each module name and its question, then "raises nothing rather than guessing" |
| 44.9 to 54.5 | SPLIT | an AI draft preview types itself, a pointer presses Apply | the four uses, "Nothing is written to a field until a person presses Apply" |
| 54.5 to 74.3 | SPLIT | six stages, one real object each: projector screen (showing a real screen), laptop + clipboard, cash register, chalkboard + school desk, hand truck + boxes, school desk + chair | the role, who it is, its first benefit |
| 74.5 to 81.7 | WIDE | the finished wall, a slow push | "Scholar Core", the tagline, "Institute ERP · 25 modules" |

## The grid (the rule of these films: equal columns, one baseline, names in the same place every time)
Every caption sits in a named slot, always at x = 140: K (kicker, y 96), LEAD (170), LAB (500), HEAD (540, size 96), BODY (780, size 38), FOOT (960), a two-line list (350, pitch 84), and in the wide layout WHEAD (790), WBODY (910), WFOOT (962), WNUM (right edge 1780). Every shot has one of three layouts and puts its subject on that layout's **anchor**, a fixed screen point set with the camera's view offset: SPLIT (1395, 540), WIDE (960, 400), FULL (960, 540). Objects are sized by a pixel target (`pose()` in `story.js`), so a desk, a laptop, a ring and six different role objects all read at the same size. `?grid=1` draws the grid over the frame.

## Run
```
cd film-studio
node fetch-core-assets.mjs                 # CC0 models + HDRI (Poly Haven) and two Pexels photographs -> D:/client-presentation-assets/tour-core/assets
FILM_ASSETS=D:/client-presentation-assets/tour-core/assets node server.mjs 3321
node shot.mjs --page /core.html --base http://127.0.0.1:3321 --times 6.5,16.2,49.9 --out <dir>      # stills (add ?grid=1 to the page to see the grid)
node lint-core.mjs                         # every caption against its slot and layout, every 0.25 s
node purity-core.mjs                       # a frame depends only on t, however the timeline got there
node render.mjs --page /core.html --base http://127.0.0.1:3321 --name scholar-core-film --out D:/client-presentation-assets/tour-core/film-out --crf 19 --maxrate 2400k
```
(Git Bash rewrites a leading `/` argument: set `MSYS_NO_PATHCONV=1`.) The render aborts unless the renderer is the NVIDIA GPU. About 9 minutes on a GeForce MX550.

## Checked
- **Grid lint:** 325 sampled times, 863 caption readings, 0 failures. Its self-test proves it fails on a caption 10 px off, one too wide, two that overlap and one past the foot. It found real overlaps (two question captions fading at the same moment), now fixed.
- **Determinism:** 14 times across the film, each compared after a straight seek and after scrubbing past and back: the same frame at all 14 (one differs by 13 pixels of one level of anti-aliasing on animating digits). It caught a real bug: a `fromTo` fade left the picture black after a scrub across the cut to the roles. Fades are now plain chained `to` tweens. Lesson, again: never `fromTo` a shared property (the earlier film notes say the same).
- Full decode of the MP4 with ffmpeg: see the render notes in `00-PROGRESS.md`.

## Licences (all in `D:/client-presentation-assets/tour-core/assets/CREDITS.json`, copied to `docs/client-presentation/assets/tour-assets.json`)
Models and lighting: Poly Haven, CC0 (metal_office_desk, classic_laptop, clipboard, office_notepads, desk_lamp_arm_01, projector_screen, CashRegister_01, SchoolDesk_01, SchoolChair_01, standing_chalkboard_01, hand_truck, cardboard_box_01, stationery_supplies; HDRIs monochrome_studio_03, brown_photostudio_05). Photographs: Pexels licence (free for commercial use, no credit): 30473509 (used), 30703604 (downloaded, not used). No credit is shown on screen. The screens are the masked K12 captures already approved for the deck. No GIF is used (Giphy and Tenor are not licensed for a client deck).

## Not verified / decisions for the owner
- It plays as slide 19 of the web deck (between the Core opener and the tour; plan kind `film`, a smaller 12.4 MB copy in `public/client-presentation/film/`) and as a video slide in the PowerPoint (the full 19.7 MB render). Nothing about the story changed: it does not yet show the Research tab.
- The desk's laptop is a 1990s model (the only laptop in the CC0 sets), on purpose-ish: "the old office". Say if you want a different look.
- The role objects are honest stand-ins (no school bus, ID card or receipt model exists in the CC0 sets).
- Whether PowerPoint opens the file without a repair prompt and autoplays the videos.
