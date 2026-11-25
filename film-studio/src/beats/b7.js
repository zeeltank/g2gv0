// Beat 7, connects to + reports (40-45.5 s). Four parts of the school on a 2 x 2 grid; three threads draw between them, each carrying a
// short line; two report sheets leave the leadership node and settle on the right. The film then dives into that node.
import { COL, THREE, W, H, project } from '../common.js'
import { block, dotPlane, frontCamera, ringMaterial, threadMaterial, wx, wy } from '../layout.js'

const NODES = [[560, 330], [560, 760], [1360, 330], [1360, 760]]   // operations, learning, leadership, career
const NAMES_AT = ['above', 'below', 'above', 'below']

function sheetTexture(title) {
  const w = 1200, h = 840, cv = document.createElement('canvas'); cv.width = w; cv.height = h
  const g = cv.getContext('2d')
  g.fillStyle = '#fffdf6'; g.fillRect(0, 0, w, h)
  g.fillStyle = COL.blue; g.fillRect(0, 0, w, 22)
  g.fillStyle = '#0c2a4a'; g.font = '800 82px Manrope'; g.textBaseline = 'top'; g.fillText(title, 70, 90)
  g.strokeStyle = 'rgba(12,42,74,0.28)'; g.lineWidth = 6
  for (let i = 0; i < 4; i++) { const y = 270 + i * 90; g.beginPath(); g.moveTo(70, y); g.lineTo(w - 70 - ((i * 131) % 260), y); g.stroke() }
  g.fillStyle = 'rgba(16,136,246,0.85)'
  for (let i = 0; i < 5; i++) { const bh = 150 + ((i * 53) % 110); g.fillRect(80 + i * 150, h - 70 - bh, 90, bh) }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8
  return t
}

