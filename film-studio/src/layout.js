// Fixed-layout helpers: the camera looks straight at a plane and one world unit is 100 stage pixels, so a design can be laid out in
// screen coordinates (1920 x 1080) and every column and baseline stays exact.
import { THREE, W, H } from './common.js'

export const PX = 100
export const wx = (px) => (px - W / 2) / PX
export const wy = (py) => (H / 2 - py) / PX

/** A camera on the z axis whose view of the z = 0 plane is exactly 100 px per unit (field of view 9 degrees: close to orthographic, a little depth). */
export function frontCamera(fov = 9) {
  const cam = new THREE.PerspectiveCamera(fov, W / H, 0.5, 400)
  const D = H / (2 * Math.tan(THREE.MathUtils.degToRad(fov / 2)) * PX)
  cam.position.set(0, 0, D); cam.lookAt(0, 0, 0); cam.updateMatrixWorld()
  cam.userData.D = D
  return cam
}

/** A positioned block of HTML in the DOM layer, in stage pixels, centred on x when `center` is set. Returns { wrap, inner }. */
export function block(html, { x, y, w, center = false, style = '' }) {
  const wrap = document.createElement('div')
  wrap.style.cssText = `position:absolute;left:${center ? x - w / 2 : x}px;top:${y}px;width:${w}px;${center ? 'text-align:center;' : ''}will-change:transform;${style}`
  const inner = document.createElement('div')
  inner.style.cssText = 'opacity:0;will-change:transform,opacity;'
  inner.innerHTML = html
  wrap.appendChild(inner)
  document.getElementById('dom').appendChild(wrap)
  return { wrap, inner }
}

/** GLSL: a ring of radius r drawn by angle up to uProg (additive on dark grounds, normal on light ones). */
export const ringFrag = (r, w = 0.026) => /* glsl */ `
  uniform float uProg; uniform vec3 uColor; uniform float uAlpha; varying vec2 vP;
  void main(){ float d = length(vP); float a = (atan(vP.y, vP.x) + 3.14159) / 6.28318; if (a > uProg) discard;
    float head = smoothstep(.05, 0., uProg - a) * step(uProg, .99);
    float ring = 1. - smoothstep(.0, ${w.toFixed(3)}, abs(d - ${r.toFixed(3)}));
    gl_FragColor = vec4(uColor * (1. + head * 2.), ring * uAlpha); }`

export const ringVert = 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }'

export function ringMaterial(r, color, { w = 0.026, additive = false } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { uProg: { value: 0 }, uColor: { value: new THREE.Color(color) }, uAlpha: { value: 1 } },
    vertexShader: ringVert, fragmentShader: ringFrag(r, w),
  })
}

/** A thread (tube) that draws from 0 to uProg along its length, with a bright head. */
export function threadMaterial(color) {
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uProg: { value: 0 }, uColor: { value: new THREE.Color(color) }, uAlpha: { value: 1 }, uPulse: { value: -1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform float uProg; uniform vec3 uColor; uniform float uAlpha; uniform float uPulse; varying vec2 vUv;
      void main(){ if (vUv.x > uProg) discard; float head = smoothstep(.04, 0., uProg - vUv.x) * step(uProg, .995);
        float pulse = smoothstep(.06, 0., abs(vUv.x - uPulse)) * step(0., uPulse);
        gl_FragColor = vec4(uColor * (1.1 + head * 2.2 + pulse * 2.5), uAlpha); }`,
  })
}

/** A faint dot grid on a plane facing the camera (colour and alpha as given). */
export function dotPlane(w, h, { color = [0.62, 0.82, 1.0], alpha = 0.2, spacing = 0.8, z = -1 } = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uOn: { value: 0 } },
    vertexShader: ringVert,
    fragmentShader: `uniform float uOn; varying vec2 vP;
      void main(){ vec2 g = vP / ${spacing.toFixed(2)}; vec2 f = fract(g) - .5; float d = length(f) * ${spacing.toFixed(2)}; float dot = 1. - smoothstep(.026, .042, d);
        float fade = 1. - smoothstep(10., 17., length(vP * vec2(.62, 1.))); gl_FragColor = vec4(${color.map((c) => c.toFixed(3)).join(',')}, dot * ${alpha.toFixed(3)} * fade * uOn); }`,
  }))
  m.position.z = z
  return m
}
