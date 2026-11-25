// The film engine. One paused GSAP master timeline drives everything (3D state, DOM type); window.seek(t) sets the clock, renders the active
// beat scene(s) into half-float multisampled targets and composites them (transition, vignette, grain, tone mapping) to the canvas.
// No requestAnimationFrame loop, no Clock, no Date.now: a frame depends only on t, so renders repeat exactly on the same GPU.
import { gsap } from 'gsap'
import * as THREE from 'three'
import { H, W, clamp01, loadEnv } from './common.js'
import { root } from './dom.js'

const params = new URLSearchParams(location.search)
const FILM = await (await fetch('/data/film.json')).json()
const BEAT_IDS = ['hook', 'problem', 'reveal', 'modules', 'workflow', 'views', 'connects', 'claim', 'end']
const FILES = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9']

const canvas = document.getElementById('gl')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false })
renderer.setPixelRatio(1)
renderer.setSize(W, H, false)
renderer.toneMapping = THREE.NeutralToneMapping
renderer.toneMappingExposure = 1.0
renderer.outputColorSpace = THREE.SRGBColorSpace
{
  const gl = renderer.getContext(); const ext = gl.getExtension('WEBGL_debug_renderer_info')
  window.__gl = { renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown', max: gl.getParameter(gl.MAX_TEXTURE_SIZE) }
}

await Promise.all(['300 80px Fraunces', '800 80px Fraunces', 'italic 400 80px Fraunces', '500 40px Manrope', '800 40px Manrope'].map((f) => document.fonts.load(f)))
await document.fonts.ready

const envs = { studio: await loadEnv(renderer, 'studio_small_09'), dusk: await loadEnv(renderer, 'qwantani_dusk_2_puresky'), sunset: await loadEnv(renderer, 'qwantani_sunset_puresky') }
const tl = gsap.timeline({ paused: true })

/* ---- beats ---- */
const beats = []
for (let i = 0; i < FILES.length; i++) {
  const beat = FILM.beats.find((b) => b.id === BEAT_IDS[i])
  try {
    const mod = await import(`./beats/${FILES[i]}.js`)
    const b = await mod.make({ renderer, envs, film: FILM, beat, dom: root(), tl })
    b.index = i; b.id = beat.id; b.start = beat.start; b.end = beat.end
    beats.push(b)
  } catch (e) {
    if (!String(e).includes('Failed to fetch dynamically imported module') && !String(e).includes('404')) console.error('beat', FILES[i], e)
    beats.push(null)
  }
}

/* ---- transitions: from beat i to i+1; times are the seams of the film ---- */
const TR = [
  { at: 3.15, dur: 0.85, mode: 1 },   // 1 -> 2: iris out of the lens
  { at: 9.7, dur: 0.85, mode: 1 },    // 2 -> 3: ring floods ink to cream
  { at: 17.85, dur: 0.75, mode: 2 },  // 3 -> 4: zoom through the ring
  { at: 24.75, dur: 0.4, mode: 4 },   // 4 -> 5: whip
  { at: 32.3, dur: 0.5, mode: 3 },    // 5 -> 6: flood
  { at: 39.75, dur: 0.6, mode: 1 },   // 6 -> 7: iris through a portal
  { at: 45.0, dur: 0.7, mode: 2 },    // 7 -> 8: dive into the node
  { at: 51.0, dur: 0.7, mode: 1 },    // 8 -> 9: iris to the tabletop
]
for (let i = 0; i < beats.length; i++) {
  if (!beats[i]) continue
  beats[i].win = [i === 0 ? 0 : TR[i - 1].at, i === beats.length - 1 ? FILM.length + 1 : TR[i].at + TR[i].dur]
  beats[i].build(tl, { TR: { in: TR[i - 1], out: TR[i] }, T: { start: beats[i].start, end: beats[i].end } })
}

/* ---- persistent overlays: chapter label, disclosure, photo credits (microtext) ---- */
{
  const mk = (cls, str, pos) => { const e = document.createElement('div'); e.className = 'hud ' + cls; e.textContent = str; Object.assign(e.style, pos); root().appendChild(e); return e }
  const disc = mk('disc', FILM.disclosure, { left: '56px', bottom: '36px', fontSize: '19px', letterSpacing: '0.1em', textTransform: 'none', fontWeight: '600' })
  tl.fromTo(disc, { opacity: 0 }, { opacity: 0.8, duration: 0.5 }, 4.2)
  for (const b of FILM.beats.filter((x) => x.chapter)) {
    const e = mk('ch', b.chapter, { right: '56px', top: '42px' })
    tl.fromTo(e, { opacity: 0 }, { opacity: 0.8, duration: 0.4 }, b.start + 0.6)
    tl.to(e, { opacity: 0, duration: 0.25 }, b.end - 0.35)
  }
}

/* ---- composite ---- */
const rtOpts = { type: THREE.HalfFloatType, samples: 4, depthBuffer: true }
const rtA = new THREE.WebGLRenderTarget(W, H, rtOpts)
const rtB = new THREE.WebGLRenderTarget(W, H, rtOpts)
const quadScene = new THREE.Scene()
const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
const mat = new THREE.ShaderMaterial({
  uniforms: { tA: { value: rtA.texture }, tB: { value: rtB.texture }, uMode: { value: 0 }, uP: { value: 0 }, uC: { value: new THREE.Vector2(0.5, 0.5) }, uR: { value: 1.2 }, uAspect: { value: W / H }, uFrame: { value: 0 }, uRX: { value: 0 }, uFlood: { value: new THREE.Color('#f3eee3') }, uDip: { value: 0 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tA; uniform sampler2D tB; uniform float uMode; uniform float uP; uniform vec2 uC; uniform float uR; uniform float uAspect; uniform float uFrame; uniform float uRX; uniform vec3 uFlood; uniform float uDip;
    varying vec2 vUv;
    float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
    vec3 blurX(sampler2D t, vec2 uv, float a){ vec3 s = vec3(0.); float n = 0.; for (int i = -6; i <= 6; i++){ float k = float(i) / 6.; float w = 1. - abs(k) * .6; s += texture2D(t, uv + vec2(k * a, 0.)).rgb * w; n += w; } return s / n; }
    vec3 zoomBlur(sampler2D t, vec2 uv, vec2 c, float a){ vec3 s = vec3(0.); for (int i = 0; i < 10; i++){ float k = float(i) / 9.; s += texture2D(t, c + (uv - c) * (1. - a * k)).rgb; } return s / 10.; }
    void main(){
      vec2 uv = vUv; vec3 col = texture2D(tA, uv).rgb;
      vec2 q = (uv - uC) * vec2(uAspect, 1.); float d = length(q);
      if (uMode > .5 && uMode < 1.5) {                       // iris: B shows inside a circle that grows from uC
        float r = uRX > 0. ? uRX : uR * uP; float m = 1. - smoothstep(r - .0025, r + .0025, d);
        vec3 b = texture2D(tB, uv).rgb; col = mix(col, b, m);
        float rim = (1. - smoothstep(0., .007, abs(d - r))) * step(.002, uP) * step(uP, .995); col += rim * vec3(.55, .6, .65);
      } else if (uMode > 1.5 && uMode < 2.5) {               // zoom through: radial blur on A, then B
        float a = sin(3.14159 * clamp(uP * 1.15, 0., 1.)) * .22;
        vec3 ca = zoomBlur(tA, uv, uC, a); vec3 cb = zoomBlur(tB, uv, uC, a * (1. - uP) * .0 + (1. - smoothstep(.0, .6, uP)) * .12);
        col = mix(ca, cb, smoothstep(.38, .7, uP));
      } else if (uMode > 2.5 && uMode < 3.5) {               // flood: a colour rises over A, then retracts to reveal B
        float up = clamp(uP * 2., 0., 1.); float down = clamp(uP * 2. - 1., 0., 1.);
        float cover = 1. - smoothstep(up * 1.12 - .12 - .01, up * 1.12 - .12 + .01, uv.y);
        vec3 b = texture2D(tB, uv).rgb; vec3 base = uP < .5 ? col : b;
        float clear = smoothstep(down * 1.12 - .12 - .01, down * 1.12 - .12 + .01, uv.y);
        float m = uP < .5 ? cover : clear; col = mix(base, uFlood, m);
      } else if (uMode > 3.5) {                              // whip: both worlds slide left with a horizontal smear
        float s = uP; float blur = sin(3.14159 * s) * .09;
        vec2 ua = uv + vec2(s * 1.0, 0.); vec2 ub = uv - vec2((1. - s) * 1.0, 0.);
        col = vec3(.006, .02, .04);
        if (ua.x >= 0. && ua.x <= 1.) col = blurX(tA, ua, blur);
        if (ub.x >= 0. && ub.x <= 1.) col = blurX(tB, ub, blur);
      }
      float v = smoothstep(.95, .35, length((uv - .5) * vec2(1.25, 1.)));
      col *= mix(.8, 1., v);
      col += (ign(gl_FragCoord.xy + uFrame * vec2(37., 17.)) - .5) * .035;
      col *= 1. - uDip;
      gl_FragColor = vec4(col, 1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  depthTest: false, depthWrite: false,
})
quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat))

function renderBeat(b, target, t) {
  b.frame?.(t)
  renderer.setRenderTarget(target)
  renderer.render(b.scene, b.camera)
}

function renderFrame(t) {
  tl.time(t, false)
  const only = params.get('only')
  const live = beats.filter((b) => b && (only ? b.index === Number(only) - 1 : t >= b.win[0] && t < b.win[1]))
  mat.uniforms.uFrame.value = Math.round(t * 30)
  mat.uniforms.uMode.value = 0
  if (!live.length) { renderer.setRenderTarget(null); renderer.setClearColor(0x02080f); renderer.clear(); return }
  const a = live[0]; const b = live[1]
  renderBeat(a, rtA, t)
  if (b) {
    renderBeat(b, rtB, t)
    const tr = TR[a.index]
    mat.uniforms.uMode.value = tr.mode
    mat.uniforms.uP.value = clamp01((t - tr.at) / tr.dur)
    const c = a.seam?.(t) ?? { x: 0.5, y: 0.5, r: 1.3 }
    mat.uniforms.uC.value.set(c.x, c.y); mat.uniforms.uR.value = c.r ?? 1.3; mat.uniforms.uRX.value = c.rx ?? 0
    mat.uniforms.uFlood.value.set(c.flood ?? '#f3eee3')
  }
  renderer.setRenderTarget(null)
  renderer.render(quadScene, quadCam)
}

// A throwaway frame per beat compiles every shader before the first captured frame.
renderer.compile(quadScene, quadCam)
for (const b of beats) if (b) { await renderer.compileAsync(b.scene, b.camera); renderBeat(b, rtA, b.start) }
renderFrame(0)

window.film = { length: FILM.length, beats, tl, renderer }
window.seek = (t) => { renderFrame(t); renderer.getContext().finish() }
window.__ready = true
window.__duration = FILM.length

// Preview helper: scale the fixed stage into a smaller window.
{
  const fit = () => { const s = Math.min(innerWidth / W, innerHeight / H); document.getElementById('stage').style.transform = `scale(${s})` }
  if (!params.has('render')) { fit(); addEventListener('resize', fit) }
}