export async function make({ renderer, envs, beat }) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#031020')
  scene.environment = envs.studio
  scene.environmentIntensity = 0.7
  const camera = frontCamera(9)
  const dots = dotPlane(40, 26, { alpha: 0.12 }); scene.add(dots)
  const key = new THREE.DirectionalLight(0xe6efff, 2.4); key.position.set(-4, 6, 10); scene.add(key)

  const L = (r) => beat.lines.filter((l) => l.role === r).map((l) => l.text)
  const names = L('node'), links = L('link'), reports = L('report')

  /* nodes */
  const nodes = NODES.map(([px, py]) => {
    const g = new THREE.Group(); g.position.set(wx(px), wy(py), 0)
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.4, 56, 32), new THREE.MeshPhysicalMaterial({ color: 0x1088f6, roughness: 0.12, metalness: 0.1, clearcoat: 1, emissive: 0x0a4fa8, emissiveIntensity: 0.5 }))
    const ring = new THREE.Mesh(new THREE.CircleGeometry(1.0, 80), ringMaterial(0.78, COL.sky, { additive: true, w: 0.03 })); ring.position.z = -0.05
    g.add(sphere, ring); scene.add(g)
    return { g, sphere, ring }
  })
  /* threads between nodes, shortened at both ends */
  const seg = (a, b) => {
    const A = new THREE.Vector3(wx(NODES[a][0]), wy(NODES[a][1]), 0), B = new THREE.Vector3(wx(NODES[b][0]), wy(NODES[b][1]), 0)
    const d = B.clone().sub(A).normalize()
    return new THREE.LineCurve3(A.clone().add(d.clone().multiplyScalar(1.1)), B.clone().sub(d.clone().multiplyScalar(1.1)))
  }
  const pairs = [[1, 3], [0, 2], [1, 2]]          // exams and practice -> career evidence; attendance and results compared; one risk case
  const threads = pairs.map(([a, b]) => {
    const m = new THREE.Mesh(new THREE.TubeGeometry(seg(a, b), 120, 0.034, 8, false), threadMaterial(COL.sky))
    scene.add(m); return m
  })

  /* labels */
  const nodeLabels = NODES.map(([px, py], i) => block(`<div class="disp" style="font-size:46px;font-weight:600;color:#fff;letter-spacing:-0.02em;line-height:1.05">${names[i]}</div>`, { x: px, y: NAMES_AT[i] === 'above' ? py - 150 : py + 96, w: 460, center: true }))
  const mid = (a, b) => [(NODES[a][0] + NODES[b][0]) / 2, (NODES[a][1] + NODES[b][1]) / 2]
  const capStyle = 'font-size:26px;font-weight:600;color:#cfe3f8;line-height:1.3;'
  const caps = [
    block(`<div style="${capStyle}">${links[0]}</div>`, { x: mid(1, 3)[0], y: mid(1, 3)[1] + 28, w: 700, center: true }),
    block(`<div style="${capStyle}">${links[1]}</div>`, { x: mid(0, 2)[0], y: mid(0, 2)[1] - 62, w: 520, center: true }),
    block(`<div style="${capStyle}">${links[2]}</div>`, { x: mid(1, 2)[0] + 100, y: mid(1, 2)[1] + 10, w: 260, center: true }),
  ]

  /* report sheets leave the leadership node */
  const sheets = reports.map((r) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.61), new THREE.MeshStandardMaterial({ map: sheetTexture(r), roughness: 0.9, side: THREE.DoubleSide }))
    m.position.set(wx(1360), wy(330), 0.1); m.visible = false
    scene.add(m); return m
  })
  const SHEET_TO = [[wx(1730), wy(470), -0.06], [wx(1730), wy(690), 0.05]]

  const S = { dots: 0, drift: 0, pulse: 0 }
  const N = nodes.map(() => ({ s: 0 })), T = threads.map(() => ({ p: 0 })), Sh = sheets.map(() => ({ p: 0 }))

  return {
    scene, camera,
    frame(t) {
      camera.position.x = Math.sin(S.drift * 3.1) * 0.3
      camera.lookAt(0, 0, 0); camera.updateMatrixWorld()
      dots.material.uniforms.uOn.value = S.dots
      nodes.forEach((n, i) => {
        const s = N[i].s; n.g.visible = s > 0.002; n.g.scale.setScalar(0.001 + 0.999 * s)
        n.ring.material.uniforms.uProg.value = s
        n.sphere.material.emissiveIntensity = 0.45 + 0.2 * Math.sin(t * 2 + i)
      })
      threads.forEach((m, i) => { m.material.uniforms.uProg.value = T[i].p; m.material.uniforms.uPulse.value = S.pulse > 0 && T[i].p > 0.99 ? ((t * 0.55 + i * 0.31) % 1) : -1 })
      sheets.forEach((m, i) => {
        const p = Sh[i].p; m.visible = p > 0.002
        const e = 1 - Math.pow(1 - p, 3)
        m.position.set(wx(1360) + (SHEET_TO[i][0] - wx(1360)) * e, wy(330) + (SHEET_TO[i][1] - wy(330)) * e, 0.1 + 0.3 * i)
        m.rotation.set(0, -0.42 * (1 - e) - 0.16, SHEET_TO[i][2] * e + 0.5 * (1 - e))
        m.scale.setScalar(0.2 + 0.8 * e)
      })
    },
    seam() { const c = project(nodes[2].g.position, camera); return { x: c.x / W, y: 1 - c.y / H, r: 1.3 } },
    build(tl) {
      tl.set(S, { dots: 0, drift: 0, pulse: 0 }, 0)
      tl.to(S, { dots: 1, duration: 0.7 }, 40.0)
      tl.to(S, { drift: 1, duration: 5.4, ease: 'sine.inOut' }, 40.0)
      nodes.forEach((n, i) => {
        tl.to(N[i], { s: 1, duration: 0.55, ease: 'back.out(1.8)' }, 40.25 + i * 0.14)
        tl.fromTo(nodeLabels[i].inner, { opacity: 0, y: NAMES_AT[i] === 'above' ? 10 : -10 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' }, 40.5 + i * 0.14)
      })
      const at = [41.0, 41.9, 42.8]
      at.forEach((a, i) => {
        tl.to(T[i], { p: 1, duration: 0.85, ease: 'power2.inOut' }, a)
        tl.fromTo(caps[i].inner, { opacity: 0, filter: 'blur(7px)', y: 8 }, { opacity: 1, filter: 'blur(0px)', y: 0, duration: 0.45, ease: 'power2.out' }, a + 0.6)
      })
      tl.set(S, { pulse: 1 }, 43.0)
      sheets.forEach((m, i) => tl.to(Sh[i], { p: 1, duration: 0.8, ease: 'none' }, 43.6 + i * 0.28))
      const out = [...nodeLabels.map((b) => b.wrap), ...caps.map((b) => b.wrap)]
      for (const e of out) tl.to(e, { opacity: 0, duration: 0.2, ease: 'power3.in' }, 44.8)
    },
  }
}
