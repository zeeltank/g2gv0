// Beat 1, hook (0-4 s). A real reading-glass (Poly Haven magnifying_glass_01, CC0) glides over a school photograph that is "unseen" (a 1-bit
// ordered dither in ink and deep blue) outside the glass and resolved inside it. The question is legible only inside the lens.
// The glass then dives forward: its circle grows to fill the frame and the next beat shows through it (iris).
import { gsap } from 'gsap'
import { COL, H, THREE, BAYER, W, loadModel, loadTexture, perspective, project, projectRadius } from '../common.js'
import { text } from '../dom.js'

export async function make({ renderer, envs, beat }) {
  const scene = new THREE.Scene()
  scene.environment = envs.studio
  scene.environmentIntensity = 0.9
  const camera = perspective(35)
  camera.position.set(0, 0, 6)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()

  /* the photograph as a plane that covers the view, with the lens in screen space */
  const photo = await loadTexture('/photos/images/img-hook.webp')
  const dist = 6
  const vh = 2 * dist * Math.tan(THREE.MathUtils.degToRad(17.5))
  const pw = vh * (16 / 9) * 1.04
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(pw, pw / (photo.image.width / photo.image.height)), new THREE.ShaderMaterial({
    uniforms: { tPhoto: { value: photo }, uLens: { value: new THREE.Vector3(960, 540, 400) }, uInk: { value: new THREE.Color(COL.ink) }, uDeep: { value: new THREE.Color('#0d4a8f') }, uCream: { value: new THREE.Color(COL.cream) }, uRes: { value: new THREE.Vector2(W, H) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `${BAYER}
      uniform sampler2D tPhoto; uniform vec3 uLens; uniform vec3 uInk; uniform vec3 uDeep; uniform vec3 uCream; uniform vec2 uRes; varying vec2 vUv;
      void main(){
        vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
        float d = length(px - uLens.xy); float R = uLens.z;
        vec3 ph = texture2D(tPhoto, vUv).rgb;
        float lum = dot(ph, vec3(.299, .587, .114));
        // unseen: ordered dither of the photograph in two dark tones, a faint ghost of it
        float dots = step(bayer8(gl_FragCoord.xy), pow(lum, .8) * .55);
        vec3 unseen = mix(uInk, uDeep, dots);
        // seen: the photograph, magnified a little about the lens centre, shaded so type reads on it
        vec2 c = vec2(.5) + (vUv - .5);
        vec2 uvM = (vUv - .5) * (1. - .14 * smoothstep(R, 0., d)) + .5;
        vec3 seen = texture2D(tPhoto, uvM).rgb * (.62 + .22 * smoothstep(R * .2, R, d));
        float inside = 1. - smoothstep(R - 2., R + 1., d);
        vec3 col = mix(unseen, seen, inside);
        // the edge of the glass: a thin bright rim and a soft shadow outside it
        col += (1. - smoothstep(0., 5., abs(d - R))) * vec3(.9, .95, 1.) * .55;
        col *= 1. - .35 * smoothstep(R, R + 60., d) * (1. - smoothstep(R + 60., R + 200., d));
        gl_FragColor = vec4(col, 1.);
      }`,
  }))
  pl.position.z = 0
  scene.add(pl)

  /* the real magnifier, its lens aligned to the shader circle */
  const model = await loadModel('magnifying_glass_01', 1)
  let lensMesh = null
  model.userData.root.traverse((o) => { if (o.isMesh && o.material && o.material.transmission > 0) lensMesh = o })
  const lb = new THREE.Box3().setFromObject(lensMesh)
  const lensC = lb.getCenter(new THREE.Vector3())
  const lensRad = (lb.max.x - lb.min.x) / 2
  lensMesh.material = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, roughness: 0.04, metalness: 0, envMapIntensity: 1.5, side: THREE.DoubleSide })
  const pivot = new THREE.Group()
  model.position.copy(lensC).negate()
  pivot.add(model)
  scene.add(pivot)
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-3, 4, 5); scene.add(key)

  /* animated state: the lens in screen pixels */
  const S = { lx: -400, ly: 980, lr: 340, rot: -0.5, zoom: 1 }
  const zPlane = 0.6
  const wpp = (2 * (dist - zPlane) * Math.tan(THREE.MathUtils.degToRad(17.5))) / H

  /* the type, clipped to the lens */
  const wrap = document.createElement('div')
  wrap.style.cssText = 'position:absolute;left:0;top:0;width:1920px;height:1080px;'
  document.getElementById('dom').appendChild(wrap)
  const words = beat.lines[0].text.split(' ')
  const l1 = text(words.slice(0, 4).join(' '), { cx: 960, w: 1700, y: 330, size: 156, weight: 300, color: COL.cream, align: 'center', words: false }, wrap)
  const l2 = text(words.slice(4).join(' '), { cx: 960, w: 1700, y: 505, size: 196, weight: 800, color: COL.sky, align: 'center', track: -0.04, words: false }, wrap)
  for (const e of [l1, l2]) { e.style.opacity = '1'; e.style.textShadow = '0 6px 30px rgba(2,8,15,.55)' }

  return {
    scene, camera,
    frame() {
      const wx = (S.lx - W / 2) * wpp, wy = -(S.ly - H / 2) * wpp
      pivot.position.set(wx, wy, zPlane)
      pivot.rotation.set(0, 0, S.rot)
      pivot.scale.setScalar((S.lr * wpp) / lensRad)
      pl.material.uniforms.uLens.value.set(S.lx, S.ly, S.lr)
      wrap.style.clipPath = `circle(${Math.max(1, S.lr - 4)}px at ${S.lx}px ${S.ly}px)`
      wrap.style.transform = `scale(${S.zoom})`
      wrap.style.transformOrigin = `${S.lx}px ${S.ly}px`
      camera.position.z = 6 - 0.25 * Math.min(1, 0)
    },
    seam() { return { x: S.lx / W, y: 1 - S.ly / H, rx: S.lr / H } },
    build(tl) {
      tl.set(S, { lx: -400, ly: 980, lr: 340, rot: -0.5, zoom: 1 }, 0)
      tl.to(S, { lx: 560, ly: 600, lr: 420, rot: -0.38, duration: 1.0, ease: 'power3.out' }, 0.15)
      tl.to(S, { lx: 1000, ly: 540, lr: 520, rot: -0.28, duration: 1.8, ease: 'sine.inOut' }, 1.1)
      tl.to(S, { ly: 500, rot: -0.22, duration: 0.9, ease: 'sine.inOut' }, 2.2)
      tl.to(S, { lx: 960, ly: 540, lr: 1650, rot: -0.1, zoom: 1.45, duration: 0.95, ease: 'power3.in' }, 3.1)
      tl.to(wrap, { opacity: 0, duration: 0.3, ease: 'power2.in' }, 3.75)   // the type leaves with the lens; the clip circle stays huge afterwards
    },
  }
}
