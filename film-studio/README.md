# ScholarClone film studio (3D motion graphics, version 2)

Renders the 59-second silent film. Source of truth for the words and timings: `lib/client-presentation/generated/film.json`
(generated from `docs/client-presentation/content/film.json`). Nothing here is recorded in real time: every frame is computed from one
time value `t`, so a render repeats exactly on the same GPU.

## What it is
- `src/main.js` the engine: one paused GSAP master timeline, nine beats (`src/beats/b1.js` to `b9.js`), each a module that returns
  `{ scene, camera, frame(t), seam?(t), build(tl) }`; the engine renders the live beat or two beats (during a seam) into half-float 4x MSAA
  targets and composites them with a transition shader, vignette, grain and neutral tone mapping. Captions are HTML above the canvas.
- `src/layout.js` fixed-layout helpers: the camera looks straight at a plane at exactly 100 px per world unit, so a beat can be laid out in
  screen coordinates (equal columns, one baseline). The modules beat (b4) and the workflow beat (b5) use a tilted camera and project
  their label anchors from the 3D scene instead.
- Visual rule: every beat has its own picture, not repeated boxes. Layouts sit on a grid; names and lines are set in the same place in
  every column; objects are real models doing what their product does (see the comment at the top of each beat).

## Run
```
npm ci
node fetch-assets.mjs        # downloads the CC0 models, HDRIs and textures to D:/client-presentation-assets/film3d/assets (51 MB)
node server.mjs              # port 3320 (static server with the mounts it needs)
node shot.mjs --times 24.3 --only 4 --out <dir>      # stills for design review (Chrome on the NVIDIA GPU)
node render.mjs --name scholarclone-59s-v2           # the film: about 6 minutes on a GeForce MX550
```
`render.mjs` aborts unless the renderer string names the NVIDIA GPU (software and integrated renderers give different pixels).

## Licences and credits
`CREDITS.json` lists every downloaded model, HDRI and texture (Poly Haven and ambientCG, all CC0). Photographs are Pexels, credited on
screen. three.js is MIT; GSAP 3.15 is free including its plugins; check the GSAP licence terms for company use before publishing the
repository.
