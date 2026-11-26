// The Scholar Core film's story: the camera path, the motion of the objects and every caption, on ONE paused GSAP timeline.
// All words are the checked text of the Scholar Core tour (lib/client-presentation/generated/atlas.json, tour), so nothing is typed twice.
//
// THE GRID (the rule of these films: equal columns, one baseline, names and lines in the same place every time).
//   Every caption sits in a named SLOT, always at x = 140, always at the same y and size. There is no free positioning.
//   Every shot is one of three LAYOUTS and puts its subject on that layout's ANCHOR (a fixed screen point), whatever the camera does:
//     SPLIT  type in the left five columns (x 140 to 900), the subject centred on (1395, 540) in the right five  (desk, laptop, ring, AI, roles)
//     WIDE   the subject above (centred on x 960), type in a band under it, from y 790                       (the wall of screens, the close)
//     FULL   a full-bleed photograph, type in the BODY slot over a scrim                                     (the opening)
//   film-studio/lint-core.mjs measures every visible caption against its slot and against the layout, and fails on drift or overlap.
import { THREE } from '../common.js'
import { text, textOut, wordsIn } from '../dom.js'
import { RING, STAGE, WALL } from './world.js'

export const ANCHOR = { SPLIT: { ax: 1395, ay: 540 }, WIDE: { ax: 960, ay: 400 }, FULL: { ax: 960, ay: 540 } }

/** Caption slots. x, y are the top-left of the first line, in stage pixels; w is the line length. Type is set the same size in the same slot every time. */
export const SLOT = {
  K:     { x: 140, y: 96, kind: 'label' },                                                            // kicker: which part of the story
  LEAD:  { x: 140, y: 170, size: 36, w: 760, weight: 500, font: 'sans', wrap: true },                 // a lead sentence above the subject (intelligence, AI)
  LAB:   { x: 140, y: 500, kind: 'label' },                                                           // small label over the headline
  HEAD:  { x: 140, y: 540, size: 96, w: 760, weight: 300, wrap: true },                               // the headline, up to two lines
  BODY:  { x: 140, y: 780, size: 38, w: 760, weight: 500, font: 'sans', wrap: true },                 // the sentence under it, up to three lines
  FOOT:  { x: 140, y: 960, size: 26, w: 760, weight: 600, font: 'sans', wrap: true },                 // the small line at the foot
  LISTL: { x: 140, y: 350, kind: 'label', pitch: 84 },                                                // a short list, every row two lines: a name label (row i at y + i * pitch) ...
  LISTT: { x: 140, y: 380, size: 26, w: 760, weight: 600, font: 'sans', pitch: 84 },                  // ... over one line of text, 30 px under it
  WHEAD: { x: 140, y: 790, size: 84, w: 1100, weight: 300 },                                          // wide layout: headline in the band
  WBODY: { x: 140, y: 910, size: 32, w: 1100, weight: 500, font: 'sans', wrap: true },                // wide layout: the line under it
  WFOOT: { x: 140, y: 962, size: 24, w: 1100, weight: 600, font: 'sans' },                            // wide layout: the small line under it
  WNUM:  { x: 1280, y: 760, size: 190, w: 500, weight: 800, align: 'right' },                         // wide layout: a number at the right of the band
}

