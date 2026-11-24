// Beat 4, modules (18.5-25 s). One platform, six bays: a dark slab with a blueprint grid (3 columns x 2 rows), one real object per bay, and
// every name and line set in the same place beside its object. The objects are Poly Haven CC0 models, each doing what its product does:
//   01 Scholar Core    school desk and chair; the chair is pulled in (operations in order)
//   02 Scholar Learn   encyclopedias fall into line; a bulb lights over them (AI-powered learning)
//   03 Scholar CCB     microscope that turns (looking closely at competence)
//   04 Scholar Insight a magnifier held flat over a field of dim dots; the dots under the lens resolve to blue (seeing what was unseen)
//   05 Scholar Compass a compass whose needle swings and settles (direction)
//   06 Scholar One     the ScholarClone seal, turning over its bay; a ring then draws round the whole slab (one platform)
import { COL, THREE, loadModel, loadTexture, perspective, pbr, project } from '../common.js'
import { text } from '../dom.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

const ORDER = ['Scholar Core', 'Scholar Learn', 'Scholar CCB', 'Scholar Insight', 'Scholar Compass', 'Scholar One']
const CW = 5.2, CD = 5.4                 // cell width and depth in world units
const COLS = [-CW, 0, CW], ROWS = [-CD / 2, CD / 2]
const SX = CW * 1.5, SZ = CD            // half extents of the grid (7.8 x 5.4)
const OBJ_DX = -1.7                     // the object sits left of the cell centre, its text to the right
const LAB_DX = -0.45

const gridMaterial = () => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { uProg: { value: 0 }, uPulse: { value: -1 }, uColor: { value: new THREE.Color(COL.blue) } },
  vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `uniform float uProg; uniform float uPulse; uniform vec3 uColor; varying vec2 vP;
    const float CW = ${CW.toFixed(2)}; const float CD = ${CD.toFixed(2)};
    float line(float d, float w){ float a = fwidth(d) * .75; return 1. - smoothstep(w - a, w + a, abs(d)); }
    void main(){
      vec2 p = vP;                                   // slab-local x, z (the plane's y is the world z)
      float vx = min(line(p.x - CW * .5, .018), 1.) + line(p.x + CW * .5, .018);            // two inner vertical lines
      float hz = line(p.y, .018);                                                              // the middle horizontal line
      float bx = line(abs(p.x) - ${SX.toFixed(2)} + .05, .026) * step(abs(p.y), ${SZ.toFixed(2)} - .04);   // border
      float bz = line(abs(p.y) - ${SZ.toFixed(2)} + .05, .026) * step(abs(p.x), ${SX.toFixed(2)} - .04);
      float ln = clamp(vx * step(abs(p.y), ${SZ.toFixed(2)}) + hz * step(abs(p.x), ${SX.toFixed(2)}) + bx + bz, 0., 1.);
      // crosses at every cell corner
      vec2 q = vec2(floor((p.x + ${SX.toFixed(2)}) / CW + .5) * CW - ${SX.toFixed(2)}, floor((p.y + ${SZ.toFixed(2)}) / CD + .5) * CD - ${SZ.toFixed(2)});
      vec2 dq = p - q;
      float cross = max(line(dq.y, .02) * step(abs(dq.x), .3), line(dq.x, .02) * step(abs(dq.y), .3));
      float m = clamp(ln * .55 + cross, 0., 1.);
      float r = length(p / vec2(${SX.toFixed(2)}, ${SZ.toFixed(2)}));
      float reveal = 1. - smoothstep(uProg * 1.3 - .06, uProg * 1.3, r);
      float head = smoothstep(.1, 0., abs(r - uProg * 1.3 + .05)) * step(uProg, .98);
      float pulse = smoothstep(1.6, 0., abs(p.x - uPulse)) * step(-9., uPulse);
      vec3 col = uColor * (.9 + head * 2.5 + pulse * 2.2);
      gl_FragColor = vec4(col, m * reveal * (.8 + pulse * .2));
    }`,
})

