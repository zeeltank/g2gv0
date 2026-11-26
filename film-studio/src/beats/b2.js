// Beat 2, problem (4-10.5 s). Overhead camera over a dark desk. The student's photograph lies in one pool of light; three real paper records
// (Paper001, CC0) float at different heights around it. A thin blue thread leaves the photograph towards each record and stops just short of
// it, with a small spring (the school has the records; nothing connects them to a next step). The last thread closes into a ring, which the
// next beat opens through.
import { gsap } from 'gsap'
import { COL, H, THREE, W, loadTexture, perspective, pbr, project, projectRadius } from '../common.js'
import { text, textOut, wordsIn } from '../dom.js'

function sheetMaterial(base, titleLines, { w = 1024, h = 1448 } = {}) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h
  const g = cv.getContext('2d')
  g.drawImage(base.map.image, 0, 0, w, h)
  g.fillStyle = 'rgba(255,253,246,0.55)'; g.fillRect(0, 0, w, h)
  g.fillStyle = '#0c2a4a'; g.font = '800 74px Manrope'; g.textBaseline = 'top'
  titleLines.forEach((t, i) => g.fillText(t, 76, 96 + i * 88))
  // rows of faint writing and a few pen ticks, so the sheet reads as a record and shows no numbers
  g.strokeStyle = 'rgba(12,42,74,0.28)'; g.lineWidth = 5
  for (let i = 0; i < 11; i++) { const y = 420 + i * 82; g.beginPath(); g.moveTo(76, y); g.lineTo(w - 76 - ((i * 97) % 220), y); g.stroke() }
  g.strokeStyle = 'rgba(16,136,246,0.8)'; g.lineWidth = 9; g.lineCap = 'round'
  for (const [x, y] of [[w - 150, 428], [w - 150, 592], [w - 150, 838]]) { g.beginPath(); g.moveTo(x - 22, y); g.lineTo(x - 6, y + 20); g.lineTo(x + 28, y - 26); g.stroke() }
  const map = new THREE.CanvasTexture(cv); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8
  const m = base.clone(); m.map = map
  return m
}

function curledPlane(w, h, curl) {
  const g = new THREE.PlaneGeometry(w, h, 20, 28)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, curl * (x * x * 0.9 + 0.35 * Math.sin(y * 2.2 + x) * 0.08)) }
  g.computeVertexNormals()
  return g
}

