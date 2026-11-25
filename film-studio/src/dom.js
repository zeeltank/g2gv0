// DOM layer helpers: type is set in HTML (Fraunces and Manrope) above the WebGL canvas and animated on the same GSAP clock.
import { gsap } from 'gsap'

export const root = () => document.getElementById('dom')

/** A text element positioned in stage pixels. opts: x, y (top-left), cx (centre x), size, weight, color, font ('disp'|'sans'), w, align, italic. */
export function text(str, opts = {}, parent = root()) {
  const e = document.createElement('div')
  e.className = 't ' + (opts.font === 'sans' ? '' : 'disp')
  e.style.cssText = `font-size:${opts.size ?? 64}px;font-weight:${opts.weight ?? 400};color:${opts.color ?? '#fff'};${opts.italic ? 'font-style:italic;' : ''}${opts.lh ? `line-height:${opts.lh};` : ''}${opts.track != null ? `letter-spacing:${opts.track}em;` : ''}${opts.wrap ? 'white-space:normal;' : ''}${opts.w ? `width:${opts.w}px;` : ''}text-align:${opts.align ?? 'left'};`
  if (opts.cx != null) { e.style.left = `${opts.cx - (opts.w ?? 0) / 2}px` } else if (opts.x != null) e.style.left = `${opts.x}px`
  if (opts.y != null) e.style.top = `${opts.y}px`
  if (opts.letters) str.split('').forEach((c) => { const s = document.createElement('span'); s.className = 'w'; s.textContent = c; e.appendChild(s) })
  else if (opts.words === false) e.textContent = str
  else str.split(' ').forEach((w, i, a) => { const s = document.createElement('span'); s.className = 'w'; s.textContent = i < a.length - 1 ? w + ' ' : w; e.appendChild(s) })
  e.style.opacity = '0'
  parent.appendChild(e)
  return e
}

export const wordsOf = (e) => [...e.querySelectorAll('.w')]

/** Words arrive one by one: blur 7 px to sharp, opacity 0 to 1. */
export function wordsIn(tl, e, at, { step = 0.09, dur = 0.3 } = {}) {
  tl.set(e, { opacity: 1 }, at)
  tl.fromTo(wordsOf(e), { opacity: 0, filter: 'blur(7px)' }, { opacity: 1, filter: 'blur(0px)', duration: dur, stagger: step, ease: 'power2.out' }, at)
}

export function textOut(tl, e, at, dur = 0.22) {
  tl.to(e, { opacity: 0, filter: 'blur(8px)', duration: dur, ease: 'power3.in' }, at)
}

/** Keep an element on the screen position of a 3D point each frame (call from the beat's frame function). */
export function place(e, p, { dx = 0, dy = 0 } = {}) {
  e.style.left = `${p.x + dx}px`
  e.style.top = `${p.y + dy}px`
}

export { gsap }
