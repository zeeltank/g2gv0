// Beat 8, benefits + fit (45.5-51.5 s). Cream paper. The approved sentence on the left; on the right three report sheets (collection, absence,
// results) arrive as a loose pile, the kind that is compiled by hand, and at "without compiling by hand" slide into one neat column.
// Along the bottom, who it is for: five equal columns.
import { COL, THREE, pbr } from '../common.js'
import { text } from '../dom.js'
import { block, dotPlane, frontCamera, wx, wy } from '../layout.js'

const INK = '#06182b'
const SHEET_X = 1560, SHEET_Y = [250, 480, 710]
const FIT_X = [192, 576, 960, 1344, 1728]

function sheetTexture(title, kind) {
  const w = 1200, h = 760, cv = document.createElement('canvas'); cv.width = w; cv.height = h
  const g = cv.getContext('2d')
  g.fillStyle = '#fffdf6'; g.fillRect(0, 0, w, h)
  g.fillStyle = COL.blue; g.fillRect(0, 0, 22, h)
  g.fillStyle = INK; g.font = '800 96px Manrope'; g.textBaseline = 'top'; g.fillText(title, 90, 70)
  g.strokeStyle = 'rgba(6,24,43,0.25)'; g.lineWidth = 6
  g.beginPath(); g.moveTo(90, 220); g.lineTo(w - 90, 220); g.stroke()
  g.fillStyle = 'rgba(16,136,246,0.9)'; g.strokeStyle = 'rgba(16,136,246,0.95)'; g.lineWidth = 12; g.lineJoin = 'round'
  if (kind === 0) for (let i = 0; i < 6; i++) { const bh = 130 + ((i * 71) % 190); g.fillRect(110 + i * 170, h - 70 - bh, 100, bh) }
  if (kind === 1) for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) { g.beginPath(); g.arc(130 + c * 118, 330 + r * 110, 34, 0, 6.2832); (r * 9 + c) % 5 === 2 ? g.stroke() : g.fill() }
  if (kind === 2) { g.beginPath(); [[110, 640], [330, 560], [550, 600], [770, 440], [990, 390]].forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke() }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8
  return t
}