const padMaterial = () => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uProg: { value: 0 }, uColor: { value: new THREE.Color(COL.sky) } },
  vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `uniform float uProg; uniform vec3 uColor; varying vec2 vP;
    void main(){
      float d = length(vP); float a = (atan(vP.y, vP.x) + 3.14159) / 6.28318;
      float ring = 1. - smoothstep(.0, .028, abs(d - 1.12)); if (a > uProg) ring = 0.;
      float head = smoothstep(.05, 0., uProg - a) * step(uProg, .99);
      float glow = exp(-pow(d / 1.2, 2.)) * .2 * smoothstep(0., .3, uProg);
      gl_FragColor = vec4(uColor * (ring * (1.1 + head * 2.5) + glow), 1.);
    }`,
})

const dotsMaterial = () => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { uLens: { value: new THREE.Vector2(0, 0) }, uOn: { value: 0 }, uBlue: { value: new THREE.Color(COL.blue) }, uDim: { value: new THREE.Color('#3b5c86') } },
  vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `uniform vec2 uLens; uniform float uOn; uniform vec3 uBlue; uniform vec3 uDim; varying vec2 vP;
    void main(){
      vec2 g = vP / .24; vec2 f = fract(g) - .5; vec2 id = floor(g);
      float rnd = fract(sin(dot(id, vec2(12.9898, 78.233))) * 43758.5453);
      float d = length(vP - uLens);
      float inside = (1. - smoothstep(.62, .78, d)) * uOn;
      float rad = mix(.05 + rnd * .02, .085, inside);
      float dot = 1. - smoothstep(rad - .012, rad + .012, length(f) * .24);
      vec3 col = mix(uDim, uBlue * 1.5, inside);
      float alpha = dot * mix(.42 + rnd * .2, 1., inside) * (1. - smoothstep(1.2, 1.45, length(vP)));
      gl_FragColor = vec4(col, alpha * smoothstep(0., .01, uOn + .02));
    }`,
})

