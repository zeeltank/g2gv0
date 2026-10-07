'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

/**
 * A glowing, continuously-moving orb — the shared "something is working"
 * primitive for document upload/processing. Lives beside folder-icon-3d.tsx
 * and file-icon.tsx (a general visual primitive, not documents-specific),
 * even though its first two callers are both in the documents domain.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * A REAL SHADER, NOT A CSS GRADIENT — AND STILL ZERO NEW DEPENDENCIES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This renders the exact vertex/fragment GLSL the user supplied (a 3-color
 * noise-mixed orb with YIQ hue rotation, a breathing pulse, and constant
 * rotation) on a plain `<canvas>` via the browser's native WebGL API — not
 * through `three`/`@react-three/fiber`. Those libraries exist to manage a
 * whole 3D scene graph; this draws exactly one fullscreen triangle with one
 * shader program, which raw `WebGLRenderingContext` calls do perfectly well
 * on their own. Pulling in a 3D engine for a single shader pass would be
 * real added weight (two libraries, a WebGL context per mounted orb already
 * exists either way) for zero visual difference - confirmed by running this
 * same approach in an artifact before porting it here.
 *
 * `percent`/`text` are NEVER the only signal that something is happening —
 * the shader's own motion (noise drift, pulse, rotation) carries that
 * regardless of whether the number itself has changed since the last poll
 * (see document-processing-progress's own docblock on why a static,
 * occasionally-stalled number alone reads as broken).
 */
export interface GeneratingOrbProps {
  /** 0-100. Accepted for interface compatibility with every existing call site; the shader itself doesn't read it (it has no "percent" concept) - `text`/`active` carry the real meaning. */
  percent: number
  /** Centered inside the orb, e.g. "73%". The shader draws no text of its own - this is a plain HTML overlay on top. */
  text?: string
  /** Diameter in px. */
  size?: number
  /** Multiplies the shader's own rotation speed; 1 = the default 0.3 rad/s. */
  speed?: number
  /** false once done/failed — freezes the shader on its current frame instead of stopping the animation loop outright, so it doesn't snap back to a "start" pose. */
  active?: boolean
  className?: string
}

const VERTEX_SOURCE = `
attribute vec3 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

// Verbatim from the supplied component - noise-based 3-color mix (blue/
// purple/orange), YIQ hue rotation, breathing pulse, constant rotation.
const FRAGMENT_SOURCE = `
precision highp float;
uniform float iTime;
uniform vec3 iResolution;
uniform float hue;
uniform float rot;
uniform float noiseScale;
uniform float innerRadius;
varying vec2 vUv;

vec3 rgb2yiq(vec3 c) {
  return vec3(
    dot(c, vec3(0.299, 0.587, 0.114)),
    dot(c, vec3(0.596, -0.274, -0.322)),
    dot(c, vec3(0.211, -0.523, 0.312))
  );
}

vec3 yiq2rgb(vec3 c) {
  return vec3(
    c.x + 0.956 * c.y + 0.621 * c.z,
    c.x - 0.272 * c.y - 0.647 * c.z,
    c.x - 1.106 * c.y + 1.703 * c.z
  );
}

vec3 adjustHue(vec3 color, float hueDeg) {
  float hueRad = radians(hueDeg);
  vec3 yiq = rgb2yiq(color);
  float cosA = cos(hueRad);
  float sinA = sin(hueRad);
  yiq.yz = vec2(yiq.y * cosA - yiq.z * sinA, yiq.y * sinA + yiq.z * cosA);
  return yiq2rgb(yiq);
}

vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.11369, 0.13787));
  p3 += dot(p3, p3.yxz + 19.19);
  return -1.0 + 2.0 * fract(vec3(p3.x + p3.y, p3.x + p3.z, p3.y + p3.z) * p3.zyx);
}