export async function make({ renderer, envs, beat }) {
  renderer.shadowMap.enabled = true
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#f1ebdc')
  scene.environment = envs.studio
  scene.environmentIntensity = 0.6
  const camera = frontCamera(9)
  const paper = await pbr('Paper001', { repeat: [9, 6], color: 0xfffdf6, roughness: 1 })
  paper.normalScale.set(0.25, 0.25); paper.color.setRGB(1.2, 1.18, 1.08)
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), paper); bg.position.z = -0.6; bg.receiveShadow = true; scene.add(bg)
  const dots = dotPlane(40, 26, { color: [0.02, 0.09, 0.17], alpha: 0.2, z: -0.55 }); scene.add(dots)
  const sun = new THREE.DirectionalLight(0xfff4e6, 2.2); sun.position.set(-2.5, 3.5, 14); sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -14; sun.shadow.camera.right = 14; sun.shadow.camera.top = 9; sun.shadow.camera.bottom = -9; sun.shadow.camera.far = 50; sun.shadow.radius = 5; sun.shadow.bias = -0.0003
  scene.add(sun)

  const L = (r) => beat.lines.filter((l) => l.role === r).map((l) => l.text)
  /* the pile that becomes a column */
  const KINDS = ['Collection', 'Absence', 'Results']
  const sheets = KINDS.map((k, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.9), new THREE.MeshStandardMaterial({ map: sheetTexture(k, i), roughness: 0.9, side: THREE.DoubleSide }))
    m.castShadow = true; m.receiveShadow = true; m.visible = false; scene.add(m); return m
  })
  const MESS = [[-0.42, 0.9, 0.34, 0.5], [0.3, -0.4, -0.5, -0.4], [-0.1, 0.1, 0.12, 0.2]]   // x offset, y offset, rotation z, rotation y

  /* type, left */
  const v1 = text(L('v1')[0], { x: 120, y: 200, size: 30, weight: 800, font: 'sans', color: COL.blue, track: 0.04, words: false })
  const mkLine = (html, y, size, weight, color) => { const e = text('x', { x: 120, y, size, weight, color, track: -0.03 }); e.innerHTML = html; return e }
  const v2a = text('a clearer picture of', { x: 120, y: 272, size: 92, weight: 300, color: INK, track: -0.03 })
  const v2b = text('collection, absence and results', { x: 120, y: 378, size: 92, weight: 800, color: COL.blue, track: -0.045 })
  const v3 = text(L('v3')[0], { x: 120, y: 552, size: 44, weight: 700, font: 'sans', color: INK })
  /* fit, bottom */
  const fit = L('fit').map((f, i) => block(`<div style="display:flex;flex-direction:column;align-items:center;gap:14px"><span class="d" style="display:block;width:14px;height:14px;border-radius:50%;background:${COL.blue}"></span><span style="font-size:29px;font-weight:800;color:${INK}">${f}</span></div>`, { x: FIT_X[i], y: 872, w: 340, center: true }))
  const rule = document.createElement('div'); rule.style.cssText = `position:absolute;left:120px;top:858px;width:1680px;height:2px;background:rgba(6,24,43,0.2);transform-origin:0 50%;transform:scaleX(0);`
  document.getElementById('dom').appendChild(rule)

  const S = { arrive: 0, tidy: 0, drift: 0 }
  const mix = [0, 1, 2].map(() => ({ a: 0, t: 0 }))

  return {
    scene, camera,
    frame(t) {
      camera.position.x = Math.sin(S.drift * 3.1) * 0.25
      camera.lookAt(0, 0, 0); camera.updateMatrixWorld()
      dots.material.uniforms.uOn.value = 1
      sheets.forEach((m, i) => {
        const a = mix[i].a, e = mix[i].t
        m.visible = a > 0.002
        const tx = wx(SHEET_X), ty = wy(SHEET_Y[i])
        const mx = wx(SHEET_X) + MESS[i][0], my = wy(480) + MESS[i][1]
        const x = (1 - e) * mx + e * tx, y = (1 - e) * (my + (1 - a) * 5) + e * ty
        m.position.set(x, y, 0.1 + 0.25 * (2 - i) * (1 - e))
        m.rotation.set(0, MESS[i][3] * (1 - e) * 0.6, MESS[i][2] * (1 - e))
        m.scale.setScalar(1 - 0.0 * e)
      })
    },
    build(tl) {
      tl.set(S, { arrive: 0, tidy: 0, drift: 0 }, 0)
      tl.to(S, { drift: 1, duration: 6, ease: 'sine.inOut' }, 45.5)
      tl.fromTo(v1, { opacity: 0 }, { opacity: 1, duration: 0.5 }, 45.95)
      for (const [e, at, step] of [[v2a, 46.35, 0.1], [v2b, 46.95, 0.12], [v3, 48.15, 0.09]]) {
        tl.set(e, { opacity: 1 }, at)
        tl.fromTo([...e.querySelectorAll('.w')], { opacity: 0, filter: 'blur(7px)' }, { opacity: 1, filter: 'blur(0px)', duration: 0.32, stagger: step, ease: 'power2.out' }, at)
      }
      // the loose pile drops in, then tidies at "without compiling by hand"
      mix.forEach((m, i) => {
        tl.to(m, { a: 1, duration: 0.6, ease: 'power3.out' }, 46.3 + i * 0.22)
        tl.to(m, { t: 1, duration: 0.9, ease: 'back.out(1.3)' }, 48.35 + i * 0.12)
      })
      tl.to(rule, { scaleX: 1, duration: 0.9, ease: 'power2.inOut' }, 49.55)
      fit.forEach((b, i) => tl.fromTo(b.inner, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' }, 49.7 + i * 0.13))
      // the type leaves just before the iris to the next beat
      tl.to([v1, v2a, v2b, v3, rule, ...fit.map((b) => b.wrap)], { opacity: 0, duration: 0.25, ease: 'power3.in' }, 50.78)
    },
  }
}
