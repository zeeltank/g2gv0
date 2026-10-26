'use client'

import { useId, useMemo, useState } from 'react'

import { cn } from '@/lib/utils'
import type { SimulationCard } from '@/services/lms/simulations'

/**
 * The picture on a simulation's card.
 *
 * A simulation that has a `cover_url` shows that image. One that has none - a freshly imported specification, a tenant's own - still gets a
 * designed cover rather than an empty grey box: a small isometric scene in the product's chart colours, drawn from the simulation's `slug`.
 * The same slug always draws the same scene, so a card does not change between visits, and nothing here depends on which simulations exist.
 */

const ACCENTS = ['--chart-blue', '--chart-teal', '--chart-green', '--chart-orange', '--chart-indigo'] as const

function hashOf(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** A small deterministic generator (mulberry32), so one slug is always the same picture. */
function randomFrom(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Block {
  key: string
  x: number
  y: number
  h: number
  hero: boolean
  depth: number
}

const TILE_W = 58
const TILE_H = 29
const COLS = 4
const ROWS = 3

function buildScene(slug: string) {
  const seed = hashOf(slug || 'simulation')
  const next = randomFrom(seed)
  const accent = ACCENTS[seed % ACCENTS.length]
  const origin = { x: 160, y: 64 }
  const blocks: Block[] = []
  const heroCell = Math.floor(next() * COLS * ROWS)
  let cell = 0
  for (let gy = 0; gy < ROWS; gy += 1) {
    for (let gx = 0; gx < COLS; gx += 1) {
      const hero = cell === heroCell
      // Some tiles stay empty so the scene reads as a layout, not a wall; the hero tile never does.
      if (!hero && next() < 0.22) {
        cell += 1
        continue
      }
      blocks.push({
        key: `${gx}-${gy}`,
        x: origin.x + (gx - gy) * (TILE_W / 2),
        y: origin.y + (gx + gy) * (TILE_H / 2),
        h: hero ? 46 + Math.round(next() * 14) : 6 + Math.round(next() * 26),
        hero,
        depth: gx + gy,
      })
      cell += 1
    }
  }
  blocks.sort((a, b) => a.depth - b.depth)
  return { accent, blocks }
}

function IsoBlock({ block, accent }: { block: Block; accent: string }) {
  const { x, y, h, hero } = block
  const hw = TILE_W / 2
  const th = TILE_H
  const top = `${x},${y - h} ${x + hw},${y - h + th / 2} ${x},${y - h + th} ${x - hw},${y - h + th / 2}`
  const left = `${x - hw},${y - h + th / 2} ${x},${y - h + th} ${x},${y + th} ${x - hw},${y + th / 2}`
  const right = `${x + hw},${y - h + th / 2} ${x},${y - h + th} ${x},${y + th} ${x + hw},${y + th / 2}`
  const base = hero ? `var(${accent})` : 'var(--card)'
  const mix = (pct: number, into: string) => `color-mix(in srgb, ${base} ${pct}%, ${into})`
  return (
    <g>
      <polygon points={left} style={{ fill: hero ? mix(78, 'black') : mix(86, 'var(--muted-foreground)') }} />
      <polygon points={right} style={{ fill: hero ? mix(90, 'black') : mix(94, 'var(--muted-foreground)') }} />
      <polygon points={top} style={{ fill: base, stroke: hero ? 'none' : 'var(--border)', strokeWidth: 0.75 }} />
      {hero && <circle cx={x} cy={y - h + th / 2} r={4} style={{ fill: 'var(--card)', opacity: 0.95 }} />}
    </g>
  )
}

function GeneratedCover({ slug, className }: { slug: string; className?: string }) {
  const { accent, blocks } = useMemo(() => buildScene(slug), [slug])
  const gradient = useId()
  const hero = blocks.find((b) => b.hero)
  return (
    <svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" className={cn('size-full', className)} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: `color-mix(in srgb, var(${accent}) 16%, var(--card))` }} />
          <stop offset="1" style={{ stopColor: `color-mix(in srgb, var(${accent}) 34%, var(--card))` }} />
        </linearGradient>
      </defs>
      <rect width="320" height="200" fill={`url(#${gradient})`} />
      {/* a faint ground grid under the blocks */}
      <g style={{ stroke: `color-mix(in srgb, var(${accent}) 22%, transparent)`, strokeWidth: 0.6 }}>
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`a${i}`} x1={-40 + i * 50} y1={200} x2={40 + i * 50} y2={0} />
        ))}
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`b${i}`} x1={360 - i * 50} y1={200} x2={280 - i * 50} y2={0} />
        ))}
      </g>
      {blocks.map((block) => (
        <IsoBlock key={block.key} block={block} accent={accent} />
      ))}
      {hero && (
        <circle
          cx={hero.x}
          cy={hero.y - hero.h + TILE_H / 2}
          r={11}
          className="animate-pulse motion-reduce:animate-none"
          style={{ fill: 'none', stroke: `var(${accent})`, strokeWidth: 1.5, opacity: 0.55 }}
        />
      )}
    </svg>
  )
}

export function SimulationCover({
  simulation,
  className,
  imageClassName,
}: {
  simulation: Pick<SimulationCard, 'slug' | 'cover_url' | 'title'>
  className?: string
  imageClassName?: string
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const showImage = Boolean(simulation.cover_url) && failedUrl !== simulation.cover_url

  return (
    <div className={cn('relative size-full overflow-hidden bg-muted', className)}>
      {showImage ? (
        <img
          src={simulation.cover_url ?? undefined}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailedUrl(simulation.cover_url)}
          className={cn('size-full object-cover', imageClassName)}
        />
      ) : (
        <GeneratedCover slug={simulation.slug} className={imageClassName} />
      )}
    </div>
  )
}