export async function make({ renderer, envs, beat }) {
  renderer.shadowMap.enabled = true
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#031020')
    scene.environment = envs.studio
  scene.environmentIntensity = 0.7
  const camera = perspective(9)

  /* the slab and its blueprint grid */
  const slabMat = await pbr('Metal032', { repeat: [5, 4], metalness: 0.6, roughness: 0.55, color: 0x0f2036 })
  const slab = new THREE.Mesh(new RoundedBoxGeometry(SX * 2 + 0.7, 0.4, SZ * 2 + 0.7, 5, 0.14), slabMat)
  slab.position.y = -0.2; slab.receiveShadow = true; slab.castShadow = true
  scene.add(slab)
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(SX * 2 + 0.5, SZ * 2 + 0.5), gridMaterial())
  grid.rotation.x = -Math.PI / 2; grid.position.y = 0.006
  scene.add(grid)
  const under = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }', fragmentShader: 'varying vec2 vP; void main(){ float r = length(vP); gl_FragColor = vec4(vec3(.02, .13, .30), .42 * exp(-pow(r / 10., 2.))); }' }))
  under.rotation.x = -Math.PI / 2; under.position.y = -0.6
  scene.add(under)

  const key = new THREE.DirectionalLight(0xe6efff, 2.6)
  key.position.set(-7, 14, 9); key.castShadow = true
  key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -11; key.shadow.camera.right = 11; key.shadow.camera.top = 8; key.shadow.camera.bottom = -8; key.shadow.camera.far = 40; key.shadow.radius = 4; key.shadow.bias = -0.0004
  const rim = new THREE.DirectionalLight(0x3d8dff, 1.3); rim.position.set(8, 4, -9)
  scene.add(key, rim)

  /* bays: cell centres in reading order */
  const cells = []
  for (const z of ROWS) for (const x of COLS) cells.push(new THREE.Vector3(x, 0, z))

  const seat = (obj, y = 0) => { const g = new THREE.Group(); g.add(obj); g.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(obj); obj.position.y += y - bb.min.y; return g }
  const shadows = (o) => o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })

  const bays = []
  const extras = {}
  // 01 Core: desk and chair
  {
    const d = await loadModel('SchoolDesk_01', 1.7), c = await loadModel('SchoolChair_01', 1.35)
    const g = new THREE.Group()
    const dg = seat(d), cg = seat(c)
    dg.position.x = 0.35; cg.position.set(-0.55, 0, 0.55); cg.rotation.y = 0.55
    g.add(dg, cg); extras.chair = cg
    bays.push({ obj: g })
  }
  // 02 Learn: the encyclopedia set, and a bulb over it
  {
    const b = await loadModel('book_encyclopedia_set_01', 2.1)
    const bulb = await loadModel('lightbulb_01', 1.2)
    const g = new THREE.Group(); const bg = seat(b); g.add(bg)
    const books = Object.values(b.userData.nodes).filter((n) => /book\d+$/.test(n.name))
    const bb = new THREE.Box3().setFromObject(bg)
    const bulbG = seat(bulb, bb.max.y + 0.55); bulbG.position.set(0, 0, 0.0)
    g.add(bulbG)
    const baseMat = []
    bulb.traverse((m) => { if (m.isMesh && m.material.emissiveIntensity != null && m.material.emissiveMap) baseMat.push(m.material) })
    baseMat.forEach((m) => { m.userData.ei = m.emissiveIntensity })
    const hc = document.createElement('canvas'); hc.width = hc.height = 128
    const hg = hc.getContext('2d'); const gr = hg.createRadialGradient(64, 64, 0, 64, 64, 64)
    gr.addColorStop(0, 'rgba(255,226,160,0.95)'); gr.addColorStop(0.25, 'rgba(255,200,110,0.4)'); gr.addColorStop(1, 'rgba(255,190,90,0)')
    hg.fillStyle = gr; hg.fillRect(0, 0, 128, 128)
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(hc), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }))
    halo.scale.setScalar(2.0); halo.position.set(0, bb.max.y + 0.55 + 0.75, 0.1); g.add(halo)
    extras.halo = halo
    extras.books = books; extras.bulbMats = baseMat; extras.bulbG = bulbG
    bays.push({ obj: g })
  }
  // 03 CCB: microscope
  {
    const m = await loadModel('vintage_microscope', 2.4)
    const g = new THREE.Group(); g.add(seat(m)); extras.micro = g
    bays.push({ obj: g })
  }
  // 04 Insight: a magnifier held flat over a field of dots
  {
    const m = await loadModel('magnifying_glass_01', 2.4)
    m.rotation.x = -Math.PI / 2 + 0.38
    let lens = null; m.traverse((o) => { if (o.isMesh && /lense/.test(o.material?.name || '')) lens = o })
    const g = new THREE.Group(); const mg = new THREE.Group(); mg.add(m); g.add(mg)
    const dots = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), dotsMaterial())
    dots.rotation.x = -Math.PI / 2; dots.position.y = 0.012
    g.add(dots)
    extras.mag = mg; extras.lens = lens; extras.magModel = m; extras.dots = dots
    bays.push({ obj: g, noPad: true })
  }
  // 05 Compass: lying flat with its lid open
  {
    const m = await loadModel('seadogs_compass', 2.05)
    const lid = m.userData.nodes.seadogs_compass_lid, needle = m.userData.nodes.seadogs_compass_needle
    const g = new THREE.Group(); g.add(seat(m)); extras.needle = needle; extras.lid = lid
    bays.push({ obj: g })
  }
  // 06 One: the seal
  {
    const logoTex = await loadTexture('/photos/brand/logo-ring.png')
    const coin = new THREE.Group()
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.98, 0.1, 96), new THREE.MeshStandardMaterial({ color: 0xf3eee3, roughness: 0.38, metalness: 0.15 }))
    body.rotation.x = Math.PI / 2
    const faceMat = new THREE.MeshStandardMaterial({ map: logoTex, roughness: 0.6, transparent: true })
    const f1 = new THREE.Mesh(new THREE.CircleGeometry(0.93, 80), faceMat); f1.position.z = 0.056
    const f2 = new THREE.Mesh(new THREE.CircleGeometry(0.93, 80), faceMat); f2.position.z = -0.056; f2.rotation.y = Math.PI
    coin.add(body, f1, f2); shadows(coin)
    coin.position.y = 1.2; coin.scale.setScalar(0.88)
    const g = new THREE.Group(); g.add(coin); extras.coin = coin
    bays.push({ obj: g })
  }

  bays.forEach((b, i) => {
    const c = cells[i]
    b.cell = c
    b.base = new THREE.Vector3(c.x + OBJ_DX, 0, c.z)
    b.obj.position.copy(b.base)
    shadows(b.obj)
    scene.add(b.obj)
    b.p = { rise: 0, pad: 0, lab: 0 }
    const pad = new THREE.Mesh(new THREE.CircleGeometry(1.9, 64), padMaterial())
    pad.rotation.x = -Math.PI / 2; pad.position.set(b.base.x, 0.012, b.base.z)
    scene.add(pad); b.pad = pad
  })
  extras.dots.parent.position.set(0, 0, 0)

  /* Scholar One: a ring that draws round the whole slab */
  const perimMat = padMaterial(); perimMat.uniforms.uColor.value.set(COL.sky)
  const perimeter = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 8, 600), new THREE.ShaderMaterial({
    uniforms: { uProg: { value: 0 }, uColor: { value: new THREE.Color(COL.sky) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: 'uniform float uProg; uniform vec3 uColor; varying vec3 vP; void main(){ float a = (atan(vP.y, vP.x) + 3.14159) / 6.28318; if (a > uProg) discard; float head = smoothstep(.03, 0., uProg - a); gl_FragColor = vec4(uColor * (1.4 + head * 3.), 1.); }',
  }))
  perimeter.rotation.x = -Math.PI / 2; perimeter.scale.set(SX + 0.6, SZ + 0.6, 1); perimeter.position.y = 0.02
  // a flattened torus would thin out along one axis: draw it as a rounded rectangle path instead
  scene.remove(perimeter)
  const pw = SX + 0.22, ph = SZ + 0.22, rr = 0.6
  const path = new THREE.CurvePath()
  const v = (x, z) => new THREE.Vector3(x, 0.03, z)
  path.add(new THREE.LineCurve3(v(-pw + rr, -ph), v(pw - rr, -ph)))
  path.add(new THREE.QuadraticBezierCurve3(v(pw - rr, -ph), v(pw, -ph), v(pw, -ph + rr)))
  path.add(new THREE.LineCurve3(v(pw, -ph + rr), v(pw, ph - rr)))
  path.add(new THREE.QuadraticBezierCurve3(v(pw, ph - rr), v(pw, ph), v(pw - rr, ph)))
  path.add(new THREE.LineCurve3(v(pw - rr, ph), v(-pw + rr, ph)))
  path.add(new THREE.QuadraticBezierCurve3(v(-pw + rr, ph), v(-pw, ph), v(-pw, ph - rr)))
  path.add(new THREE.LineCurve3(v(-pw, ph - rr), v(-pw, -ph + rr)))
  path.add(new THREE.QuadraticBezierCurve3(v(-pw, -ph + rr), v(-pw, -ph), v(-pw + rr, -ph)))
  const frame = new THREE.Mesh(new THREE.TubeGeometry(path, 400, 0.03, 8, true), new THREE.ShaderMaterial({
    uniforms: { uProg: { value: 0 }, uColor: { value: new THREE.Color(COL.sky) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: 'uniform float uProg; uniform vec3 uColor; varying vec2 vUv; void main(){ if (vUv.x > uProg) discard; float head = smoothstep(.04, 0., uProg - vUv.x); gl_FragColor = vec4(uColor * (1.5 + head * 3.), 1.); }',
  }))
  scene.add(frame)

  /* labels: index, name and line, set the same way in every bay, no containers */
  const prods = beat.lines.filter((l) => l.role === 'product').map((l) => { const i = l.text.indexOf(': '); return { name: l.text.slice(0, i), desc: l.text.slice(i + 2) } })
  const by = (n) => prods.find((p) => p.name === n)
  const labels = ORDER.map((n, i) => {
    const wrap = document.createElement('div')
    wrap.style.cssText = 'position:absolute;left:0;top:0;width:256px;will-change:transform;'
    wrap.innerHTML = `<div class="in" style="opacity:0;will-change:transform,opacity;">`
      + `<div style="display:flex;align-items:center;gap:12px;font-size:17px;font-weight:800;letter-spacing:0.2em;color:${COL.sky};opacity:.85"><span>0${i + 1}</span><span class="rule" style="display:block;height:2px;width:46px;background:${COL.blue};transform-origin:0 50%"></span></div>`
      + `<div class="disp" style="font-size:37px;font-weight:600;letter-spacing:-0.02em;color:#fff;line-height:1.04;margin-top:10px;white-space:nowrap">${n}</div>`
      + `<div style="font-size:20.5px;font-weight:600;color:#cfe3f8;margin-top:9px;line-height:1.28">${by(n).desc}</div></div>`
    document.getElementById('dom').appendChild(wrap)
    return { wrap, inner: wrap.firstChild, rule: wrap.querySelector('.rule'), h: wrap.offsetHeight }
  })
  const tagline = text(beat.lines.find((l) => l.role === 'count').text, { x: 88, y: 46, size: 66, weight: 400, color: '#fff', track: -0.02 })

  const S = { cam: 0, grid: 0, perim: 0, pulse: -10, spin: 0, lensOn: 0, bulb: 0, sweep: 0, coinSpin: -6.2832, coinSettle: 0 }

  return {
    scene, camera,
    frame(t) {
      // camera: tilts down from steep to the working angle and eases in
      const k = S.cam, ease = k * k * (3 - 2 * k)
      const pitch = THREE.MathUtils.degToRad(58 - 19 * ease), D = 78 - 9.4 * ease
      camera.position.set(0, 0.4 + D * Math.sin(pitch), 0.9 + D * Math.cos(pitch))
      camera.lookAt(0, 0.9, 0.9)
      camera.updateMatrixWorld()
      grid.material.uniforms.uProg.value = S.grid; grid.material.uniforms.uPulse.value = S.pulse
      frame.material.uniforms.uProg.value = S.perim

      bays.forEach((b, i) => {
        const r = b.p.rise
        b.obj.visible = r > 0.002
        b.obj.position.set(b.base.x, b.base.y + (1 - r) * 3.2, b.base.z)
        b.obj.scale.setScalar(0.88 + 0.12 * r)
        b.pad.material.uniforms.uProg.value = b.p.pad
        b.pad.visible = !b.noPad || true
        const lab = labels[i]
        const p = project(new THREE.Vector3(b.cell.x + LAB_DX, 0.55, b.cell.z), camera)
        lab.wrap.style.transform = `translate(${p.x}px, ${p.y - lab.h * 0.5}px)`
        lab.inner.style.opacity = String(b.p.lab)
        lab.inner.style.transform = `translateX(${(1 - b.p.lab) * -26}px)`
        lab.rule.style.transform = `scaleX(${b.p.lab})`
      })
      // the bulb
      extras.bulbMats.forEach((m) => { m.emissiveIntensity = m.userData.ei * S.bulb })
      extras.halo.material.opacity = 0.6 * S.bulb
      // the Insight lens sweeps over the dots
      const sx = 0.4 + Math.sin(S.sweep * 6.2832) * 0.6, sz = Math.cos(S.sweep * 6.2832 * 0.5) * 0.35 - 0.1
      extras.mag.position.set(sx, 0.62, sz + 0.55)
      const dp = bays[3].obj.position
      extras.dots.material.uniforms.uLens.value.set(sx, -(sz))   // plane-local x, y(=-world z)
      extras.dots.material.uniforms.uOn.value = S.lensOn
      // the microscope turns
      extras.micro.rotation.y = S.spin
      // the seal
      extras.coin.rotation.y = S.coinSpin + 0.22 * Math.sin(t * 1.7) * S.coinSettle
      extras.coin.position.y = 1.2 + 0.05 * Math.sin(t * 2.0)
    },
    build(tl) {
      tl.set(S, { cam: 0, grid: 0, perim: 0, pulse: -10, spin: 0, lensOn: 0, bulb: 0, sweep: 0, coinSpin: -6.2832, coinSettle: 0 }, 0)
      tl.to(S, { cam: 1, duration: 3.2, ease: 'none' }, 18.5)
      tl.to(S, { grid: 1, duration: 1.3, ease: 'power2.inOut' }, 18.55)

      const at = [19.0, 19.6, 20.2, 20.8, 21.4, 22.0]
      bays.forEach((b, i) => {
        tl.to(b.p, { rise: 1, duration: 0.7, ease: 'power3.out' }, at[i])
        tl.to(b.p, { pad: 1, duration: 0.9, ease: 'power2.inOut' }, at[i] + 0.15)
        tl.to(b.p, { lab: 1, duration: 0.55, ease: 'power3.out' }, at[i] + 0.45)
      })
      // each object does what its product does
      tl.fromTo(extras.chair.position, { x: -2.2 }, { x: -0.55, duration: 0.8, ease: 'power3.out' }, at[0] + 0.5)
      const y0 = extras.books.map((b) => b.position.y)
      tl.fromTo(extras.books.map((b) => b.position), { y: (i) => y0[i] + 1.1 }, { y: (i) => y0[i], duration: 0.5, stagger: 0.035, ease: 'power2.in' }, at[1] + 0.2)
      tl.to(S, { bulb: 1, duration: 0.6, ease: 'power2.out' }, at[1] + 1.1)
      tl.to(S, { spin: 1.6, duration: 5.0, ease: 'sine.inOut' }, at[2])
      tl.to(S, { lensOn: 1, duration: 0.5 }, at[3] + 0.5)
      tl.to(S, { sweep: 1, duration: 4.4, ease: 'sine.inOut' }, at[3] + 0.2)
      tl.fromTo(extras.lid.rotation, { x: 0 }, { x: -2.0, duration: 0.7, ease: 'power2.out' }, at[4] + 0.3)
      tl.fromTo(extras.needle.rotation, { y: 14 }, { y: 0.5, duration: 1.8, ease: 'elastic.out(1,0.35)' }, at[4] + 0.6)
      tl.to(S, { coinSpin: 0, duration: 1.7, ease: 'power3.out' }, at[5] + 0.15)
      tl.to(S, { coinSettle: 1, duration: 0.6 }, at[5] + 1.8)
      // the grid carries a light pulse across every bay, then one ring draws round the whole slab
      tl.fromTo(S, { pulse: -9 }, { pulse: 9, duration: 1.3, ease: 'power1.inOut' }, 22.7)
      tl.to(S, { perim: 1, duration: 1.2, ease: 'power2.inOut' }, 22.9)
      tl.set(tagline, { opacity: 1 }, 23.4)
      tl.fromTo([...tagline.querySelectorAll('.w')], { opacity: 0, filter: 'blur(7px)' }, { opacity: 1, filter: 'blur(0px)', duration: 0.3, stagger: 0.1 }, 23.4)
      for (const e of [tagline, ...labels.map((l) => l.wrap)]) tl.to(e, { opacity: 0, duration: 0.22, ease: 'power3.in' }, 24.5)
    },
  }
}
