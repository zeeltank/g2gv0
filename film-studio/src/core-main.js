// The Scholar Core film engine: one paused GSAP clock drives the 3D world (src/core/world.js), the camera and the type (src/core/story.js);
// window.seek(t) sets the clock, applies the camera and renders the scene into a half-float multisampled target, then composites it (neutral
// tone mapping, vignette, film grain, fade and flash). No requestAnimationFrame loop, no Clock, no Date.now: a frame depends only on t.
import { gsap } from 'gsap'
import * as THREE from 'three'
import { H, W } from './common.js'
import { root } from './dom.js'
import { ANCHOR, SLOT, makeStory } from './core/story.js'
import { makeWorld } from './core/world.js'

const params = new URLSearchParams(location.search)
const ATLAS = await (await fetch('/data/atlas.json')).json()
const tour = ATLAS.products.find((p) => p.key === 'core').tour

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

await Promise.all(['300 80px Fraunces', '800 80px Fraunces', 'italic 400 80px Fraunces', '500 40px Manrope', '700 40px Manrope', '800 40px Manrope'].map((f) => document.fonts.load(f)))
await document.fonts.ready

const world = await makeWorld({ renderer, tour })
const tl = gsap.timeline({ paused: true })
const story = makeStory({ tl, world, tour, dom: root() })
const LENGTH = story.length

const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4, depthBuffer: true })
const quadScene = new THREE.Scene()
const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
const mat = new THREE.ShaderMaterial({
  uniforms: { tA: { value: rt.texture }, uFrame: { value: 0 }, uDip: { value: 0 }, uFlash: { value: 0 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tA; uniform float uFrame; uniform float uDip; uniform float uFlash; varying vec2 vUv;
    float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
    void main(){
      vec3 col = texture2D(tA, vUv).rgb;
      float v = smoothstep(.98, .38, length((vUv - .5) * vec2(1.22, 1.)));
      col *= mix(.78, 1., v);
      col += (ign(gl_FragCoord.xy + uFrame * vec2(37., 17.)) - .5) * .03;
      col = mix(col, vec3(1.15, 1.2, 1.3), uFlash);
      col *= 1. - uDip;
      gl_FragColor = vec4(col, 1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  depthTest: false, depthWrite: false,
})
quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat))

function renderFrame(t) {
  tl.time(t, false)
  world.frame()
  mat.uniforms.uFrame.value = Math.round(t * 30)
  mat.uniforms.uDip.value = world.fx.dip
  mat.uniforms.uFlash.value = world.fx.flash
  renderer.setRenderTarget(rt)
  renderer.render(world.scene, world.camera)
  renderer.setRenderTarget(null)
  renderer.render(quadScene, quadCam)
}

renderer.compile(quadScene, quadCam)
await renderer.compileAsync(world.scene, world.camera)
renderFrame(0)

window.film = { length: LENGTH, tl, renderer, world, layouts: story.layouts, slots: SLOT, anchors: ANCHOR }
window.seek = (t) => { renderFrame(t); renderer.getContext().finish() }
window.__ready = true
window.__duration = LENGTH

// ?grid=1 draws the grid on the frame: the left text column, the slot tops, the split zone, the wide band, and the anchors (for design review only)
if (params.has('grid')) {
  const g = document.createElement('div'); g.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:50'
  const line = (css) => { const d = document.createElement('div'); d.style.cssText = `position:absolute;${css}`; g.appendChild(d) }
  const c = 'rgba(0,255,200,.55)'; const o = 'rgba(255,170,0,.6)'
  for (const x of [140, 900, 1010, 1780]) line(`left:${x}px;top:0;width:1px;height:1080px;background:${c}`)
  for (const [k, s] of Object.entries(SLOT)) if (s.y < 790) { line(`left:0;top:${s.y}px;width:1920px;height:1px;background:${c}`); line(`left:6px;top:${s.y - 16}px;font:700 13px monospace;color:#0fc`) ; g.lastChild.textContent = k }
  line(`left:0;top:790px;width:1920px;height:1px;background:${o}`)
  for (const [k, a] of Object.entries(ANCHOR)) { line(`left:${a.ax - 22}px;top:${a.ay}px;width:44px;height:1px;background:${o}`); line(`left:${a.ax}px;top:${a.ay - 22}px;width:1px;height:44px;background:${o}`); line(`left:${a.ax + 8}px;top:${a.ay + 6}px;font:700 13px monospace;color:#fa0`); g.lastChild.textContent = k }
  document.getElementById('stage').appendChild(g)
}

{
  const fit = () => { const s = Math.min(innerWidth / W, innerHeight / H); document.getElementById('stage').style.transform = `scale(${s})` }
  if (!params.has('render')) { fit(); addEventListener('resize', fit) }
}