function thread(curve, color) {
  const geo = new THREE.TubeGeometry(curve, 160, 0.014, 8, false)
  const mat = new THREE.ShaderMaterial({
    uniforms: { uProg: { value: 0 }, uColor: { value: new THREE.Color(color) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform float uProg; uniform vec3 uColor; varying vec2 vUv; void main(){ if (vUv.x > uProg) discard; float head = smoothstep(.06, 0., uProg - vUv.x); gl_FragColor = vec4(uColor * (1.1 + head * 2.4), 1.); }`,
  })
  return { mesh: new THREE.Mesh(geo, mat), mat }
}

export async function make({ renderer, envs, beat }) {
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#050d18')
  scene.environment = envs.dusk
  scene.environmentIntensity = 0.16
  const camera = perspective(32)

  /* the desk */
  const wood = await pbr('Wood095', { repeat: [4, 3], color: 0x34404f, roughness: 1 })
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), wood)
  desk.rotation.x = -Math.PI / 2
  desk.receiveShadow = true
  scene.add(desk)

  /* the photograph */
  const photoTex = await loadTexture('/photos/images/img-student.webp')
  const pw = 1.9, ph = pw / (photoTex.image.width / photoTex.image.height)
  const frame = new THREE.Mesh(new THREE.BoxGeometry(pw + 0.16, 0.012, ph + 0.16), new THREE.MeshStandardMaterial({ color: 0xfffdf6, roughness: 0.8 }))
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshStandardMaterial({ map: photoTex, roughness: 0.55 }))
  pic.rotation.x = -Math.PI / 2; pic.position.y = 0.008
  const print = new THREE.Group(); print.add(frame, pic)
  print.position.set(-1.0, 0.012, 0.95); print.rotation.y = 0.1
  frame.castShadow = true; frame.receiveShadow = true
  scene.add(print)

  /* the records: three paper sheets at different heights */
  const paper = await pbr('Paper001', { repeat: [1, 1], roughness: 0.9 })
  const titles = beat.lines.filter((l) => l.role === 'card').map((l) => l.text)
  const defs = [
    { t: titles[0].split(' '), x: 1.3, z: 0.1, y: 0.16, ry: -0.2, rz: 0.0 },
    { t: titles[1].split(' '), x: 2.75, z: 1.2, y: 0.62, ry: 0.16, rz: 0.04 },
    { t: titles[2].split(' ').reduce((a, w, i) => (i < 1 ? [w] : [a[0] + ' ' + w]), []), x: 0.95, z: -1.0, y: 1.12, ry: -0.1, rz: -0.03 },
  ]
  const sheets = defs.map((d, i) => {
    const mat = sheetMaterial(paper, i === 2 ? ['A parent’s', 'concern'] : d.t.length > 1 && i === 1 ? ['Classroom', 'observations'] : ['Examination', 'marks'])
    const m = new THREE.Mesh(curledPlane(1.35, 1.9, 0.07), mat)
    m.rotation.set(-Math.PI / 2 + 0.02, d.ry, d.rz, 'YXZ')
    m.position.set(d.x, d.y, d.z)
    m.castShadow = true; m.receiveShadow = true
    scene.add(m)
    return { m, d }
  })

  /* light: one soft pool on the photograph, a faint blue rim from the side */
  const spot = new THREE.SpotLight(0xfff1dc, 230, 16, 0.42, 0.95, 1.6)
  spot.position.set(0.2, 6.4, 2.6); spot.target.position.set(-0.1, 0, 0.6)
  spot.castShadow = true; spot.shadow.mapSize.set(2048, 2048); spot.shadow.bias = -0.0004; spot.shadow.radius = 6
  scene.add(spot, spot.target)
  const rim = new THREE.DirectionalLight(0x6aaeff, 0.45); rim.position.set(6, 3, -2); scene.add(rim)
  scene.add(new THREE.AmbientLight(0x20406e, 0.32))

  /* threads: from the photograph towards each record, each stopping short */
  const from = new THREE.Vector3(-0.6, 0.05, 0.95)
  const threads = sheets.map(({ d }, i) => {
    const to = new THREE.Vector3(d.x - 0.35, d.y + 0.01, d.z + 0.1)
    const mid = from.clone().lerp(to, 0.5); mid.y += 0.35 + i * 0.1
    const th = thread(new THREE.CatmullRomCurve3([from, mid, to]), COL.blue)
    scene.add(th.mesh)
    return th
  })
  /* the ring that closes round the photograph */
  const ringCurve = new THREE.CatmullRomCurve3(Array.from({ length: 33 }, (_, k) => { const a = (k / 32) * Math.PI * 2; return new THREE.Vector3(-1.0 + Math.cos(a) * 1.4, 0.05, 0.95 + Math.sin(a) * 1.4) }), true)
  const ring = thread(ringCurve, COL.sky)
  ring.mat.uniforms.uColor.value.set(COL.sky)
  scene.add(ring.mesh)

  /* type, top left */
  const lines = beat.lines
  const L = (role) => lines.find((l) => l.role === role).text
  const t1 = text(L('l1'), { x: 120, y: 96, size: 92, weight: 300, color: '#eaf2fb', track: -0.025 })
  const t2 = text(L('l2'), { x: 120, y: 200, size: 92, weight: 300, color: '#eaf2fb', track: -0.025 })
  const t3 = text(L('l3'), { x: 120, y: 304, size: 104, weight: 800, color: COL.sky, track: -0.04 })
  const tag = text(L('tag').toUpperCase(), { x: 124, y: 452, size: 22, weight: 800, font: 'sans', color: '#cfe3f8', track: 0.14, words: false })
  const cr = document.createElement('div')
  cr.className = 'hud'; cr.textContent = 'Illustrative stock imagery.'
  Object.assign(cr.style, { right: '56px', bottom: '36px', fontSize: '17px', letterSpacing: '0.04em', textTransform: 'none', fontWeight: '600', color: '#cfe3f8' })
  document.getElementById('dom').appendChild(cr)

  const S = { cx: 0.9, cy: 4.6, cz: 5.4, tx: 0.9, tz: 0.5, p0: 0, p1: 0, p2: 0, pr: 0, expand: 0, spot: 0 }
  const ringCenter = new THREE.Vector3(-1.0, 0.05, 0.95)

  return {
    scene, camera,
    frame() {
      camera.position.set(S.cx, S.cy, S.cz)
      camera.lookAt(S.tx - 0.9, 0.2, S.tz)
      camera.updateMatrixWorld()
      threads[0].mat.uniforms.uProg.value = S.p0; threads[1].mat.uniforms.uProg.value = S.p1; threads[2].mat.uniforms.uProg.value = S.p2
      ring.mat.uniforms.uProg.value = S.pr
      spot.intensity = 230 * S.spot
      sheets.forEach(({ m, d }, i) => { m.position.y = d.y + 0.03 * Math.sin(S.cx * 3 + i * 2.1) })
    },
    seam() {
      const p = project(ringCenter, camera)
      const rpx = projectRadius(ringCenter, 1.4, camera)
      return { x: p.x / W, y: 1 - p.y / H, rx: (rpx * (1 + 5.5 * S.expand * S.expand)) / H }
    },
    build(tl, { T }) {
      tl.set(S, { cx: 0.9, cy: 4.6, cz: 5.4, tx: 0.9, tz: 0.5, p0: 0, p1: 0, p2: 0, pr: 0, expand: 0, spot: 0 }, 0)
      tl.to(S, { spot: 1, duration: 1.0, ease: 'power2.out' }, 3.3)
      tl.to(S, { cy: 3.6, cz: 3.9, cx: 0.55, duration: 6.4, ease: 'sine.inOut' }, 4.0)
      // threads reach for the records and stop just short, each with a small spring
      for (const [k, at] of [['p0', 6.0], ['p1', 6.6], ['p2', 7.2]]) {
        tl.to(S, { [k]: 0.9, duration: 1.1, ease: 'power2.inOut' }, at)
        tl.to(S, { [k]: 0.935, duration: 0.18, ease: 'power2.out' }, at + 1.1)
        tl.to(S, { [k]: 0.9, duration: 0.5, ease: 'elastic.out(1,0.4)' }, at + 1.3)
      }
      // the last thread closes into a ring round the photograph, then the ring opens onto the next beat
      tl.to(S, { pr: 1, duration: 0.9, ease: 'power2.inOut' }, 8.6)
      tl.to(S, { expand: 1, duration: 0.85, ease: 'power3.in' }, 9.7)
      tl.to(S, { p0: 0, p1: 0, p2: 0, duration: 0.5, ease: 'power2.in' }, 8.9)
      wordsIn(tl, t1, 4.5); wordsIn(tl, t2, 5.5); wordsIn(tl, t3, 6.6, { step: 0.12 })
      tl.set(tag, { opacity: 1 }, 5.2); tl.fromTo(tag, { opacity: 0 }, { opacity: 0.9, duration: 0.5 }, 5.2)
      tl.fromTo(cr, { opacity: 0 }, { opacity: 0.8, duration: 0.5 }, 4.6)
      for (const e of [t1, t2, t3, tag, cr]) textOut(tl, e, 9.5)
    },
  }
}
