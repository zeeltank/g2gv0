// Beat 9, end card (51.5-59 s). Back on the dark desk the film opened on, now clear: one pool of light, the ScholarClone seal lands flat in it,
// the wordmark sets beside it, the approved invitation follows and the closing line is held for the last two seconds.
import { COL, THREE, loadTexture, pbr } from '../common.js'
import { text } from '../dom.js'
import { frontCamera, ringMaterial, wx, wy } from '../layout.js'

const SEAL = [520, 470]

export async function make({ renderer, envs, beat }) {
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#050d18')
  scene.environment = envs.dusk
  scene.environmentIntensity = 0.16
  const camera = frontCamera(9)

  const wood = await pbr('Wood095', { repeat: [4, 3], color: 0x34404f, roughness: 1 })
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(40, 26), wood); desk.position.z = -0.3; desk.receiveShadow = true; scene.add(desk)

  const spot = new THREE.SpotLight(0xfff1dc, 0, 60, 0.28, 0.9, 1.6)
  spot.position.set(wx(SEAL[0]) - 2, wy(SEAL[1]) + 3, 26); spot.target.position.set(wx(SEAL[0]) + 4, wy(SEAL[1]) - 0.4, 0)
  spot.castShadow = true; spot.shadow.mapSize.set(2048, 2048); spot.shadow.bias = -0.0004; spot.shadow.radius = 6
  scene.add(spot, spot.target)
  const rim = new THREE.DirectionalLight(0x6aaeff, 0.5); rim.position.set(7, 3, 6); scene.add(rim)
  scene.add(new THREE.AmbientLight(0x20406e, 0.3))

  /* the seal, lying flat on the desk */
  const logoTex = await loadTexture('/photos/brand/logo-ring.png')
  const coin = new THREE.Group()
  const body = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.16, 120), new THREE.MeshStandardMaterial({ color: 0xf3eee3, roughness: 0.4, metalness: 0.12 }))
  body.rotation.x = Math.PI / 2
  const face = new THREE.Mesh(new THREE.CircleGeometry(2.18, 100), new THREE.MeshStandardMaterial({ map: logoTex, roughness: 0.6, transparent: true }))
  face.position.z = 0.085
  coin.add(body, face)
  coin.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
  coin.position.set(wx(SEAL[0]), wy(SEAL[1]), 0.08)
  scene.add(coin)
  const ring = new THREE.Mesh(new THREE.CircleGeometry(3.2, 120), ringMaterial(2.78, COL.sky, { additive: true, w: 0.03 }))
  ring.position.set(wx(SEAL[0]), wy(SEAL[1]), -0.2); scene.add(ring)

  /* type */
  const L = (r) => beat.lines.find((l) => l.role === r).text
  const word = text(L('brand'), { x: 880, y: 300, size: 150, weight: 300, color: '#fff', track: -0.035, letters: true })
  ;[...word.querySelectorAll('.w')].forEach((s, i) => { if (i >= 7) { s.style.fontWeight = '800'; s.style.color = COL.sky } })
  const invite = text(L('invite'), { x: 880, y: 510, size: 54, weight: 300, color: '#eaf2fb', track: -0.02, wrap: true, w: 900, lh: 1.12 })
  const close = text(L('close').toUpperCase(), { x: 884, y: 790, size: 28, weight: 800, font: 'sans', color: COL.sky, track: 0.16, words: false })

  const S = { spot: 0, ring: 0, land: 0 }

  return {
    scene, camera,
    frame(t) {
      camera.lookAt(0, 0, 0); camera.updateMatrixWorld()
      spot.intensity = 520 * S.spot
      const l = S.land
      coin.visible = l > 0.002
      coin.position.z = 0.08 + (1 - l) * 6
      coin.rotation.set(0.5 * (1 - l), -0.4 * (1 - l), 0.6 * (1 - l))
      ring.material.uniforms.uProg.value = S.ring
    },
    build(tl) {
      tl.set(S, { spot: 0, ring: 0, land: 0 }, 0)
      tl.to(S, { spot: 1, duration: 1.0, ease: 'power2.out' }, 51.3)
      tl.to(S, { land: 1, duration: 0.85, ease: 'bounce.out' }, 52.0)
      tl.to(S, { ring: 1, duration: 1.0, ease: 'power2.inOut' }, 52.9)
      tl.set(word, { opacity: 1 }, 52.6)
      tl.fromTo([...word.querySelectorAll('.w')], { opacity: 0, y: 34, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.5, stagger: 0.05, ease: 'power3.out' }, 52.6)
      tl.set(invite, { opacity: 1 }, 55.0)
      tl.fromTo([...invite.querySelectorAll('.w')], { opacity: 0, filter: 'blur(7px)' }, { opacity: 1, filter: 'blur(0px)', duration: 0.34, stagger: 0.12, ease: 'power2.out' }, 55.0)
      tl.fromTo(close, { opacity: 0 }, { opacity: 1, duration: 0.6 }, 57.3)
    },
  }
}
