// Beat 6, stakeholder views (32.5-40 s). Four round windows on one row, equal columns: each a person (stock photograph, labelled illustrative)
// or, for operations staff, a real wall clock model. Under each window the same four things in the same places: the role, its question,
// a thin line and the product that answers it. The last window opens onto the next beat.
import { COL, THREE, W, H, loadModel, loadTexture, projectRadius, project } from '../common.js'
import { text, textOut } from '../dom.js'
import { block, dotPlane, frontCamera, ringMaterial, wx, wy } from '../layout.js'

const COLX = [240, 720, 1200, 1680]
const CY = 398, R = 1.62

export async function make({ renderer, envs, beat }) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#031020')
  scene.environment = envs.studio
  scene.environmentIntensity = 0.55
  const camera = frontCamera(9)
  const dots = dotPlane(40, 26, { alpha: 0.11 }); scene.add(dots)
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: 'varying vec2 vP; void main(){ float r = length(vP * vec2(.7, 1.)); gl_FragColor = vec4(.015, .08, .2, .3 * exp(-pow(r / 10., 2.))); }' }))
  glow.position.z = -2; scene.add(glow)
  const key = new THREE.DirectionalLight(0xe6efff, 2.2); key.position.set(-4, 6, 10); scene.add(key)

  const roles = beat.lines.filter((l) => l.role === 'role').map((l) => l.text)
  const qs = beat.lines.filter((l) => l.role === 'q').map((l) => l.text)
  const ans = beat.lines.filter((l) => l.role === 'a').map((l) => l.text)

  /* the four windows */
  const crop = (tex, cx, cy, h) => { const t = tex.clone(); t.needsUpdate = true; const ar = tex.image.width / tex.image.height; t.repeat.set(h / ar, h); t.offset.set(cx - h / ar / 2, 1 - cy - h / 2); return t }
  const [tCounsel, tTeacher, tStudent] = await Promise.all(['img-counsel', 'img-teacher', 'img-student'].map((n) => loadTexture(`/photos/images/${n}.webp`)))
  const faces = [crop(tCounsel, 0.38, 0.42, 0.66), crop(tTeacher, 0.6, 0.4, 0.74), crop(tStudent, 0.52, 0.5, 0.8)]
  const wins = []
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group(); g.position.set(wx(COLX[i]), wy(CY), 0)
    let disc
    if (i < 3) disc = new THREE.Mesh(new THREE.CircleGeometry(R, 96), new THREE.MeshBasicMaterial({ map: faces[i] }))
    else disc = new THREE.Mesh(new THREE.CircleGeometry(R, 96), new THREE.MeshStandardMaterial({ color: 0x0a1c30, metalness: 0.4, roughness: 0.5 }))
    g.add(disc)
    if (i === 3) { const clock = await loadModel('wall_clock', 2.5); clock.position.z = 0.3; g.add(clock); g.userData.clock = clock }
    const ring = new THREE.Mesh(new THREE.CircleGeometry(R + 0.4, 96), ringMaterial(R + 0.16, COL.sky, { additive: true, w: 0.03 })); ring.position.z = 0.05
    const ring2 = new THREE.Mesh(new THREE.CircleGeometry(R + 0.6, 96), ringMaterial(R + 0.38, COL.blue, { additive: true, w: 0.012 })); ring2.position.z = 0.05
    g.add(ring, ring2)
    g.userData = { ...g.userData, disc, ring, ring2 }
    scene.add(g); wins.push(g)
  }

  /* text under each window: same four places in every column */
  const cells = COLX.map((x, i) => {
    const role = block(`<div class="disp" style="font-size:54px;font-weight:600;color:#fff;letter-spacing:-0.02em;line-height:1">${roles[i]}</div>`, { x, y: 616, w: 440, center: true })
    const q = block(`<div style="font-size:25px;font-weight:600;color:#cfe3f8;line-height:1.3">${qs[i]}</div>`, { x, y: 698, w: 380, center: true })
    const a = block(`<div style="display:flex;align-items:center;justify-content:center;gap:14px;font-size:25px;font-weight:800;letter-spacing:0.03em;color:${COL.sky}"><span class="ln" style="display:block;height:2px;width:56px;background:${COL.blue};transform-origin:100% 50%"></span><span>${ans[i]}</span></div>`, { x, y: 826, w: 440, center: true })
    return { role, q, a, ln: a.wrap.querySelector('.ln') }
  })
  const credit = document.createElement('div')
  credit.className = 'hud'; credit.textContent = 'Illustrative stock imagery.'
  Object.assign(credit.style, { right: '56px', bottom: '36px', fontSize: '17px', letterSpacing: '0.04em', textTransform: 'none', fontWeight: '600' })
  document.getElementById('dom').appendChild(credit)

  const S = { dots: 0, expand: 0, drift: 0 }
  const P = wins.map(() => ({ open: 0, ring: 0 }))
  const portal = () => wins[3].position

  return {
    scene, camera,
    frame(t) {
      camera.position.x = Math.sin(S.drift * 3.1) * 0.35
      camera.lookAt(0, 0, 0); camera.updateMatrixWorld()
      dots.material.uniforms.uOn.value = S.dots
      wins.forEach((g, i) => {
        const p = P[i]
        g.visible = p.open > 0.002
        g.scale.setScalar(0.001 + 0.999 * p.open)
        g.rotation.y = 0.16 * (1 - p.open) + 0.05 * Math.sin(t * 0.9 + i * 1.4) * p.open
        g.userData.ring.material.uniforms.uProg.value = p.ring; g.userData.ring2.material.uniforms.uProg.value = p.ring
        if (g.userData.clock) g.userData.clock.rotation.z = t * 0.0
      })
    },
    seam() {
      const c = project(portal(), camera)
      const rpx = projectRadius(portal(), R, camera)
      return { x: c.x / W, y: 1 - c.y / H, rx: (rpx * (1 + 8 * S.expand * S.expand)) / H }
    },
    build(tl) {
      tl.set(S, { dots: 0, expand: 0, drift: 0 }, 0)
      tl.to(S, { dots: 1, duration: 0.8 }, 32.6)
      tl.to(S, { drift: 1, duration: 7.2, ease: 'sine.inOut' }, 32.6)
      const at = [32.95, 33.55, 34.15, 34.75]
      cells.forEach((c, i) => {
        const a = at[i]
        tl.to(P[i], { open: 1, duration: 0.8, ease: 'back.out(1.5)' }, a)
        tl.to(P[i], { ring: 1, duration: 0.9, ease: 'power2.inOut' }, a + 0.1)
        tl.fromTo(c.role.inner, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' }, a + 0.4)
        tl.fromTo(c.q.inner, { opacity: 0, filter: 'blur(6px)' }, { opacity: 1, filter: 'blur(0px)', duration: 0.5, ease: 'power2.out' }, a + 0.7)
        tl.fromTo(c.a.inner, { opacity: 0, x: 18 }, { opacity: 1, x: 0, duration: 0.45, ease: 'power3.out' }, a + 1.5)
        tl.fromTo(c.ln, { scaleX: 0 }, { scaleX: 1, duration: 0.45, ease: 'power2.out' }, a + 1.5)
      })
      tl.fromTo(credit, { opacity: 0 }, { opacity: 0.8, duration: 0.5 }, 33.2)
      tl.to(S, { expand: 1, duration: 0.6, ease: 'power3.in' }, 39.75)
      const out = [...cells.flatMap((c) => [c.role.wrap, c.q.wrap, c.a.wrap]), credit]
      for (const e of out) tl.to(e, { opacity: 0, duration: 0.2, ease: 'power3.in' }, 39.45)
    },
  }
}
