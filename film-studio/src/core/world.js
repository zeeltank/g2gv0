// The Scholar Core film's world: ONE continuous 3D scene the camera travels through (no separate beats).
//   desk diorama (real CC0 models)  ->  a wall of the 25 real K12 screens  ->  the intelligence ring  ->  the AI clipboard  ->  six role stages
// Everything is placed in metres. Nothing here animates by itself: story.js tweens these objects on one paused GSAP clock, and window.seek(t)
// applies the camera, so a frame depends only on t. Models are real downloaded Poly Haven assets (CC0); the screens are the masked K12 captures.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { THREE, loadEnv, loadTexture, textTexture } from '../common.js'
import { threadMaterial } from '../layout.js'

const gltf = new GLTFLoader()

/** A model standing on y = 0, centred on x and z, at `scale` x its real size. userData.nodes lists every named part. */
async function model(id, { scale = 1, shadow = true } = {}) {
  const g = await gltf.loadAsync(`/assets/models/${id}/${id}_1k.gltf`)
  const root = g.scene
  root.traverse((o) => { if (o.isMesh) { o.castShadow = shadow; o.receiveShadow = true } })
  const box = new THREE.Box3().setFromObject(root)
  const c = box.getCenter(new THREE.Vector3())
  root.position.set(-c.x, -box.min.y, -c.z)
  const holder = new THREE.Group()
  holder.add(root)
  holder.scale.setScalar(scale)
  const nodes = {}
  root.traverse((o) => { if (o.name) nodes[o.name] = o })
  holder.userData = { nodes, size: box.getSize(new THREE.Vector3()).multiplyScalar(scale) }
  return holder
}

const clone = (m) => { const c = m.clone(true); c.userData = m.userData; return c }

/** A flat screen: a thin dark slab with the screenshot on its face (unlit, so the picture keeps its own colours). */
function screen(tex, w = 1.78) {
  const h = (w * 9) / 16
  const dark = new THREE.MeshStandardMaterial({ color: '#0a1a2c', roughness: 0.5, metalness: 0.35 })
  const face = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.035), [dark, dark, dark, dark, face, dark])
  m.castShadow = false
  m.userData = { w, h, face }
  return m
}

export const WALL = { z: -7, cy: 3.3, R: 11, gx: 1.9, gy: 1.12, w: 1.78 }
export const RING = { c: new THREE.Vector3(0, 2.55, -3.6), r: 1.5 }
export const STAGE = { x0: 18, dx: 5.8, z: -2.4 }