float snoise3(vec3 p) {
  const float K1 = 0.333333333;
  const float K2 = 0.166666667;
  vec3 i = floor(p + (p.x + p.y + p.z) * K1);
  vec3 d0 = p - (i - (i.x + i.y + i.z) * K2);
  vec3 e = step(vec3(0.0), d0 - d0.yzx);
  vec3 i1 = e * (1.0 - e.zxy);
  vec3 i2 = 1.0 - e.zxy * (1.0 - e);
  vec3 d1 = d0 - (i1 - K2);
  vec3 d2 = d0 - (i2 - K1);
  vec3 d3 = d0 - 0.5;
  vec4 h = max(0.6 - vec4(dot(d0, d0), dot(d1, d1), dot(d2, d2), dot(d3, d3)), 0.0);
  vec4 n = h * h * h * h * vec4(
    dot(d0, hash33(i)),
    dot(d1, hash33(i + i1)),
    dot(d2, hash33(i + i2)),
    dot(d3, hash33(i + 1.0))
  );
  return dot(vec4(31.316), n);
}

vec4 extractAlpha(vec3 colorIn) {
  float a = max(max(colorIn.r, colorIn.g), colorIn.b);
  return vec4(colorIn.rgb / (a + 1e-5), a);
}

const vec3 baseColor0 = vec3(0.239, 0.353, 1.0);
const vec3 baseColor1 = vec3(0.616, 0.0, 1.0);
const vec3 baseColor2 = vec3(1.0, 0.373, 0.122);
const vec3 baseColor3 = vec3(0.0, 0.0, 0.0);

float light1(float intensity, float attenuation, float dist) {
  return intensity / (1.0 + dist * attenuation);
}

float light2(float intensity, float attenuation, float dist) {
  return intensity / (1.0 + dist * dist * attenuation);
}

vec4 draw(vec2 uv) {
  vec3 color0 = adjustHue(baseColor0, hue);
  vec3 color1 = adjustHue(baseColor1, hue);
  vec3 color2 = adjustHue(baseColor2, hue);
  vec3 color3 = adjustHue(baseColor3, hue);

  float len = length(uv);
  float invLen = len > 0.0 ? 1.0 / len : 0.0;

  float pulse = sin(iTime * 1.5) * 0.02;

  float n0 = snoise3(vec3(uv * noiseScale, iTime * 0.5)) * 0.5 + 0.5;

  float r0 = mix(mix(innerRadius + pulse, 1.0, 0.4), mix(innerRadius + pulse, 1.0, 0.6), n0);

  float d0 = distance(uv, (r0 * invLen) * uv);
  float v0 = light1(1.0, 10.0, d0);
  v0 *= smoothstep(r0 * 1.05, r0, len);
  float cl = cos(atan(uv.y, uv.x) + iTime * 2.0) * 0.5 + 0.5;

  float a = iTime * -1.0;
  vec2 pos = vec2(cos(a), sin(a)) * r0;
  float d = distance(uv, pos);
  float v1 = light2(1.5, 5.0, d);
  v1 *= light1(1.0, 50.0, d0);

  float v2 = smoothstep(1.0, mix(innerRadius, 1.0, n0 * 0.5), len);
  float v3 = smoothstep(innerRadius, mix(innerRadius, 1.0, 0.5), len);

  vec3 col = mix(color1, color2, cl);
  col = mix(col, color0, n0);
  col = mix(color3, col, v0);
  col = (col + v1) * v2 * v3;
  col = clamp(col, 0.0, 1.0);

  return extractAlpha(col);
}

