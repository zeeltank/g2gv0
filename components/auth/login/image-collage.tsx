'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

export interface CollageSlide {
  src: string
  /** Rendered inside an opaque chip, never directly on the image — see below. */
  caption: string
}

const SLIDE_DURATION_MS = 8000
const FADE_MS = 1100

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * THE COLLAGE — three generated stills, crossfading with a slow zoom
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Each image is a flat-navy, hard-diagonal-split collage of invented (not
 * screenshotted) G2G-style stat cards, generated to spec rather than pulled
 * from CSS gradients/blur — see the design brief for why. This component only
 * owns the ROTATION: crossfade opacity, a one-shot Ken Burns zoom per slide,
 * pause on hover, and full stillness under reduced motion.
 *
 * ── WHY THE CAPTION IS A SOLID CHIP, NOT TEXT LAID OVER THE IMAGE ───────────
 *
 * The generation prompts asked for a quiet corner per image, but two of the
 * three still have a card bleeding into it (that was itself asked for, to
 * keep the three from feeling identical). White text with a shadow would be
 * legible against flat navy and invisible the moment it lands on a white
 * card underneath. An opaque `bg-brand-navy` chip has its own background, so
 * legibility never depends on what happens to be in the image at that exact
 * spot — and it reads as one more card in the collage's own vocabulary
 * (small light or dark tiles scattered on navy) rather than a caption
 * fighting the art for attention.
 */

/**
 * Which rotation cycle last activated each slide index, so remounting (and
 * therefore restarting the CSS zoom) happens only to the slide becoming
 * active — not to the one fading out, which would pop instead of dissolve.
 */
function useEpochs(count: number) {
  const [epochs, setEpochs] = useState<number[]>(() => Array(count).fill(0))
  const counter = useRef(0)

  const bump = (index: number) => {
    counter.current += 1
    setEpochs((prev) => {
      const next = [...prev]
      next[index] = counter.current
      return next
    })
  }

  return [epochs, bump] as const
}

export function ImageCollage({
  slides,
  className,
}: {
  slides: CollageSlide[]
  className?: string
}) {
  const [active, setActive] = useState(0)
  const [epochs, bumpEpoch] = useEpochs(slides.length)
  const [paused, setPaused] = useState(false)
  /*
   * State, not a ref: the render output (whether the Ken Burns class is
   * attached) depends on this value, and reading a ref's `.current` during
   * render is the exact anti-pattern React's rules-of-hooks lint now catches
   * — refs are for values mutated outside the render phase.
   */
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    // Deferred a tick, matching theme-provider.tsx's own pattern for the same
    // rule: a synchronous setState inside an effect body cascades into a
    // second render immediately after the first.
    queueMicrotask(() => {
      setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    })
  }, [])

  useEffect(() => {
    // Reduced motion is the real authority on stillness — this is what
    // decides whether the timer exists at all, not just whether a CSS
    // animation plays. The globals.css guard is belt-and-suspenders only.
    if (reducedMotion || paused || slides.length < 2) return

    const timer = window.setInterval(() => {
      setActive((current) => {
        const next = (current + 1) % slides.length
        bumpEpoch(next)
        return next
      })
    }, SLIDE_DURATION_MS)

    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bumpEpoch is stable (ref-backed counter)
  }, [reducedMotion, paused, slides.length])

  return (
    <div
      className={cn('relative h-full w-full overflow-hidden', className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      // Pure atmosphere — the panel's real content (brand mark, headline) is
      // rendered as actual text by the caller, not baked into these images.
      aria-hidden="true"
    >
      {slides.map((slide, index) => (
        <div
          key={`slide-${index}-${epochs[index]}`}
          className="absolute inset-0 transition-opacity ease-in-out"
          style={{
            zIndex: index === active ? 1 : 0,
            opacity: index === active ? 1 : 0,
            transitionDuration: `${FADE_MS}ms`,
          }}
        >
          <Image
            src={slide.src}
            alt=""
            fill
            sizes="46vw"
            className={cn(
              'object-cover',
              index === active && !reducedMotion && 'g2g-ken-burns',
            )}
          />
        </div>
      ))}

      {/*
        Caption and dots together, one chip, centered at the bottom of the
        panel — the caption names what's on screen, the dots show where you
        are in the rotation, and they belong next to each other rather than
        in two separate places on the panel.
      */}
      <div className="absolute inset-x-0 bottom-6 z-10 flex justify-center xl:bottom-8">
        {/*
          A FIXED width on the caption row, not shrink-to-fit. Every caption
          sits inside three stacked `absolute inset-0` <p> elements so they
          can crossfade in place — which means none of them is in normal
          flow, so nothing here can size itself to "the current caption's
          width" the way an ordinary inline element would. 288px comfortably
          fits the longest caption in this set on one line at this font
          size with room to spare, and `truncate` is the backstop if a
          future caption doesn't: one line, ellipsised if it ever has to be,
          never wrapped — a wrapped line inside a fixed-height crossfade
          slot doesn't just look bad, it shows a cropped fragment of both
          lines at once.
        */}
        <div className="flex max-w-[85%] flex-col items-center gap-2.5 rounded-xl bg-brand-navy px-4 py-3 shadow-lg ring-1 ring-white/10">
          <div className="relative h-5 w-72 max-w-full overflow-hidden">
            {slides.map((slide, index) => (
              <p
                key={index}
                className="absolute inset-0 flex items-center justify-center truncate text-sm font-medium text-white transition-opacity ease-in-out"
                style={{
                  opacity: index === active ? 1 : 0,
                  transitionDuration: `${FADE_MS}ms`,
                }}
              >
                {slide.caption}
              </p>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            {slides.map((_, index) => (
              <span
                key={index}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-500',
                  index === active ? 'w-6 bg-white' : 'w-1.5 bg-white/30',
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
