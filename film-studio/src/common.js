// Shared helpers of the film studio: colours, loaders, canvas text textures, projection to the DOM layer, small GLSL chunks.
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'

export const COL = { ink: '#06182b', deep: '#0a3c73', cream: '#f3eee3', blue: '#1088f6', sky: '#9fd0ff', green: '#74cd23', paper: '#fffdf6' }
export const W = 1920
export const H = 1080

const gltfLoader = new GLTFLoader()
const texLoader = new THREE.TextureLoader()

/** A real downloaded model, centred on the origin and scaled so its longest side is `size`. userData.nodes lists every named node. */
export async function loadModel(id, size = 1) {
  const g = await gltfLoader.loadAsync(`/assets/models/${id}/${id}_1k.gltf`)
  const root = g.scene
  const box = new THREE.Box3().setFromObject(root)
  const s = box.getSize(new THREE.Vector3())
  const c = box.getCenter(new THREE.Vector3())
  const k = size / Math.max(s.x, s.y, s.z)
  const holder = new THREE.Group()
  root.position.copy(c).negate()
  holder.add(root)
  holder.scale.setScalar(k)
  const nodes = {}
  root.traverse((o) => { if (o.name) nodes[o.name] = o })
  holder.userData = { nodes, size: s.multiplyScalar(k), root }
  holder.updateMatrixWorld(true) // so Box3.setFromObject on its parts is measured in the scaled, centred model space
  return holder
}

export async function loadTexture(url, { srgb = true, repeat = null, aniso = 8 } = {}) {
  const t = await texLoader.loadAsync(url)
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.anisotropy = aniso
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]) }
  return t
}

/** The three maps of an ambientCG texture folder as a MeshStandardMaterial. */
export async function pbr(name, { repeat = [1, 1], color = 0xffffff, metalness = 0, roughness = 1 } = {}) {
  const base = `/assets/textures/${name}/${name}_1K-JPG`
  const [map, normalMap, roughnessMap] = await Promise.all([loadTexture(`${base}_Color.jpg`, { repeat }), loadTexture(`${base}_NormalGL.jpg`, { srgb: false, repeat }), loadTexture(`${base}_Roughness.jpg`, { srgb: false, repeat })])
  return new THREE.MeshStandardMaterial({ map, normalMap, roughnessMap, color, metalness, roughness })
}

export async function loadEnv(renderer, name) {
  const hdr = await new HDRLoader().loadAsync(`/assets/hdri/${name}_1k.hdr`)
  hdr.mapping = THREE.EquirectangularReflectionMapping
  const pm = new THREE.PMREMGenerator(renderer)
  const env = pm.fromEquirectangular(hdr).texture
  pm.dispose(); hdr.dispose()
  return env
}

/** Text drawn on a canvas (after the fonts are loaded) as a texture, for paper labels and similar. */
export function textTexture(lines, { w = 1024, h = 256, font = '800 84px Manrope', color = '#0c2a4a', bg = null, align = 'left', x = 48, lineH = 100 } = {}) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h
  const g = cv.getContext('2d')
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h) }
  g.font = font; g.fillStyle = color; g.textBaseline = 'middle'; g.textAlign = align
  const arr = Array.isArray(lines) ? lines : [lines]
  arr.forEach((t, i) => g.fillText(t, align === 'center' ? w / 2 : x, h / 2 + (i - (arr.length - 1) / 2) * lineH))
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8
  return t
}

/** Screen position (in 1920 x 1080 pixels) of a 3D point, for the DOM layer. */
export function project(v3, camera) {
  const p = v3.clone().project(camera)
  return { x: (p.x * 0.5 + 0.5) * W, y: (-p.y * 0.5 + 0.5) * H, z: p.z }
}

/** Pixel radius on screen of a world-space radius at a point (perspective camera). */
export function projectRadius(center, r, camera) {
  const a = project(center, camera)
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(r)
  const b = project(center.clone().add(right), camera)
  return Math.hypot(b.x - a.x, b.y - a.y)
}

export const clamp01 = (x) => Math.min(1, Math.max(0, x))
export const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x) }
export const lerp = (a, b, t) => a + (b - a) * t

/** GLSL: 8x8 ordered (Bayer) dither threshold in 0..1 for a pixel coordinate. */
export const BAYER = /* glsl */ `
float bayer2(vec2 a){ a = floor(a); return fract(a.x / 2. + a.y * a.y * .75); }
float bayer4(vec2 a){ return bayer2(.5 * a) * .25 + bayer2(a); }
float bayer8(vec2 a){ return bayer4(.5 * a) * .25 + bayer2(a); }
`

export function perspective(fov = 35) { return new THREE.PerspectiveCamera(fov, W / H, 0.05, 200) }

export { THREE }