export async function makeWorld({ renderer, tour }) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#06182b')
  scene.fog = new THREE.FogExp2('#06182b', 0.021)
  const envStudio = await loadEnv(renderer, 'monochrome_studio_03')
  scene.environment = envStudio
  scene.environmentIntensity = 0.85

  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  /* ---- light ---- */
  const key = new THREE.DirectionalLight('#fff3df', 2.4)
  key.position.set(-3.5, 6.5, 4.5); key.target.position.set(0, 0.8, 0)
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 0.5, far: 20 })
  const rim = new THREE.DirectionalLight('#8fc4ff', 0.55)
  rim.position.set(4, 3.5, -6); rim.target.position.set(0, 1, 0)
  const lamp = new THREE.PointLight('#ffd9a0', 0, 3.2, 1.6)
  const spot = new THREE.SpotLight('#ffffff', 0, 14, 0.55, 0.6, 1.2)
  spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0005
  scene.add(key, key.target, rim, rim.target, lamp, spot, spot.target)

  /* ---- floor: a dark matte stage that fades into the fog ---- */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), new THREE.MeshStandardMaterial({ color: '#0c2237', roughness: 0.5, metalness: 0.1 }))
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true
  scene.add(floor)

  /* ---- the opening plate: a real photograph on a plane in front of the desk, which the camera pushes through ---- */
  const photoTex = await loadTexture('/assets/photos/pexels-30473509.jpg')
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 4.05), new THREE.MeshBasicMaterial({ map: photoTex, transparent: true, toneMapped: false }))
  plate.position.set(0, 1.5, 1.4)
  scene.add(plate)

  /* ---- the desk diorama ---- */
  const [desk, laptop, clipA, pads, cup, deskLamp] = await Promise.all([
    model('metal_office_desk'), model('classic_laptop'), model('clipboard'), model('office_notepads'), model('stationery_supplies'), model('desk_lamp_arm_01'),
  ])
  const clipB = clone(clipA)
  desk.position.set(0, 0, 0)
  const topY = desk.userData.size.y
  laptop.position.set(-0.2, topY, 0.02)
  clipA.position.set(-0.85, topY + 0.004, 0.18); clipA.rotation.y = 0.35
  pads.position.set(0.3, topY + 0.004, 0.26); pads.rotation.y = -0.25
  clipB.position.set(0.95, topY + 0.004, -0.02); clipB.rotation.y = -0.5
  cup.position.set(0.55, topY, -0.3)
  deskLamp.position.set(0.85, topY, -0.3); deskLamp.rotation.y = -0.6
  lamp.position.set(0.85, topY + 0.7, -0.05)
  scene.add(desk, laptop, clipA, pads, clipB, cup, deskLamp)

  // the real K12 screenshot on the laptop's own screen mesh
  // (the screen is one primitive of a multi-material mesh, so it is found by its material name, not by node name)
  const feesTex = await loadTexture('/screens/institute-erp--fees--fees-collect.webp')
  // the screen quad is about 4:3 and its UVs run u 1..2, v 0..1 (top to bottom): an upright, repeating, centre-cropped copy of the screenshot
  const lapTex = feesTex.clone()
  lapTex.flipY = false; lapTex.wrapS = THREE.RepeatWrapping; lapTex.repeat.set(0.686, 1); lapTex.offset.set(-0.529, 0); lapTex.needsUpdate = true
  const lapScreen = new THREE.MeshBasicMaterial({ map: lapTex, toneMapped: false })
  laptop.traverse((o) => { if (o.isMesh && o.material?.name === 'classic_laptop_screen') { o.material = lapScreen; o.castShadow = false } })

  // name tags over the three paper things: the situation of the Problem tab
  const tagMat = (t) => new THREE.MeshBasicMaterial({ map: textTexture(t, { w: 640, h: 160, font: '800 62px Manrope', color: '#ffffff', bg: 'rgba(16,136,246,0.94)', align: 'center', lineH: 80 }), transparent: true, toneMapped: false })
  const tags = tour.problem.scattered.map((t, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.125), tagMat(t))
    const base = [clipA, pads, clipB][i]
    m.position.set(base.position.x, topY + 0.45, base.position.z + 0.1)
    m.scale.setScalar(0.001)
    scene.add(m)
    return m
  })

  /* ---- the wall: the 25 real screens, one row per group of the Features tab ---- */
  const wall = []
  const shotTex = new Map()
  const getShot = async (url) => { if (!shotTex.has(url)) shotTex.set(url, await loadTexture('/screens/' + url.split('/').pop())); return shotTex.get(url) }
  const groups = tour.features.groups
  for (let r = 0; r < groups.length; r++) {
    for (let c = 0; c < groups[r].subs.length; c++) {
      const sub = groups[r].subs[c]
      const tex = sub.shot ? await getShot(sub.shot) : feesTex
      const m = screen(tex, WALL.w)
      const a = (c - 2) * 0.165
      const home = new THREE.Vector3(WALL.R * Math.sin(a), WALL.cy + (2 - r) * WALL.gy, WALL.z + WALL.R * (1 - Math.cos(a)))
      m.userData = { ...m.userData, home, homeRot: -a, row: r, col: c, id: sub.id, name: sub.name }
      m.position.copy(new THREE.Vector3(-0.2, topY + 0.2, -0.05)); m.scale.setScalar(0.001); m.visible = true
      scene.add(m)
      wall.push(m)
    }
  }

  /* ---- the intelligence ring: the six modules that ask questions of the school's records ---- */
  const ring = []
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.34, 48, 32), new THREE.MeshStandardMaterial({ color: '#1088f6', emissive: '#1088f6', emissiveIntensity: 1.1, roughness: 0.25 }))
  hub.position.copy(RING.c); hub.scale.setScalar(0.001)
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.62, 32, 24), new THREE.MeshBasicMaterial({ color: '#2a8dff', transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending }))
  halo.position.copy(RING.c)
  scene.add(hub, halo)
  const threads = []
  const mods = tour.intelligence.modules
  for (let i = 0; i < mods.length; i++) {
    const sub = groups.flatMap((g) => g.subs).find((s) => s.id === mods[i].id)
    const tex = sub?.shot ? await getShot(sub.shot) : feesTex
    const m = screen(tex, 1.2)
    const ang = (-90 + (360 / mods.length) * i) * (Math.PI / 180)
    const pos = new THREE.Vector3(RING.c.x + RING.r * 1.05 * Math.cos(ang), RING.c.y + RING.r * 0.95 * Math.sin(ang), RING.c.z)
    m.userData = { ...m.userData, home: pos, id: mods[i].id, name: mods[i].name }
    m.position.copy(pos).add(new THREE.Vector3(0, 0, -2.2)); m.scale.setScalar(0.001)
    scene.add(m); ring.push(m)
    const curve = new THREE.LineCurve3(RING.c.clone(), pos.clone())
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.011, 6), threadMaterial('#7fc0ff'))
    tube.material.uniforms.uProg.value = 0
    scene.add(tube); threads.push(tube)
  }

  /* ---- the AI panel: a draft preview that waits for a person to press Apply ---- */
  const aiCv = document.createElement('canvas'); aiCv.width = 1280; aiCv.height = 860
  const aiTex = new THREE.CanvasTexture(aiCv); aiTex.colorSpace = THREE.SRGBColorSpace; aiTex.anisotropy = 8
  const aiPanel = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.84), new THREE.MeshBasicMaterial({ map: aiTex, transparent: true, toneMapped: false }))
  aiPanel.position.set(-0.3, topY + 0.6, 0.4); aiPanel.scale.setScalar(0.001)
  scene.add(aiPanel)
  const aiState = { typed: 0, apply: 0, cursor: 0 }
  const wrap = (g, text, maxW) => { const words = text.split(' '); const lines = []; let line = ''; for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { lines.push(line); line = w } else line = t } if (line) lines.push(line); return lines }
  function drawAi() {
    const g = aiCv.getContext('2d')
    g.clearRect(0, 0, 1280, 860)
    g.fillStyle = 'rgba(11,37,64,0.97)'; g.beginPath(); g.roundRect(0, 0, 1280, 860, 36); g.fill()
    g.strokeStyle = 'rgba(159,208,255,0.35)'; g.lineWidth = 4; g.stroke()
    g.fillStyle = '#9fd0ff'; g.font = '800 34px Manrope'; g.textBaseline = 'alphabetic'; g.fillText('DRAFT PREVIEW', 64, 100)
    g.fillStyle = '#b7c7da'; g.font = '700 30px Manrope'; g.textAlign = 'right'; g.fillText(tour.ai.sample.label, 1216, 100); g.textAlign = 'left'
    const n = Math.round(aiState.typed * tour.ai.sample.text.length)
    g.fillStyle = '#ffffff'; g.font = '500 54px Manrope'
    const lines = wrap(g, tour.ai.sample.text.slice(0, n), 1150)
    lines.slice(0, 6).forEach((l, i) => g.fillText(l, 64, 210 + i * 78))
    const applied = aiState.apply
    g.fillStyle = applied > 0.5 ? '#74cd23' : '#1088f6'; g.beginPath(); g.roundRect(64, 690, 250, 100, 20); g.fill()
    g.fillStyle = applied > 0.5 ? '#06182b' : '#ffffff'; g.font = '800 44px Manrope'; g.textAlign = 'center'; g.fillText(applied > 0.5 ? 'Applied' : 'Apply', 189, 757)
    g.strokeStyle = 'rgba(159,208,255,0.4)'; g.lineWidth = 4; g.beginPath(); g.roundRect(340, 690, 270, 100, 20); g.stroke()
    g.fillStyle = '#ffffff'; g.fillText('Discard', 475, 757); g.textAlign = 'left'
    if (aiState.cursor > 0.01) {   // the pointer that presses Apply
      const cx = 64 + 250 * 0.62 + (1 - aiState.cursor) * 420; const cy = 690 + 100 * 0.72 + (1 - aiState.cursor) * 260
      g.fillStyle = '#fff'; g.strokeStyle = '#06182b'; g.lineWidth = 3
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, cy + 64); g.lineTo(cx + 18, cy + 48); g.lineTo(cx + 34, cy + 80); g.lineTo(cx + 46, cy + 74); g.lineTo(cx + 30, cy + 44); g.lineTo(cx + 54, cy + 40); g.closePath(); g.fill(); g.stroke()
    }
    aiTex.needsUpdate = true
  }

  /* ---- the role stages: one real object per role, on a row of pedestals ---- */
  const stage = []
  const pedestal = () => {
    const g = new THREE.Group()
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.02, 0.16, 64), new THREE.MeshStandardMaterial({ color: '#0f2a45', roughness: 0.4, metalness: 0.35 }))
    body.position.y = 0.08; body.receiveShadow = true; body.castShadow = true
    const rimMesh = new THREE.Mesh(new THREE.TorusGeometry(0.97, 0.012, 8, 96), new THREE.MeshBasicMaterial({ color: '#7fc0ff' }))
    rimMesh.rotation.x = Math.PI / 2; rimMesh.position.y = 0.162
    g.add(body, rimMesh)
    return g
  }
  const projector = await model('projector_screen')
  const stageObjects = [
    async () => { const g = new THREE.Group(); const m = projector; const t = await getShot(groups[1].subs[0].shot); m.traverse((o) => { if (o.isMesh && o.material?.name === 'projector_screen') o.material = new THREE.MeshBasicMaterial({ map: t, toneMapped: false }) }); m.scale.setScalar(0.95); g.add(m); return g },
    async () => {   // the first desk a family meets: the enquiry on a computer, the visitors' register on a clipboard
      const g = new THREE.Group(); const L = clone(laptop); L.scale.setScalar(1.45); L.position.set(-0.2, 0, -0.1)
      const t2 = (await getShot(groups[0].subs[0].shot)).clone(); t2.flipY = false; t2.wrapS = THREE.RepeatWrapping; t2.repeat.set(0.686, 1); t2.offset.set(-0.529, 0); t2.needsUpdate = true
      const mt = new THREE.MeshBasicMaterial({ map: t2, toneMapped: false })
      L.traverse((o) => { if (o.isMesh && o.material?.name === 'classic_laptop_screen') o.material = mt })
      const s = await model('stationery_supplies', { scale: 3 }); s.position.set(0.58, 0, -0.32)
      const c = clone(clipA); c.scale.setScalar(2); c.position.set(0.35, 0, 0.45); c.rotation.y = 0.6
      g.add(L, s, c); return g
    },
    async () => { const g = new THREE.Group(); const m = await model('CashRegister_01', { scale: 1.7 }); g.add(m); return g },
    async () => { const g = new THREE.Group(); const m = await model('standing_chalkboard_01', { scale: 0.9 }); m.position.x = -0.25; const d = await model('SchoolDesk_01', { scale: 0.95 }); d.position.set(0.5, 0, 0.35); d.rotation.y = -0.6; g.add(m, d); return g },
    async () => { const g = new THREE.Group(); const m = await model('hand_truck', { scale: 0.9 }); m.position.x = -0.2; const b = await model('cardboard_box_01', { scale: 1.5 }); b.position.set(0.5, 0, 0.2); b.rotation.y = 0.4; const b2 = clone(b); b2.position.set(0.5, 0.52, 0.2); b2.rotation.y = -0.2; g.add(m, b, b2); return g },
    async () => { const g = new THREE.Group(); const d = await model('SchoolDesk_01', { scale: 1.25 }); d.position.x = -0.1; const c = await model('SchoolChair_01', { scale: 1.2 }); c.position.set(0.15, 0, 0.62); c.rotation.y = Math.PI; g.add(d, c); return g },
  ]
  for (let i = 0; i < tour.roles.length; i++) {
    const holder = new THREE.Group()
    holder.position.set(STAGE.x0 + i * STAGE.dx, 0, STAGE.z)
    holder.add(pedestal())
    const obj = await stageObjects[i]()
    obj.position.y = 0.16
    holder.add(obj)
    obj.scale.multiplyScalar(0.001)
    holder.userData = { obj, ring: holder.children[0].children[1] }
    scene.add(holder); stage.push(holder)
  }

  /* ---- the camera: story.js tweens this proxy; frame() applies it ---- */
  const camera = new THREE.PerspectiveCamera(32, 1920 / 1080, 0.05, 220)
  // ax, ay: the screen pixel (of 1920 x 1080) where the look-at point lands. 960, 540 is the middle; a shot moves its subject onto the grid by moving the anchor,
  // not by nudging the camera, so every shot puts its subject on the same fixed point whatever the camera does.
  const cam = { px: 0, py: 1.5, pz: 6.2, tx: 0, ty: 1.5, tz: 0, fov: 32, roll: 0, ax: 960, ay: 540 }
  const fx = { dip: 0, flash: 0 }

  function frame() {
    camera.position.set(cam.px, cam.py, cam.pz)
    camera.up.set(Math.sin(cam.roll), Math.cos(cam.roll), 0)
    camera.lookAt(cam.tx, cam.ty, cam.tz)
    camera.fov = cam.fov
    camera.setViewOffset(1920, 1080, -(cam.ax - 960), -(cam.ay - 540), 1920, 1080)   // shifts the picture so the look-at point lands on (ax, ay)
    camera.updateProjectionMatrix()
    drawAi()
    // the spot follows the camera's focus (the role stages sit far from the desk)
    spot.position.set(cam.tx + 1.4, 7, cam.tz + 4.5); spot.target.position.set(cam.tx, 0.8, cam.tz)
    lamp.position.set(0.85, topY + 0.7, -0.05)
  }

  return { scene, camera, cam, fx, frame, parts: { plate, desk, laptop, clipA, clipB, pads, cup, deskLamp, tags, wall, ring, hub, halo, threads, aiPanel, aiState, stage, spot, lamp, key, rim, topY, lapScreen, feesTex, getShot } }
}
