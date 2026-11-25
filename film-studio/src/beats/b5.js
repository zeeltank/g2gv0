// Beat 5, workflow and AI (25-32.5 s). Cream paper with a faint dot grid and a fixed layout: one thread runs through six equal stations,
// every name set on one baseline under its bead. The thread starts dotted and ragged (information not yet understood), a gap opens in it
// at "Identifying the gap" and closes at "Deciding what to do", and it turns green at "Taking action". A thin arc returns from the last
// station to the first (review). Below, the Learn path is a second, centred thread of four beads. The AI line is drafted in pencil grey
// and inked as the reveal passes it (drafted by AI, finished by staff).
import { COL, THREE, perspective, pbr, project } from '../common.js'
import { text } from '../dom.js'

const INK = '#06182b'
const GREEN = '#4fb317'
const XS = [-8, -4.8, -1.6, 1.6, 4.8, 8]          // six equal stations, 3.2 units apart
const Z0 = -0.9, Z1 = 2.7                          // the two rows
const XL = [-4.8, -1.6, 1.6, 4.8]                  // the Learn path, centred
const wave = () => 0                              // one straight baseline: every station and every label sits on it

const threadMaterial = (len, gapAt, rawUntil, greenFrom) => new THREE.ShaderMaterial({
  transparent: true,
  uniforms: { uProg: { value: 0 }, uGap: { value: 1 }, uAlpha: { value: 1 }, uBlue: { value: new THREE.Color(COL.blue) }, uGreen: { value: new THREE.Color(GREEN) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `uniform float uProg; uniform float uGap; uniform float uAlpha; uniform vec3 uBlue; uniform vec3 uGreen; varying vec2 vUv;
    void main(){
      float u = vUv.x; if (u > uProg) discard;
      float raw = 1. - smoothstep(${(rawUntil - 0.12).toFixed(3)}, ${rawUntil.toFixed(3)}, u);      // ragged and dotted while the information is raw
      float dotted = step(mix(1.01, .5, raw), fract(u * ${len.toFixed(1)} + sin(u * 53.) * .3));
      if (dotted > .5) discard;
      if (${gapAt >= 0 ? 'abs(u - ' + gapAt.toFixed(3) + ') < .062 * uGap' : 'false'}) discard;                          // the gap
      float head = smoothstep(.03, 0., uProg - u);
      vec3 col = mix(uBlue, uGreen, smoothstep(${(greenFrom - 0.02).toFixed(3)}, ${(greenFrom + 0.02).toFixed(3)}, u));
      gl_FragColor = vec4(col * (1. + head * 1.6), uAlpha);
    }`,
})

const ringMaterial = (color) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { uProg: { value: 0 }, uColor: { value: new THREE.Color(color) }, uAlpha: { value: 1 } },
  vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `uniform float uProg; uniform vec3 uColor; uniform float uAlpha; varying vec2 vP;
    void main(){ float d = length(vP); float a = (atan(vP.y, vP.x) + 3.14159) / 6.28318; if (a > uProg) discard;
      float ring = 1. - smoothstep(.0, .024, abs(d - .52)); gl_FragColor = vec4(uColor, ring * uAlpha); }`,
})

const dotGrid = () => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { uOn: { value: 0 } },
  vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `uniform float uOn; varying vec2 vP;
    void main(){ vec2 g = vP / .8; vec2 f = fract(g) - .5; float d = length(f) * .8; float dot = 1. - smoothstep(.028, .045, d);
      float fade = 1. - smoothstep(9., 15., length(vP * vec2(.7, 1.))); gl_FragColor = vec4(.02, .09, .17, dot * .2 * fade * uOn); }`,
})

