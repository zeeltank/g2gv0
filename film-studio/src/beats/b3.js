// Beat 3, reveal (10.5-18.5 s). The seen world is cream paper under soft studio light. A real brushed-metal ring (Metal032, CC0) floats
// above the paper and casts a shadow; the ScholarClone seal sits in it. The approved sentence lands as type, with the first green
// stroke under "take meaningful action". At the end the ring swells until the camera passes through it into the next scene.
import { gsap } from 'gsap'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin.js'
import { COL, H, THREE, W, loadTexture, perspective, pbr } from '../common.js'
import { text, textOut, wordsIn } from '../dom.js'
gsap.registerPlugin(DrawSVGPlugin)

export async function make({ renderer, envs, beat }) {
  renderer.shadowMap.enabled = true
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(COL.cream)
  scene.environment = envs.studio
  scene.environmentIntensity = 1.1
  const camera = perspective(35)
  camera.position.set(0, 0, 6); camera.lookAt(0, 0, 0)
  const wpp = (2 * 6 * Math.tan(THREE.MathUtils.degToRad(17.5))) / H

  const paper = await pbr('Paper001', { repeat: [3, 2], color: 0xf4eee0, roughness: 1 })
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(18, 10.2), paper)
  bg.position.z = -1.3; bg.receiveShadow = true
  scene.add(bg)

  const metal = await pbr('Metal032', { repeat: [8, 1], metalness: 1, roughness: 0.55, color: 0xdfe6ee })
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.055, 64, 220), metal)
  ring.castShadow = true
  const logoTex = await loadTexture('/photos/brand/logo-ring.png')
  const logo = new THREE.Mesh(new THREE.CircleGeometry(0.93, 80), new THREE.MeshStandardMaterial({ map: logoTex, roughness: 0.7, transparent: true }))
  logo.position.z = 0.012
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.95, 80), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }))
  disc.position.z = 0.006; disc.castShadow = true
  const g = new THREE.Group(); g.add(ring, disc, logo); scene.add(g)
  const key = new THREE.DirectionalLight(0xfff3e2, 2.6)
  key.position.set(-3.5, 4, 5.5); key.castShadow = true
  key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -6; key.shadow.camera.right = 6; key.shadow.camera.top = 4; key.shadow.camera.bottom = -4; key.shadow.camera.far = 16; key.shadow.radius = 7; key.shadow.bias = -0.0008
  scene.add(key)

  /* type: the wordmark (letters), then the four chunks of the approved sentence with strokes under three of them */
  const L = (r) => beat.lines.find((l) => l.role === r).text
  const word = text(L('brand'), { x: 290, y: 84, size: 56, weight: 800, color: COL.ink, track: -0.03, letters: true })
  word.style.transformOrigin = '0 0'
  const c = [
    text(L('c1'), { x: 300, y: 392, size: 58, weight: 300, color: COL.ink, track: -0.02 }),
    text(L('c2'), { x: 300, y: 474, size: 104, weight: 800, color: COL.blue, track: -0.04 }),
    text(L('c3'), { x: 300, y: 596, size: 104, weight: 800, color: COL.ink, track: -0.04 }),
    text(L('c4'), { x: 300, y: 718, size: 104, weight: 800, color: '#3f8a0b', track: -0.04 }),
  ]
  const underline = (el, color, y) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('width', '1400'); svg.setAttribute('height', '30'); svg.style.cssText = `position:absolute;left:${el.offsetLeft}px;top:${el.offsetTop + y}px;overflow:visible;`
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    p.setAttribute('d', `M2 14 C ${el.offsetWidth * 0.3} 4, ${el.offsetWidth * 0.62} 24, ${el.offsetWidth - 4} 12`); p.setAttribute('fill', 'none'); p.setAttribute('stroke', color); p.setAttribute('stroke-width', '9'); p.setAttribute('stroke-linecap', 'round')
    svg.appendChild(p); document.getElementById('dom').appendChild(svg)
    return p
  }
  const u2 = underline(c[1], COL.blue, 112), u3 = underline(c[2], COL.blue, 112), u4 = underline(c[3], COL.green, 112)

  const S = { px: 560, py: 700, pr: 600, ry: 0 }
  return {
    scene, camera,
    frame() {
      g.position.set((S.px - W / 2) * wpp, -(S.py - H / 2) * wpp, 0)
      g.scale.setScalar(S.pr * wpp)
      g.rotation.y = S.ry
    },
    seam() { return { x: S.px / W, y: 1 - S.py / H } },
    build(tl) {
      tl.set(S, { px: 560, py: 700, pr: 600, ry: 0 }, 0)
      tl.to(S, { px: 960, py: 430, pr: 235, duration: 1.2, ease: 'power3.inOut' }, 10.7)
      tl.to(S, { ry: 0.5, duration: 2.0, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 11.4)
      // the wordmark, large under the ring, then both settle to the top left
      const bigScale = 2.35, w = word.offsetWidth
      tl.set(word, { opacity: 1, x: 960 - (w * bigScale) / 2 - 290, y: 690 - 84, scale: bigScale }, 10.5)
      tl.fromTo(word.querySelectorAll('.w'), { opacity: 0.2, filter: 'blur(7px)', y: 22 }, { opacity: 1, filter: 'blur(0px)', y: 0, duration: 0.3, stagger: 0.055, ease: 'power3.out' }, 11.7)
      tl.to(S, { px: 190, py: 128, pr: 74, duration: 0.8, ease: 'power3.inOut' }, 12.9)
      tl.to(word, { x: 0, y: 0, scale: 1, duration: 0.8, ease: 'power3.inOut' }, 12.9)
      wordsIn(tl, c[0], 13.5, { step: 0.1 })
      wordsIn(tl, c[1], 14.9, { step: 0.12 }); wordsIn(tl, c[2], 15.7, { step: 0.12 }); wordsIn(tl, c[3], 16.6, { step: 0.12 })
      for (const [u, at] of [[u2, 15.6], [u3, 16.4], [u4, 17.4]]) tl.fromTo(u, { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: 0.6, ease: 'power2.inOut' }, at)
      for (const e of [...c, word]) textOut(tl, e, 17.55)
      for (const u of [u2, u3, u4]) tl.to(u, { opacity: 0, duration: 0.2 }, 17.55)
      // object becomes world: the ring swells until the camera is through it
      tl.to(S, { pr: 2600, px: 190, py: 128, duration: 0.8, ease: 'power3.in' }, 17.8)
    },
  }
}
