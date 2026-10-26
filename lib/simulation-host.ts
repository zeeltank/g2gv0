/**
 * How this page talks to the Simulation Runtime that plays a simulation inside an iframe.
 *
 * The runtime is a separate, generic page (the `g2g-sim-runtime` build served from /sim-runtime/) that plays whatever `g2g.sim/1`
 * specification it is handed. It is embedded in a sandboxed frame WITHOUT `allow-same-origin`, so it runs on an opaque origin: it cannot read
 * this page's localStorage (where the login token lives), its cookies or its DOM, and it has no credentials of its own. The only thing that
 * crosses is a message, and each side checks it:
 *
 *   runtime -> host   { src: 'g2g-course', lesson, type: 'ready' }                                      listening, send me the specification
 *                     { src: 'g2g-course', lesson, type: 'spec', ok, issues[] }                          the verdict on a specification I was sent
 *                     { src: 'g2g-course', lesson, type: 'progress' | 'completed', step, percent, snapshot? }
 *                     { src: 'g2g-course', lesson, type: 'event', name, seq, payload, ts }               (not stored yet)
 *   host -> runtime   { src: 'g2g-host', type: 'init', spec, resume? }                                   play this
 *                     { src: 'g2g-host', type: 'pause' | 'resume' }
 *
 * AUTHENTICATING A MESSAGE. A sandboxed frame's origin is "null", so the origin cannot tell one frame from another; the host therefore accepts
 * a message only when `event.source` is the very window of the iframe IT created, and only when it carries the lesson id it asked for. The
 * host's messages go to the frame with target origin "*" because an opaque origin cannot be named - safe here because the window is a reference
 * to our own frame and what is sent is the simulation specification the person is about to play, never a token. The runtime, in turn, is told
 * this page's origin (`from=`) and posts only to it.
 */

export const SIM_RUNTIME_URL = process.env.NEXT_PUBLIC_SIM_RUNTIME_URL || '/sim-runtime/index.html'

/** Sandbox flags for the frame. No `allow-same-origin`, no top navigation, no forms; popups only so a model-credit link can open. */
export const SIM_FRAME_SANDBOX = 'allow-scripts allow-popups allow-popups-to-escape-sandbox'

export type RuntimeMessage =
  | { type: 'ready' }
  | { type: 'spec'; ok: boolean; issues: string[] }
  | { type: 'progress' | 'completed'; step: number; percent: number; snapshot?: unknown }
  | { type: 'event'; name: string; seq: number }

const finite = (value: unknown, fallback = 0): number => (typeof value === 'number' && Number.isFinite(value) ? value : fallback)

/**
 * A message from the runtime, or null when it is not one: not an object, not ours, for another lesson, or a type nobody here handles.
 * Callers must already have checked `event.source`; this checks the shape and the lesson.
 */
export function parseRuntimeMessage(data: unknown, lessonId: string): RuntimeMessage | null {
  if (!data || typeof data !== 'object') return null
  const message = data as Record<string, unknown>
  if (message.src !== 'g2g-course') return null
  // The runtime echoes the lesson id it was opened with (`?lesson=`) on every message, so one that names no lesson, or another, is not ours.
  if (message.lesson === undefined || String(message.lesson) !== lessonId) return null

  switch (message.type) {
    case 'ready':
      return { type: 'ready' }
    case 'spec':
      return {
        type: 'spec',
        ok: message.ok === true,
        issues: Array.isArray(message.issues) ? message.issues.filter((i): i is string => typeof i === 'string').slice(0, 30) : [],
      }
    case 'progress':
    case 'completed':
      return {
        type: message.type,
        step: Math.max(0, Math.round(finite(message.step))),
        percent: Math.max(0, Math.min(100, Math.round(finite(message.percent)))),
        snapshot: message.snapshot,
      }
    case 'event':
      return { type: 'event', name: typeof message.name === 'string' ? message.name : '', seq: finite(message.seq) }
    default:
      return null
  }
}

/** The address of the runtime for one simulation: play it (`host`) or only check a specification (`validate`). */
export function runtimeFrameUrl({ lessonId, validate = false }: { lessonId: string; validate?: boolean }): string {
  const params = new URLSearchParams()
  params.set(validate ? 'validate' : 'host', '1')
  params.set('lesson', lessonId)
  if (typeof window !== 'undefined') params.set('from', window.location.origin)
  return `${SIM_RUNTIME_URL}?${params.toString()}`
}

export type HostMessage =
  | { type: 'init'; spec: unknown; resume?: unknown }
  | { type: 'pause' }
  | { type: 'resume' }

export function postToRuntime(frame: HTMLIFrameElement | null, message: HostMessage): void {
  try {
    frame?.contentWindow?.postMessage({ src: 'g2g-host', ...message }, '*')
  } catch {
    /* a frame that went away must not break the page */
  }
}

export interface SpecVerdict {
  ok: boolean
  issues: string[]
  /** The checker could not run at all (the runtime did not answer): nothing is known about the specification. */
  unavailable?: boolean
}

/**
 * Asks the runtime whether a specification is valid, in a hidden, sandboxed frame that draws nothing and loads no 3D. The runtime's own
 * validator is the authority, so the same rules that will play the simulation are the ones that vet it.
 */
export function checkSpecWithRuntime(spec: unknown, timeoutMs = 15000): { result: Promise<SpecVerdict>; cancel: () => void } {
  const lessonId = 'check'
  const frame = document.createElement('iframe')
  frame.setAttribute('sandbox', 'allow-scripts')
  frame.setAttribute('aria-hidden', 'true')
  frame.tabIndex = -1
  frame.title = 'Simulation check'
  Object.assign(frame.style, { position: 'fixed', width: '0', height: '0', border: '0', opacity: '0', pointerEvents: 'none' })

  let finish: (verdict: SpecVerdict) => void = () => undefined
  const result = new Promise<SpecVerdict>((resolve) => {
    let done = false
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow) return
      const message = parseRuntimeMessage(event.data, lessonId)
      if (!message) return
      if (message.type === 'ready') postToRuntime(frame, { type: 'init', spec })
      if (message.type === 'spec') finish({ ok: message.ok, issues: message.issues })
    }
    const timer = window.setTimeout(() => finish({ ok: false, issues: [], unavailable: true }), timeoutMs)
    finish = (verdict) => {
      if (done) return
      done = true
      window.clearTimeout(timer)
      window.removeEventListener('message', onMessage)
      frame.remove()
      resolve(verdict)
    }
    window.addEventListener('message', onMessage)
    frame.src = runtimeFrameUrl({ lessonId, validate: true })
    document.body.appendChild(frame)
  })

  return { result, cancel: () => finish({ ok: false, issues: [], unavailable: true }) }
}