export async function make({ renderer, envs, beat }) {
  renderer.shadowMap.enabled = true
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#f1ebdc')
  scene.environment = envs.studio
  scene.environmentIntensity = 0.6
  const camera = perspective(9)

  const paper = await pbr('Paper001', { repeat: [10, 6], color: 0xfff6e2, roughness: 1 })
  paper.normalScale.set(0.22, 0.22); paper.color.setRGB(1.22, 1.18, 1.08)
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), paper)
  desk.rotation.x = -Math.PI / 2; desk.receiveShadow = true
  scene.add(desk)
  const dots = new THREE.Mesh(new THREE.PlaneGeometry(40, 26), dotGrid())
  dots.rotation.x = -Math.PI / 2; dots.position.y = 0.004
  scene.add(dots)
  const sun = new THREE.DirectionalLight(0xfff4e6, 2.2)
  sun.position.set(-9, 12, 8); sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -14; sun.shadow.camera.right = 14; sun.shadow.camera.top = 9; sun.shadow.camera.bottom = -9; sun.shadow.camera.far = 40; sun.shadow.radius = 5; sun.shadow.bias = -0.0004
  scene.add(sun)

  /* the main thread, its six beads and a ring round each */
  const mainPts = [new THREE.Vector3(-9, 0.05, Z0 + wave(0)), ...XS.map((x, i) => new THREE.Vector3(x, 0.05, Z0 + wave(i))), new THREE.Vector3(9, 0.05, Z0 + wave(5))]
  const main = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mainPts), 700, 0.05, 8, false), threadMaterial(190, 0.5, 0.36, 0.75))
  scene.add(main)
  const beadMat = (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.14, metalness: 0.15, clearcoat: 1, emissive: 0x000000 })
  const beads = XS.map((x, i) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.21, 48, 28), beadMat(0x0c2a4a))
    b.position.set(x, 0.21, Z0 + wave(i)); b.castShadow = true; scene.add(b)
    const ring = new THREE.Mesh(new THREE.CircleGeometry(0.7, 48), ringMaterial(i === 4 ? GREEN : COL.blue))
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.012, Z0 + wave(i)); scene.add(ring)
    return { b, ring }
  })
  /* the review arc: from the last station back to the first, over the top of the row */
  const arcCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(8, 0.05, Z0 - 0.5), new THREE.Vector3(5, 0.05, Z0 - 1.65), new THREE.Vector3(0, 0.05, Z0 - 2.05), new THREE.Vector3(-5, 0.05, Z0 - 1.65), new THREE.Vector3(-8, 0.05, Z0 - 0.5)])
  const arc = new THREE.Mesh(new THREE.TubeGeometry(arcCurve, 240, 0.022, 8, false), threadMaterial(120, -1, 0.0, 2.0))
  arc.material.uniforms.uBlue.value.set(COL.deep)
  scene.add(arc)

  /* the Learn path: a second, centred thread */
  const lPts = [new THREE.Vector3(-6.2, 0.05, Z1), ...XL.map((x) => new THREE.Vector3(x, 0.05, Z1)), new THREE.Vector3(6.2, 0.05, Z1)]
  const learn = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lPts), 300, 0.042, 8, false), threadMaterial(0.001, -1, 0.0, 0.77))
  scene.add(learn)
  const lbeads = XL.map((x, i) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.19, 48, 28), beadMat(i === 3 ? 0x3f9a0e : 0x1088f6))
    b.position.set(x, 0.19, Z1); b.castShadow = true; scene.add(b)
    const ring = new THREE.Mesh(new THREE.CircleGeometry(0.66, 48), ringMaterial(i === 3 ? GREEN : COL.blue))
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.012, Z1); scene.add(ring)
    return { b, ring }
  })

  /* type: all set in the DOM layer over the scene */
  const L = (r) => beat.lines.filter((l) => l.role === r).map((l) => l.text)
  const head = text(L('h')[0], { x: 120, y: 62, size: 104, weight: 300, color: INK, track: -0.03 })
  const lastW = head.querySelectorAll('.w'); const hl = lastW[lastW.length - 1]; hl.style.fontWeight = '800'; hl.style.color = COL.blue; hl.style.letterSpacing = '-0.045em'
  const mkLabel = (str, idx, { size = 25, w = 280 } = {}) => {
    const wrap = document.createElement('div')
    wrap.style.cssText = `position:absolute;left:0;top:0;width:${w}px;text-align:center;will-change:transform;`
    wrap.innerHTML = `<div class="in" style="opacity:0;will-change:transform,opacity;"><div style="font-size:16px;font-weight:800;letter-spacing:0.22em;color:${COL.blue};margin-bottom:8px">${idx}</div><div style="font-size:${size}px;font-weight:800;color:${INK};line-height:1.2">${str}</div></div>`
    document.getElementById('dom').appendChild(wrap)
    return { wrap, inner: wrap.firstChild }
  }
  const steps = L('step').map((s, i) => mkLabel(s, `0${i + 1}`))
  const paths = L('path').map((s, i) => mkLabel(s, `0${i + 1}`, { size: 24, w: 290 }))
  const ai = text(L('ai')[0], { x: 120, y: 884, size: 46, weight: 700, font: 'sans', color: INK, words: false })
  ai.style.opacity = '0'
  const aiInk = ai.cloneNode(true); aiInk.style.opacity = '0'; aiInk.style.clipPath = 'inset(0 100% 0 0)'
  ai.style.color = 'rgba(6,24,43,0.28)'
  document.getElementById('dom').appendChild(aiInk)

  const S = { cam: 0, dots: 0, prog: 0, gap: 1, arc: 0, lprog: 0, dim: 0, ai: 0 }
  const st = steps.map(() => ({ lit: 0, lab: 0 })), lp = paths.map(() => ({ lit: 0, lab: 0 }))
  const unlit = new THREE.Color(0x0c2a4a), blue = new THREE.Color(COL.blue), green = new THREE.Color(GREEN)

  return {
    scene, camera,
    frame() {
      const pitch = THREE.MathUtils.degToRad(60 - 2 * S.cam), D = 78 - 5 * S.cam
      camera.position.set(0, D * Math.sin(pitch), 0.9 + D * Math.cos(pitch))
      camera.lookAt(0, 0, 0.9)
      camera.updateMatrixWorld()
      dots.material.uniforms.uOn.value = S.dots
      main.material.uniforms.uProg.value = S.prog; main.material.uniforms.uGap.value = S.gap; main.material.uniforms.uAlpha.value = 1 - 0.68 * S.dim
      arc.material.uniforms.uProg.value = S.arc; arc.material.uniforms.uAlpha.value = 1 - 0.68 * S.dim
      learn.material.uniforms.uProg.value = S.lprog
      beads.forEach(({ b, ring }, i) => {
        const l = st[i].lit
        b.material.color.copy(unlit).lerp(i === 4 ? green : blue, l); b.material.emissive.copy(i === 4 ? green : blue).multiplyScalar(0.35 * l)
        b.visible = l > 0.001; b.scale.setScalar(0.4 + 0.6 * l)
        ring.material.uniforms.uProg.value = l; ring.material.uniforms.uAlpha.value = 1 - 0.68 * S.dim
        const p = project(new THREE.Vector3(XS[i], 0, Z0 + wave(i)), camera)
        steps[i].wrap.style.transform = `translate(${p.x - 140}px, ${p.y + 52}px)`
        steps[i].inner.style.opacity = String(st[i].lab * (1 - 0.68 * S.dim)); steps[i].inner.style.transform = `translateY(${(1 - st[i].lab) * 16}px)`
      })
      lbeads.forEach(({ b, ring }, i) => {
        const l = lp[i].lit
        b.visible = l > 0.001; b.scale.setScalar(0.4 + 0.6 * l); ring.material.uniforms.uProg.value = l
        const p = project(new THREE.Vector3(XL[i], 0, Z1), camera)
        paths[i].wrap.style.transform = `translate(${p.x - 145}px, ${p.y + 50}px)`
        paths[i].inner.style.opacity = String(lp[i].lab); paths[i].inner.style.transform = `translateY(${(1 - lp[i].lab) * 16}px)`
      })
      aiInk.style.clipPath = `inset(0 ${(1 - S.ai) * 100}% 0 0)`
    },
    build(tl) {
      tl.set(S, { cam: 0, dots: 0, prog: 0, gap: 1, arc: 0, lprog: 0, dim: 0, ai: 0 }, 0)
      tl.to(S, { cam: 1, duration: 7.6, ease: 'none' }, 25.0)
      tl.to(S, { dots: 1, duration: 0.8 }, 25.0)
      // the headline, with its last word in the heavy weight
      tl.set(head, { opacity: 1 }, 25.25)
      tl.fromTo([...head.querySelectorAll('.w')], { opacity: 0, filter: 'blur(7px)' }, { opacity: 1, filter: 'blur(0px)', duration: 0.32, stagger: 0.13, ease: 'power2.out' }, 25.25)
      // the thread runs through the six stations; each bead lights as it arrives
      tl.to(S, { prog: 1, duration: 3.6, ease: 'none' }, 25.5)
      const arrive = [25.75, 26.35, 26.95, 27.55, 28.25, 28.95]
      arrive.forEach((a, i) => {
        tl.to(st[i], { lit: 1, duration: 0.45, ease: 'back.out(2)' }, a)
        tl.to(st[i], { lab: 1, duration: 0.45, ease: 'power3.out' }, a + 0.12)
      })
      tl.to(S, { gap: 0, duration: 0.55, ease: 'power2.inOut' }, 27.5)       // the gap closes at "Deciding what to do"
      tl.to(S, { arc: 1, duration: 0.9, ease: 'power2.inOut' }, 29.1)           // review returns to the start
      // the Learn path: the main row steps back, a second thread draws in the centre
      tl.to(S, { dim: 1, duration: 0.5 }, 29.9)
      tl.to(S, { lprog: 1, duration: 1.3, ease: 'power2.inOut' }, 30.0)
      ;[30.2, 30.55, 30.9, 31.25].forEach((a, i) => {
        tl.to(lp[i], { lit: 1, duration: 0.4, ease: 'back.out(2)' }, a)
        tl.to(lp[i], { lab: 1, duration: 0.4, ease: 'power3.out' }, a + 0.1)
      })
      // AI: drafted in pencil grey, then inked
      tl.set(ai, { opacity: 1 }, 30.9)
      tl.fromTo(ai, { opacity: 0 }, { opacity: 1, duration: 0.4 }, 30.9)
      tl.set(aiInk, { opacity: 1 }, 31.2)
      tl.to(S, { ai: 1, duration: 1.0, ease: 'power1.inOut' }, 31.2)
      const out = [head, ai, aiInk, ...steps.map((s) => s.wrap), ...paths.map((s) => s.wrap)]
      for (const e of out) tl.to(e, { opacity: 0, duration: 0.2, ease: 'power3.in' }, 32.15)
    },
  }
}
