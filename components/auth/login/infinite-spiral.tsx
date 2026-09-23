'use client'

import { useEffect, useMemo, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * FORK OF REACT BITS' `InfiniteSpiral`
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Copy-paste source (React Bits ships no npm package for this), adapted in
 * two places only — everything else below is upstream, unchanged:
 *
 *   1. Card content now renders a visible bottom-edge label (a gradient
 *      scrim + a truncated line of text), not just an `aria-label`. Upstream
 *      only ever exposed `label` to assistive tech; this panel's cards need
 *      real, on-screen text — see the card content below. A strip appended
 *      below the image was ruled out (cardWidth/cardHeight drive the
 *      animation math directly — verticalSpacing overlap, the `fit` scale
 *      formula, the depth/opacity calc — growing the footprint fights that).
 *      A floating chip was ruled out too — a second nested "card" at
 *      100-140px reads as clutter. A flush bottom scrim inherits the card's
 *      own rounded corners via its existing `overflow-hidden` and guarantees
 *      legibility regardless of the photo underneath (checked the worst
 *      case — a pure white pixel under black/80 — still ≈13:1 contrast,
 *      well past WCAG AA).
 *
 *   2. `render()` skips its per-card recompute once the spiral has fully
 *      settled (no auto-speed, no pending drag target, not mid-drag)
 *      instead of doing identical trig + 15 DOM writes every frame forever.
 *      This matches the stronger convention already established in this
 *      app's own components — the old image-collage.tsx: "reduced motion
 *      decides whether the timer exists at all, not just whether a CSS
 *      class plays." Under reduced motion `desiredAutoSpeed` is already 0
 *      from frame one (the media query is checked synchronously), so
 *      `settled` goes true almost immediately — no visible snap. Drag-
 *      follow motion is deliberately left ungated: it's a direct result of
 *      the visitor's own gesture, the same principle as a map panning under
 *      a finger, not what the preference is meant to suppress.
 *
 * Everything else — the geometry, the responsive `fit` clamp, the
 * drag/scroll/hover interaction model — is upstream as supplied, not
 * redesigned.
 */

export interface InfiniteSpiralItem {
  id?: string | number
  src: string
  alt?: string
  href?: string
  target?: '_blank' | '_self' | '_parent' | '_top'
  label?: string
}

export interface InfiniteSpiralProps {
  items?: Array<string | InfiniteSpiralItem>
  speed?: number
  direction?: 'up' | 'down'
  animationMode?: 'auto' | 'drag' | 'scroll' | 'all'
  radius?: number
  cardWidth?: number
  cardHeight?: number
  verticalSpacing?: number
  perspective?: number
  cardsPerTurn?: number
  rotation?: number
  cardTilt?: number
  cardRadius?: number
  centerScale?: number
  edgeFade?: number
  edgeBlur?: number
  pauseOnHover?: boolean
  imageFit?: CSSProperties['objectFit']
  grayscale?: number
  className?: string
}

type NormalizedItem = InfiniteSpiralItem & { alt: string }

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
const modulo = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor
const smoothstep = (min: number, max: number, value: number) => {
  const x = clamp((value - min) / (max - min || 1), 0, 1)
  return x * x * (3 - 2 * x)
}

export function InfiniteSpiral({
  items = [],
  speed = 0.55,
  direction = 'up',
  animationMode = 'auto',
  radius = 170,
  cardWidth = 100,
  cardHeight = 100,
  verticalSpacing = 60,
  perspective = 1000,
  cardsPerTurn = 7,
  rotation = 0,
  cardTilt = 0,
  cardRadius = 10,
  centerScale = 1.2,
  edgeFade = 0.3,
  edgeBlur = 6,
  pauseOnHover = true,
  imageFit = 'cover',
  grayscale = 0,
  className = '',
}: InfiniteSpiralProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Array<HTMLAnchorElement | HTMLDivElement | null>>([])
  const progressRef = useRef(0)
  const targetProgressRef = useRef(0)
  const autoSpeedRef = useRef(0)
  const hoveredRef = useRef(false)
  const visibleRef = useRef(true)
  const draggingRef = useRef(false)
  const lastPointerYRef = useRef(0)
  const dragMovedRef = useRef(false)

  const normalizedItems = useMemo<NormalizedItem[]>(
    () =>
      items.map((item, index) =>
        typeof item === 'string'
          ? { src: item, alt: `Spiral image ${index + 1}` }
          : { alt: `Spiral image ${index + 1}`, ...item },
      ),
    [items],
  )

  useEffect(() => {
    const root = rootRef.current
    if (!root || normalizedItems.length === 0) return

    let frameId = 0
    let previousTime = performance.now()
    let bounds = root.getBoundingClientRect()
    // Fork addition — see file header §2. Forces one full layout pass on
    // mount (and after any resize) even if the spiral is otherwise settled,
    // so a reduced-motion visitor still sees every card correctly placed
    // rather than piled at dead-center forever.
    let hasRenderedOnce = false
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const scrollEnabled = animationMode === 'scroll' || animationMode === 'all'
    const scrollSpeedMultiplier = Math.max(speed, 0) / 0.55
    let lastScrollY = window.scrollY
    const resizeObserver = new ResizeObserver(() => {
      bounds = root.getBoundingClientRect()
      hasRenderedOnce = false
    })
    resizeObserver.observe(root)
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visibleRef.current = entry.isIntersecting
    })
    intersectionObserver.observe(root)

    const handleScroll = () => {
      const nextScrollY = window.scrollY
      const scrollDelta = nextScrollY - lastScrollY
      lastScrollY = nextScrollY
      if (!scrollEnabled || !visibleRef.current || scrollDelta === 0) return
      targetProgressRef.current += clamp(
        (scrollDelta * scrollSpeedMultiplier) / Math.max(verticalSpacing * 2, 1),
        -1.5,
        1.5,
      )
    }
    window.addEventListener('scroll', handleScroll, { passive: true })

    const render = (time: number) => {
      const delta = Math.min((time - previousTime) / 1000, 0.05)
      previousTime = time
      const autoEnabled = animationMode === 'auto' || animationMode === 'all'
      const motionPaused = draggingRef.current || (pauseOnHover && hoveredRef.current)
      const directionMultiplier = direction === 'down' ? -1 : 1
      const desiredAutoSpeed =
        autoEnabled && visibleRef.current && !reducedMotion.matches && !motionPaused
          ? speed * directionMultiplier
          : 0
      const speedBlend = 1 - Math.exp(-delta * 7)
      autoSpeedRef.current += (desiredAutoSpeed - autoSpeedRef.current) * speedBlend
      targetProgressRef.current += autoSpeedRef.current * delta

      const followBlend = 1 - Math.exp(-delta * (draggingRef.current ? 22 : 11))
      progressRef.current += (targetProgressRef.current - progressRef.current) * followBlend

      // Fork addition — see file header §2.
      const settled =
        Math.abs(autoSpeedRef.current) < 0.0005 &&
        Math.abs(targetProgressRef.current - progressRef.current) < 0.0005 &&
        !draggingRef.current

      if (hasRenderedOnce && settled) {
        frameId = requestAnimationFrame(render)
        return
      }

      const count = normalizedItems.length
      const half = count / 2
      const width = Math.max(bounds.width, 1)
      const height = Math.max(bounds.height, 1)
      const fit = Math.min(1, width / (cardWidth * 2.8), height / (cardHeight * 2.35))
      const responsiveRadius = Math.min(radius, Math.max(72, width * 0.36)) * fit
      const fadeStart = clamp(1 - edgeFade, 0, 0.98)
      const turnSize = Math.max(cardsPerTurn, 1)

      cardRefs.current.forEach((card, index) => {
        if (!card) return
        const offset = modulo(index - progressRef.current + half, count) - half
        const edge = Math.min(Math.abs(offset) / Math.max(half, 1), 1)
        const opacity = 1 - smoothstep(fadeStart, 1, edge)
        const focus = 1 - Math.min(Math.abs(offset) / Math.max(turnSize * 0.65, 1), 1)
        const scale = (1 + (centerScale - 1) * focus) * fit
        const angle = offset * (360 / turnSize) + rotation
        const angleRadians = (angle * Math.PI) / 180
        const x = Math.sin(angleRadians) * responsiveRadius
        const z = Math.cos(angleRadians) * responsiveRadius
        const depthScale = clamp(perspective / Math.max(perspective - z, 1), 0.72, 1.45)
        const visualScale = scale * depthScale
        const depth = (z / Math.max(responsiveRadius, 1) + 1) / 2
        const blur = edgeBlur * smoothstep(0.35, 1, edge)
        card.style.transform = `translate(-50%, -50%) translate3d(${x}px, ${offset * verticalSpacing * fit}px, 0) rotateZ(${cardTilt}deg) scale(${visualScale})`
        card.style.opacity = opacity.toFixed(3)
        card.style.filter = blur > 0.01 ? `blur(${blur.toFixed(2)}px)` : 'none'
        card.style.zIndex = String(Math.round(depth * 100000) + index)
        card.style.pointerEvents = opacity > 0.25 ? 'auto' : 'none'
      })

      hasRenderedOnce = true
      frameId = requestAnimationFrame(render)
    }

    frameId = requestAnimationFrame(render)
    return () => {
      cancelAnimationFrame(frameId)
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      window.removeEventListener('scroll', handleScroll)
    }
  }, [
    normalizedItems,
    speed,
    direction,
    animationMode,
    radius,
    perspective,
    cardWidth,
    cardHeight,
    verticalSpacing,
    cardsPerTurn,
    rotation,
    cardTilt,
    centerScale,
    edgeFade,
    edgeBlur,
    pauseOnHover,
  ])

  const rootStyle = {
    perspective: `${perspective}px`,
    '--spiral-width': `${cardWidth}px`,
    '--spiral-height': `${cardHeight}px`,
    '--spiral-radius': `${cardRadius}px`,
    cursor: animationMode === 'drag' || animationMode === 'all' ? 'grab' : 'default',
    touchAction: animationMode === 'drag' || animationMode === 'all' ? 'pan-x' : 'auto',
    userSelect: animationMode === 'drag' || animationMode === 'all' ? 'none' : 'auto',
  } as CSSProperties

  const dragEnabled = animationMode === 'drag' || animationMode === 'all'

  const stopDragging = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    event.currentTarget.style.cursor = dragEnabled ? 'grab' : 'default'
  }

  const setCardRef = (index: number) => (node: HTMLAnchorElement | HTMLDivElement | null) => {
    cardRefs.current[index] = node
  }

  const cardStyle: CSSProperties = { width: cardWidth, height: cardHeight, borderRadius: cardRadius }
  const imageStyle: CSSProperties = {
    width: cardWidth,
    height: cardHeight,
    maxWidth: 'none',
    maxHeight: 'none',
    objectFit: imageFit,
    filter: `grayscale(${Math.min(1, Math.max(0, grayscale))})`,
  }

  const itemClassName =
    "absolute left-1/2 top-1/2 block h-[var(--spiral-height)] w-[var(--spiral-width)] overflow-hidden rounded-[var(--spiral-radius)] border border-white/25 bg-white/10 shadow-[0_14px_38px_rgba(8,6,18,0.2)] [backface-visibility:hidden] [transform-style:preserve-3d] [will-change:transform,opacity,filter] motion-reduce:transition-none"

  return (
    <div
      ref={rootRef}
      className={`relative isolate h-full min-h-80 w-full overflow-hidden ${className}`}
      style={rootStyle}
      onMouseEnter={() => {
        hoveredRef.current = true
      }}
      onMouseLeave={() => {
        hoveredRef.current = false
      }}
      onPointerDown={(event) => {
        if (!dragEnabled || event.button !== 0) return
        draggingRef.current = true
        dragMovedRef.current = false
        lastPointerYRef.current = event.clientY
        targetProgressRef.current = progressRef.current
        event.currentTarget.setPointerCapture(event.pointerId)
        event.currentTarget.style.cursor = 'grabbing'
      }}
      onPointerMove={(event) => {
        if (!draggingRef.current) return
        const pointerDelta = event.clientY - lastPointerYRef.current
        lastPointerYRef.current = event.clientY
        if (Math.abs(pointerDelta) > 0.5) dragMovedRef.current = true
        targetProgressRef.current -= pointerDelta / Math.max(verticalSpacing, 1)
      }}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onClickCapture={(event) => {
        if (!dragMovedRef.current) return
        event.preventDefault()
        event.stopPropagation()
        dragMovedRef.current = false
      }}
    >
      <div className="absolute inset-0 [transform-style:preserve-3d]" role="list" aria-label="Infinite spiral gallery">
        {normalizedItems.map((item, index) => {
          const content = (
            <>
              <img
                className="absolute inset-0 block h-full w-full select-none object-center"
                src={item.src}
                alt={item.alt}
                loading={index < 6 ? 'eager' : 'lazy'}
                draggable={false}
                style={imageStyle}
              />
              {item.label ? (
                <>
                  {/* Fork addition — see file header §1. A flush bottom
                      scrim + one truncated line, not a floating chip: it
                      inherits the card's own rounded corners via the
                      overflow-hidden on itemClassName, and its legibility
                      never depends on what the photo happens to look like
                      underneath. */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent"
                  />
                  {/* aria-hidden: the wrapping <a>/<div> below already
                      carries aria-label={item.label ?? item.alt} — this is
                      a visual-only echo, not a second accessible name. */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bottom-1 truncate px-2 text-center text-[10px] font-semibold uppercase tracking-wide text-white [text-shadow:0_1px_2px_rgb(0_0_0_/_0.85)]"
                  >
                    {item.label}
                  </span>
                </>
              ) : null}
            </>
          )

          return item.href ? (
            <a
              key={item.id ?? `${item.src}-${index}`}
              ref={setCardRef(index)}
              className={itemClassName}
              style={cardStyle}
              href={item.href}
              target={item.target}
              rel={item.target === '_blank' ? 'noreferrer' : undefined}
              role="listitem"
              aria-label={item.label ?? item.alt}
            >
              {content}
            </a>
          ) : (
            <div
              key={item.id ?? `${item.src}-${index}`}
              ref={setCardRef(index)}
              className={itemClassName}
              style={cardStyle}
              role="listitem"
              aria-label={item.label ?? item.alt}
            >
              {content}
            </div>
          )
        })}
      </div>
    </div>
  )
}