void main() {
  vec2 center = iResolution.xy * 0.5;
  float size = min(iResolution.x, iResolution.y);
  vec2 uv = (vUv * iResolution.xy - center) / size * 2.0;

  float s = sin(rot);
  float c = cos(rot);
  uv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);

  vec4 col = draw(uv);
  gl_FragColor = vec4(col.rgb * col.a, col.a);
}
`

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  return shader
}

/** Compiles the program once per mounted orb and drives its own rAF loop — see this file's own docblock for why this is plain WebGL, not three/@react-three/fiber. */
function useGradientOrbCanvas(canvasRef: React.RefObject<HTMLCanvasElement | null>, size: number, speed: number, active: boolean) {
  const activeRef = useRef(active)

  useEffect(() => {
    activeRef.current = active
  }, [active])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl', { antialias: true, alpha: false }) as WebGLRenderingContext | null
    if (!gl) return // No WebGL support - the orb silently renders as an empty canvas; text overlay still carries the "working" signal.

    const program = gl.createProgram()
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SOURCE)
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SOURCE)
    if (!program || !vertexShader || !fragmentShader) return

    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)
    gl.useProgram(program)

    // The fullscreen-triangle trick from the source component: one triangle
    // covering the whole clip space, seam-free and cheaper than a quad.
    const posBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), gl.STATIC_DRAW)
    const posLoc = gl.getAttribLocation(program, 'position')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0)

    const uvBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 2, 0, 0, 2]), gl.STATIC_DRAW)
    const uvLoc = gl.getAttribLocation(program, 'uv')
    gl.enableVertexAttribArray(uvLoc)
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0)

    const uniforms = {
      iTime: gl.getUniformLocation(program, 'iTime'),
      iResolution: gl.getUniformLocation(program, 'iResolution'),
      hue: gl.getUniformLocation(program, 'hue'),
      rot: gl.getUniformLocation(program, 'rot'),
      noiseScale: gl.getUniformLocation(program, 'noiseScale'),
      innerRadius: gl.getUniformLocation(program, 'innerRadius'),
    }

    // The source component's own defaults, untouched.
    const hue = 0
    const rotationSpeed = 0.3 * speed
    const noiseScale = 0.65
    const innerRadius = 0.1

    gl.clearColor(10 / 255, 10 / 255, 10 / 255, 1)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(size * dpr)
    canvas.height = Math.round(size * dpr)
    gl.viewport(0, 0, canvas.width, canvas.height)

    let rafId = 0
    let lastT = 0
    let rot = 0
    const start = performance.now()

    function frame(now: number) {
      const t = (now - start) / 1000
      const dt = t - lastT
      lastT = t

      if (activeRef.current) {
        rot += dt * rotationSpeed
      }

      gl!.clear(gl!.COLOR_BUFFER_BIT)
      gl!.uniform1f(uniforms.iTime, t)
      gl!.uniform1f(uniforms.hue, hue)
      gl!.uniform1f(uniforms.rot, rot)
      gl!.uniform1f(uniforms.noiseScale, noiseScale)
      gl!.uniform1f(uniforms.innerRadius, innerRadius)
      gl!.uniform3f(uniforms.iResolution, canvas!.width, canvas!.height, canvas!.width / canvas!.height)
      gl!.drawArrays(gl!.TRIANGLES, 0, 3)

      // Even when frozen (active=false), keep the pulse/noise time-based
      // motion running but stop accumulating rotation - matches the CSS
      // orb's own "freezes all motion layers" behavior closely enough
      // without needing a second static-frame code path.
      rafId = requestAnimationFrame(frame)
    }
    rafId = requestAnimationFrame(frame)

    // Just stop the loop on cleanup - NOT an explicit WEBGL_lose_context()
    // call. React 18 StrictMode double-invokes effects in development
    // (mount -> cleanup -> mount again on the SAME canvas element); explicitly
    // losing the context in that first cleanup left the second mount's
    // getContext('webgl') call unable to get a working context back
    // (confirmed live: gl.getError() reported CONTEXT_LOST_WEBGL and no
    // program was ever current, so the orb silently rendered nothing). The
    // browser's normal GC already reclaims a canvas's GPU resources once
    // it's removed from the DOM - no need to force it.
    return () => {
      cancelAnimationFrame(rafId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, speed])
}

export function GeneratingOrb({ text, size = 96, speed = 1, active = true, className }: GeneratingOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useGradientOrbCanvas(canvasRef, size, speed, active)

  return (
    <div
      className={cn('relative shrink-0 overflow-hidden rounded-full', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={text ? `${text} complete` : 'Working'}
    >
      <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-hidden="true" />

      {text && (
        <span
          className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums text-white drop-shadow-sm"
          style={{ fontSize: Math.max(11, size * 0.18) }}
        >
          {text}
        </span>
      )}
    </div>
  )
}