export function makeStory({ tl, world, tour }) {
  const { cam, fx, parts } = world
  const { plate, tags, wall, ring, hub, halo, threads, aiPanel, aiState, stage, spot, lamp, topY, lapScreen } = parts
  const root = document.getElementById('dom')
  const LAP = new THREE.Vector3(-0.2, topY + 0.2, -0.05)
  const layouts = []   // [from, to, 'SPLIT' | 'WIDE' | 'FULL'], read by the lint

  /* ---- helpers ---- */
  const tan = (d) => Math.tan(THREE.MathUtils.degToRad(d))
  /** A camera pose that frames `at` so that a world height h (or width w) spans ph (or pw) pixels; az and el orbit it. */
  const pose = ({ at, h, ph, w, pw, az = 0, el = 6, fov = 32 }) => {
    const dist = w ? (w * 1080) / (2 * tan(fov / 2) * pw) : (h * 1080) / (2 * tan(fov / 2) * ph)
    const a = THREE.MathUtils.degToRad(az); const e = THREE.MathUtils.degToRad(el)
    return { px: at[0] + dist * Math.sin(a) * Math.cos(e), py: at[1] + dist * Math.sin(e), pz: at[2] + dist * Math.cos(a) * Math.cos(e), tx: at[0], ty: at[1], tz: at[2], fov, roll: 0 }
  }
  const shot = (layout, args) => ({ ...pose(args), ...ANCHOR[layout] })
  const go = (v, at, dur, ease = 'power2.inOut') => tl.to(cam, { ...v, duration: dur, ease }, at)
  const put = (v, at) => tl.set(cam, v, at)
  const layout = (from, to, kind) => layouts.push([from, to, kind])

  const cap = (str, slot, at, out, o = {}) => {
    const s = SLOT[slot]
    const e = text(str, { x: s.x, y: s.y + (o.row ? o.row * s.pitch : 0), size: s.size, weight: s.weight, w: s.w, wrap: s.wrap, font: s.font, align: s.align, color: o.color, words: o.words })
    e.dataset.slot = slot
    wordsIn(tl, e, at, { step: o.step ?? 0.06, dur: 0.34 }); textOut(tl, e, out)
    return e
  }
  const kick = (slot, str, at, out) => {
    const s = SLOT[slot]
    const e = document.createElement('div'); e.className = 'lab'; e.dataset.slot = slot; e.textContent = str; e.style.left = `${s.x}px`; e.style.top = `${s.y}px`; root.appendChild(e)
    tl.fromTo(e, { opacity: 0, y: 10 }, { opacity: 0.95, y: 0, duration: 0.45, ease: 'power2.out' }, at)
    tl.to(e, { opacity: 0, duration: 0.25 }, out)
    return e
  }
  const names = (r) => tour.features.groups[r].subs.map((s) => s.name).join('   ·   ')

  // scrims under the type: a dark floor for the bright photograph, a dark left edge for the split layout, a dark band for the wide layout
  const mkScrim = (css) => { const d = document.createElement('div'); d.style.cssText = `position:absolute;inset:0;opacity:0;${css}`; root.appendChild(d); return d }
  const scrimP = mkScrim('background:linear-gradient(to top,rgba(2,8,15,.9) 0%,rgba(2,8,15,.55) 34%,rgba(2,8,15,0) 62%),linear-gradient(to bottom,rgba(2,8,15,.6) 0%,rgba(2,8,15,0) 22%);')
  const scrimL = mkScrim('background:linear-gradient(to right,rgba(2,8,15,.92) 0%,rgba(2,8,15,.7) 32%,rgba(2,8,15,0) 56%);')
  const scrimB = mkScrim('background:linear-gradient(to top,rgba(2,8,15,.94) 0%,rgba(2,8,15,.8) 20%,rgba(2,8,15,0) 40%);')
  const fade = (el, on, off) => { tl.to(el, { opacity: 1, duration: 0.6 }, on); tl.to(el, { opacity: 0, duration: 0.5 }, off) }

  // what is on screen: each shot shows only its own subject
  const deskSet = [parts.desk, parts.laptop, parts.clipA, parts.clipB, parts.pads, parts.cup, parts.deskLamp]
  const ringSet = [...ring, parts.hub, parts.halo, ...threads]

  /* ---- start state ---- */
  tl.set(cam, { px: 0, py: 1.5, pz: 6.2, tx: 0, ty: 1.5, tz: 0, fov: 32, roll: 0, ...ANCHOR.FULL }, 0)
  tl.set(fx, { dip: 1, flash: 0 }, 0)
  tl.set(wall.map((m) => m.userData.face.color), { r: 1, g: 1, b: 1 }, 0)
  tl.set(spot, { intensity: 0 }, 0)

  /* ============ 0 to 3.6  FULL: a real morning, a real photograph; then the camera goes through it ============ */
  layout(0, 3.7, 'FULL')
  tl.to(fx, { dip: 0, duration: 1.0, ease: 'power1.out' }, 0)
  fade(scrimP, 0.2, 3.0)
  tl.to(cam, { pz: 5.0, px: 0.3, duration: 3.4, ease: 'sine.inOut' }, 0)
  kick('K', tour.problem.label.replace(/\.$/, ''), 0.5, 3.4)
  cap(tour.problem.beats[0], 'BODY', 0.7, 3.5)
  tl.to(plate.position, { y: 6.2, duration: 1.5, ease: 'power3.in' }, 3.0)
  tl.to(plate.material, { opacity: 0, duration: 0.9, ease: 'power1.in' }, 3.2)

  /* ============ 3.2 to 9.4  SPLIT: the desk, three books, three versions of the truth ============ */
  layout(3.7, 13.6, 'SPLIT')
  const DESK = { at: [0, 0.82, 0], h: 1.75, ph: 650, el: 8 }
  go(shot('SPLIT', { ...DESK, az: 16 }), 3.0, 1.9, 'power3.inOut')
  go(shot('SPLIT', { ...DESK, az: -14 }), 4.9, 4.4, 'sine.inOut')
  fade(scrimL, 3.6, 13.2)
  kick('K', 'The front desk', 4.0, 9.0)
  tags.forEach((m, i) => tl.to(m.scale, { x: 1, y: 1, z: 1, duration: 0.55, ease: 'back.out(2)' }, 4.5 + i * 0.3))
  cap(tour.problem.beats[1], 'BODY', 4.2, 7.0)
  cap(tour.problem.beats[2], 'BODY', 7.2, 9.5)
  tl.to(parts.deskLamp.rotation, { y: -0.3, duration: 4, ease: 'sine.inOut' }, 3.5)
  tl.to(lamp, { intensity: 2.2, duration: 1.2 }, 3.4)

  /* ============ 9.4 to 13.6  SPLIT: one record, the three papers go into the laptop ============ */
  go(shot('SPLIT', { at: [-0.2, 0.98, 0], h: 0.62, ph: 650, az: 0, el: 3, fov: 26 }), 9.4, 2.3, 'power3.inOut')
  tags.forEach((m, i) => {
    tl.to(m.position, { x: LAP.x, y: LAP.y, z: LAP.z, duration: 0.85, ease: 'power3.in' }, 10.5 + i * 0.22)
    tl.to(m.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.85, ease: 'power3.in' }, 10.5 + i * 0.22)
  })
  tl.to(lapScreen.color, { r: 1.4, g: 1.4, b: 1.45, duration: 0.7, ease: 'power2.out' }, 11.4)
  cap(tour.problem.record, 'HEAD', 11.3, 13.7, { step: 0.12 })
  cap(tour.problem.turn, 'BODY', 11.9, 13.7, { color: '#ffffff' })

  /* ============ 13.4 to 28.3  WIDE: the whole office, 25 real screens in five rows ============ */
  const W0 = 13.62
  layout(13.6, 28.3, 'WIDE')
  tl.to(fx, { flash: 1, duration: 0.28, ease: 'power2.in' }, 13.3)
  put(shot('WIDE', { at: [0, WALL.cy, -7], h: 5.9, ph: 640, fov: 36, el: 0 }), W0)
  tl.set(deskSet, { visible: false }, W0)
  tl.to(fx, { flash: 0, duration: 0.7, ease: 'power2.out' }, W0 + 0.02)
  fade(scrimB, W0 + 0.2, 28.0)
  wall.forEach((m, i) => {
    const h = m.userData
    const at = 13.9 + i * 0.045
    tl.to(m.position, { x: h.home.x, y: h.home.y, z: h.home.z, duration: 1.5, ease: 'expo.out' }, at)
    tl.to(m.scale, { x: 1, y: 1, z: 1, duration: 1.3, ease: 'back.out(1.2)' }, at)
    tl.to(m.rotation, { y: h.homeRot, duration: 1.5, ease: 'expo.out' }, at)
  })
  cap('Scholar Core', 'WHEAD', 14.3, 17.5, { step: 0.1 })
  cap(tour.summary.lines[0], 'WBODY', 15.0, 17.5, { color: '#9fd0ff' })
  const count = text('0', { x: SLOT.WNUM.x, y: SLOT.WNUM.y, size: SLOT.WNUM.size, weight: SLOT.WNUM.weight, w: SLOT.WNUM.w, words: false, color: '#9fd0ff', align: 'right' })
  count.dataset.slot = 'WNUM'
  const n = { v: 0 }
  tl.set(count, { opacity: 1 }, 14.4)
  tl.to(n, { v: wall.length, duration: 1.6, ease: 'power2.out', onUpdate: () => { count.textContent = String(Math.round(n.v)) } }, 14.5)
  tl.to(count, { opacity: 0, duration: 0.4 }, 17.4)
  // row by row: the camera settles on each group of five, the active row always lands at the same height
  const rowY = (r) => WALL.cy + (2 - r) * WALL.gy
  for (let r = 0; r < 5; r++) {
    const at = 17.5 + r * 2.15
    go({ ...pose({ at: [0, rowY(r), -7], w: 9.0, pw: 1560, fov: 34, el: 0 }), ax: 960, ay: 360 }, at, 1.0)
    wall.forEach((m) => {
      const v = m.userData.row === r ? 1 : 0.3
      tl.to(m.userData.face.color, { r: v, g: v, b: v, duration: 0.6, ease: 'power2.out' }, at)
    })
    cap(tour.features.groups[r].title, 'WHEAD', at + 0.2, at + 2.0, { step: 0.07 })
    cap(names(r), 'WBODY', at + 0.5, at + 2.0, { color: '#b7c7da', step: 0.05 })
  }
  const E_WALL = 17.5 + 5 * 2.15   // 28.25

  /* ============ SPLIT: the intelligence, six modules ask questions of the school's own records ============ */
  const I0 = E_WALL + 0.1
  const IS = { at: [RING.c.x, RING.c.y, RING.c.z], h: 3.7, ph: 700, fov: 34, el: 0 }
  layout(I0 + 0.1, I0 + 13.5, 'SPLIT')
  tl.set(wall, { visible: false }, I0 + 0.2)
  put(shot('SPLIT', IS), I0 + 0.2)
  go(shot('SPLIT', { ...IS, h: 3.5, ph: 700 }), I0 + 0.2, 11, 'sine.inOut')
  kick('K', 'Intelligence', I0 + 0.5, I0 + 12.5)
  cap(tour.intelligence.lead, 'LEAD', I0 + 0.7, I0 + 4.4, { step: 0.04 })
  tl.to(hub.scale, { x: 1, y: 1, z: 1, duration: 0.9, ease: 'back.out(1.6)' }, I0 + 0.7)
  tl.to(halo.material, { opacity: 0.18, duration: 1.2 }, I0 + 0.9)
  ring.forEach((m, i) => {
    const at = I0 + 1.4 + i * 0.3
    tl.to(m.position, { x: m.userData.home.x, y: m.userData.home.y, z: m.userData.home.z, duration: 1.1, ease: 'expo.out' }, at)
    tl.to(m.scale, { x: 1, y: 1, z: 1, duration: 0.9, ease: 'back.out(1.5)' }, at)
    tl.to(threads[i].material.uniforms.uProg, { value: 1, duration: 0.9, ease: 'power2.inOut' }, at + 0.35)
  })
  tl.to(hub.material, { emissiveIntensity: 1.8, duration: 1.0, yoyo: true, repeat: 3, ease: 'sine.inOut' }, I0 + 2.2)
  const Q0 = I0 + 4.6
  tour.intelligence.modules.forEach((m, i) => {
    const at = Q0 + i * 1.55
    cap(m.name, 'HEAD', at, at + 1.28, { step: 0.05 })     // gone (a 0.22 s fade) before the next module's caption begins at at + 1.55
    cap(m.asks, 'BODY', at + 0.1, at + 1.28, { step: 0.04 })
    ring.forEach((r, j) => { const v = j === i ? 1.25 : 0.4; tl.to(r.userData.face.color, { r: v, g: v, b: v, duration: 0.4 }, at) })   // the one being asked about lights up
  })
  const E_INTEL = Q0 + 6 * 1.55
  ring.forEach((r) => tl.to(r.userData.face.color, { r: 1, g: 1, b: 1, duration: 0.5 }, E_INTEL))
  cap(tour.intelligence.close, 'BODY', E_INTEL + 0.1, E_INTEL + 2.5, { color: '#9fd0ff', step: 0.05 })

  /* ============ SPLIT: AI, a draft for a person to decide on ============ */
  const A0 = E_INTEL + 2.6
  const AI = { at: [0, 1.05, 0.3], h: 1.7, ph: 640, az: -6, el: 8 }
  layout(A0, A0 + 9.6, 'SPLIT')
  put(shot('SPLIT', AI), A0)
  go(shot('SPLIT', { ...AI, h: 1.6, az: 2 }), A0, 9.5, 'sine.inOut')
  tl.set(ringSet, { visible: false }, A0)
  tl.set(deskSet, { visible: true }, A0)
  fade(scrimL, A0 + 0.2, A0 + 9.3)
  tl.to(lapScreen.color, { r: 1, g: 1, b: 1, duration: 0.3 }, A0)
  kick('K', 'AI capability', A0 + 0.3, A0 + 9.3)
  cap(tour.ai.lead, 'LEAD', A0 + 0.5, A0 + 4.6, { step: 0.04 })
  tl.to(aiPanel.scale, { x: 1, y: 1, z: 1, duration: 0.8, ease: 'back.out(1.4)' }, A0 + 0.6)
  tour.ai.uses.forEach((u, i) => {
    const at = A0 + 1.0 + i * 0.4
    const l = kick('LISTL', u.name, at, A0 + 5.2); l.style.top = `${SLOT.LISTL.y + i * SLOT.LISTL.pitch}px`
    cap(u.line, 'LISTT', at + 0.1, A0 + 5.2, { row: i, step: 0.03 })
  })
  tl.to(aiState, { typed: 1, duration: 3.2, ease: 'none' }, A0 + 1.6)
  tl.to(aiState, { cursor: 1, duration: 0.9, ease: 'power2.inOut' }, A0 + 5.0)
  tl.set(aiState, { apply: 1 }, A0 + 6.15)
  tl.to(aiState, { cursor: 0, duration: 0.5 }, A0 + 6.9)
  cap(tour.ai.guard, 'BODY', A0 + 6.3, A0 + 9.4, { color: '#9fd0ff', step: 0.05 })
  cap(tour.ai.control, 'FOOT', A0 + 7.2, A0 + 9.4, { color: '#b7c7da', step: 0.04 })
  const E_AI = A0 + 9.6

  /* ============ SPLIT: the roles, one real object each, on a stage ============ */
  const R0 = E_AI
  const roles = tour.roles
  const sx = (i) => STAGE.x0 + i * STAGE.dx
  const OBJ_H = [1.85, 1.35, 1.3, 1.7, 1.55, 1.5]   // world height of each role's stage with its pedestal, so every object reads at the same size
  const rp = (i) => shot('SPLIT', { at: [sx(i), 0.16 + OBJ_H[i] / 2 - 0.1, STAGE.z], h: OBJ_H[i] + 0.2, ph: 650, az: 0, el: 8 })
  layout(R0, R0 + roles.length * 3.3, 'SPLIT')
  put(rp(0), R0)
  // every fade is a chain of plain .to tweens on dip (never a fromTo, which would write its starting value whenever the playhead is before it)
  tl.to(fx, { dip: 1, duration: 0.3, ease: 'power1.in' }, R0 - 0.35)
  tl.to(fx, { dip: 0, duration: 0.6, ease: 'power1.out' }, R0)
  tl.set(parts.aiPanel, { visible: false }, R0)
  tl.to(spot, { intensity: 260, duration: 0.8 }, R0 + 0.1)
  fade(scrimL, R0 + 0.2, R0 + roles.length * 3.3)
  kick('K', 'Role-wise benefits', R0 + 0.4, R0 + roles.length * 3.3 - 0.2)
  roles.forEach((r, i) => {
    const at = R0 + i * 3.3
    const holder = stage[i]
    if (i > 0) go(rp(i), at - 0.5, 1.3, 'power3.inOut')
    tl.to(holder.userData.obj.scale, { x: 1, y: 1, z: 1, duration: 0.85, ease: 'back.out(1.5)' }, at + 0.2)
    tl.fromTo(holder.userData.obj.rotation, { y: 0.1 }, { y: 1.4, duration: 3.6, ease: 'none', immediateRender: false }, at + 0.2)
    tl.to(holder.userData.obj.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.45, ease: 'power2.in' }, at + 2.85)
    kick('LAB', r.who.toUpperCase(), at + 0.3, at + 3.1)
    cap(r.role, 'HEAD', at + 0.4, at + 3.15, { step: 0.08 })
    cap(r.benefits[0], 'BODY', at + 0.9, at + 3.15, { step: 0.04 })
  })
  const E_ROLES = R0 + roles.length * 3.3

  /* ============ WIDE: the close, the whole office again from the desk ============ */
  const C0 = E_ROLES + 0.2
  layout(C0, C0 + 7.4, 'WIDE')
  tl.to(fx, { dip: 1, duration: 0.35 }, E_ROLES - 0.3)
  const CLOSE = { at: [0, WALL.cy, -7], h: 5.9, ph: 640, fov: 36, el: 0 }
  put(shot('WIDE', CLOSE), C0)
  go(shot('WIDE', { ...CLOSE, ph: 700 }), C0, 6.8, 'sine.inOut')   // a slow push toward the finished wall
  tl.to(spot, { intensity: 0, duration: 0.2 }, C0)
  tl.set(wall, { visible: true }, C0)
  tl.set(deskSet, { visible: false }, C0)
  tl.set(wall.map((m) => m.userData.face.color), { r: 1, g: 1, b: 1 }, C0)
  tl.to(fx, { dip: 0, duration: 0.8, ease: 'power1.out' }, C0)
  fade(scrimB, C0 + 0.3, C0 + 6.8)
  cap('Scholar Core', 'WHEAD', C0 + 0.8, C0 + 6.6, { step: 0.12 })
  cap(tour.summary.lines[0], 'WBODY', C0 + 1.8, C0 + 6.6, { color: '#9fd0ff', step: 0.06 })
  cap(`Institute ERP  ·  ${wall.length} modules`, 'WFOOT', C0 + 2.6, C0 + 6.6, { color: '#b7c7da', step: 0.05 })
  const END = C0 + 7.2
  tl.to(fx, { dip: 1, duration: 0.7, ease: 'power1.in' }, END - 0.7)

  return { length: END, layouts }
}
