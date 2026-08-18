'use client'

/**
 * The geometric tile view each library tab is recognised by.
 *
 * Design notes, because several things here look arbitrary and are not:
 *
 * COLOUR. Every tile uses --primary. The tabs are already told apart by their
 * shape, icon and label, so giving each one its own hue added a palette the
 * design system does not have (it defines primary / success / warning /
 * destructive and nothing else) and made the screens look unrelated. One
 * accent, many silhouettes.
 *
 * GEOMETRY. Flat-top hexagons in vertical columns. Adjacent columns overlap
 * horizontally by a quarter of a tile and are offset vertically by half a
 * tile, which is what makes a comb rather than a grid of hexagons with holes
 * between them. The overlap is done by making the grid TRACK narrower than the
 * tile — negative column-gap is invalid CSS, so the tile has to overflow its
 * own track instead.
 *
 * BORDERS. A clip-path has no border: `border` is drawn before the clip and
 * gets cut away. So each tile is two stacked layers with the same silhouette —
 * an outer one in the border colour and an inner one inset by 2px in the fill
 * colour. The 2px rim that shows through is the border.
 */

import { useMemo } from 'react'
import { BarChart3, Link2, Pencil, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { LibraryRow } from '@/services/competency/libraries'
import type { LibraryShape } from './library-config'

export interface ShapeAction {
  id: string
  label: string
  icon: typeof Pencil
  onSelect: (row: LibraryRow) => void
  danger?: boolean
}

interface ShapeGridProps {
  shape: LibraryShape
  rows: LibraryRow[]
  titleKey: string
  subtitleKey?: string
  onOpen: (row: LibraryRow) => void
  actions?: ShapeAction[]
}

/** Flat-top hexagon: vertices left and right, flat edges top and bottom. */
const HEXAGON = 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)'
const TRIANGLE = 'polygon(50% 0%, 100% 100%, 0% 100%)'

const CLIP: Partial<Record<LibraryShape, string>> = {
  hexagon: HEXAGON,
  triangle: TRIANGLE,
}

/**
 * A flat-top hexagon is √3/2 as tall as it is wide. Getting this wrong is what
 * leaves vertical seams in the comb.
 */
const HEX_RATIO = 0.866
/** Columns overlap by a quarter tile: centres sit 0.75 × width apart. */
const HEX_STEP = 0.75

/**
 * How much of the tile the label may use. A hexagon wastes its left and right
 * points; a triangle is empty at the top. Text measured against the full box
 * spills outside the visible silhouette even though it is inside the element.
 */
const TEXT_BOX: Record<LibraryShape, string> = {
  hexagon: 'w-[64%]',
  triangle: 'w-[58%] translate-y-[26%]',
  circle: 'w-[70%]',
  card: 'w-full',
}

export function ShapeGrid({ shape, rows, titleKey, subtitleKey, onOpen, actions = [] }: ShapeGridProps) {
  const items = useMemo(
    () =>
      rows.map((row) => ({
        row,
        title: String(row[titleKey] ?? '').trim() || 'Untitled',
        subtitle: subtitleKey ? String(row[subtitleKey] ?? '').trim() : '',
      })),
    [rows, titleKey, subtitleKey],
  )

  if (items.length === 0) return null

  /* ---------------- cards ---------------- */
  if (shape === 'card') {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map(({ row, title, subtitle }) => (
          <div key={row.id} className="group relative">
            <button
              type="button"
              onClick={() => onOpen(row)}
              className={cn(
                'flex h-full w-full flex-col gap-2 rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 p-4 text-left',
                'transition-all duration-200',
                'hover:-translate-y-0.5 hover:border-primary/60 hover:from-primary/20 hover:to-primary/10',
                'hover:shadow-[0_12px_28px_-14px_var(--primary)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
              )}
            >
              <p className="line-clamp-2 pr-2 text-sm font-bold text-foreground">{title}</p>
              {subtitle && <p className="line-clamp-3 text-xs text-muted-foreground">{subtitle}</p>}
            </button>

            <ActionRail actions={actions} row={row} title={title} placement="corner" />
          </div>
        ))}
      </div>
    )
  }

  /* ---------------- honeycomb ---------------- */
  if (shape === 'hexagon') {
    return (
      <>
        {/*
          The comb's geometry lives in real CSS rather than utility classes
          because two parts of it cannot be expressed as one: the column count
          has to change per breakpoint AND feed a calc(), and the half-tile
          drop applies to every second child.

          Column counts are EVEN at every breakpoint on purpose. The drop
          alternates by document order, so an odd count would change which
          column is lowered on each row and the comb would zigzag.
        */}
        <style>{`
          .g2g-comb {
            --hex: 9.75rem;
            --hex-cols: 2;
            display: grid;
            justify-content: center;
            row-gap: 0;
            grid-template-columns: repeat(var(--hex-cols), calc(var(--hex) * ${HEX_STEP}));
            /* A tile is wider than its track by design, so the last column
               overhangs to the right and the dropped columns overhang below.
               Both are padded for, or they clip against the panel edge. */
            padding-right: calc(var(--hex) * ${1 - HEX_STEP});
            padding-bottom: calc(var(--hex) * ${HEX_RATIO} * 0.5);
          }
          @media (min-width: 640px)  { .g2g-comb { --hex-cols: 4; } }
          @media (min-width: 1024px) { .g2g-comb { --hex-cols: 6; } }
          @media (min-width: 1536px) { .g2g-comb { --hex-cols: 8; } }

          .g2g-comb > .g2g-cell {
            width: var(--hex);
            height: calc(var(--hex) * ${HEX_RATIO});
          }
          /* Every second column hangs half a tile lower — the interlock. */
          .g2g-comb > .g2g-cell:nth-child(even) {
            transform: translateY(calc(var(--hex) * ${HEX_RATIO} * 0.5));
          }
        `}</style>

        <div className="g2g-comb">
          {items.map(({ row, title, subtitle }) => (
            <div key={row.id} className="g2g-cell group relative hover:z-30">
              <Tile shape="hexagon" title={title} subtitle={subtitle} onClick={() => onOpen(row)} />
              <ActionRail actions={actions} row={row} title={title} placement="above" />
            </div>
          ))}
        </div>
      </>
    )
  }

  /* ---------------- circles and triangles ---------------- */
  return (
    <div className="grid grid-cols-2 justify-items-center gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {items.map(({ row, title, subtitle }) => (
        <div key={row.id} className="group relative h-36 w-36 transition-[z-index] hover:z-30">
          <Tile shape={shape} title={title} subtitle={subtitle} onClick={() => onOpen(row)} />
          <ActionRail actions={actions} row={row} title={title} placement="above" />
        </div>
      ))}
    </div>
  )
}

/**
 * One tile: border layer, fill layer, label. Two layers because a clipped
 * element cannot carry a border — see the note at the top of the file.
 */
function Tile({
  shape,
  title,
  subtitle,
  onClick,
}: {
  shape: LibraryShape
  title: string
  subtitle: string
  onClick: () => void
}) {
  const clip = CLIP[shape]
  const rounded = shape === 'circle' ? 'rounded-full' : shape === 'card' ? 'rounded-2xl' : ''

  return (
    <button
      type="button"
      onClick={onClick}
      title={subtitle || title}
      className={cn(
        'group/tile relative flex h-full w-full items-center justify-center text-center',
        'transition-transform duration-200 group-hover:scale-[1.05]',
        'focus-visible:outline-none',
      )}
    >
      {/* Border layer. */}
      <span
        aria-hidden
        className={cn(
          'absolute inset-0 bg-primary/30 transition-colors duration-200',
          'group-hover:bg-primary group-focus-within:bg-primary',
          rounded,
        )}
        style={clip ? { clipPath: clip } : undefined}
      />

      {/* Fill layer, inset by the border width. */}
      <span
        aria-hidden
        className={cn(
          'absolute inset-[2px] bg-gradient-to-br from-primary/15 to-primary/5 transition-colors duration-200',
          'group-hover:from-primary/30 group-hover:to-primary/15',
          rounded,
        )}
        style={clip ? { clipPath: clip } : undefined}
      />

      <span
        className={cn(
          'relative z-10 line-clamp-4 px-1 text-[11px] font-semibold leading-tight text-foreground',
          TEXT_BOX[shape],
        )}
      >
        {title}
      </span>
    </button>
  )
}

/**
 * The per-tile controls.
 *
 * Floated clear of the silhouette rather than laid over it: on a hexagon or a
 * triangle there is no rectangle inside the shape big enough to hold four
 * icons without covering the label, and icons drawn inside a clipped element
 * get cut off at the edges anyway.
 */
function ActionRail({
  actions,
  row,
  title,
  placement,
}: {
  actions: ShapeAction[]
  row: LibraryRow
  title: string
  placement: 'above' | 'corner'
}) {
  if (actions.length === 0) return null

  return (
    <div
      className={cn(
        'absolute z-30 flex items-center gap-0.5 rounded-full border border-border bg-popover p-1 shadow-lg',
        'pointer-events-none scale-95 opacity-0 transition-all duration-150',
        'group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100',
        'group-focus-within:pointer-events-auto group-focus-within:scale-100 group-focus-within:opacity-100',
        placement === 'above'
          ? '-top-3 left-1/2 -translate-x-1/2'
          : 'right-2 top-2',
      )}
    >
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          title={`${action.label} — ${title}`}
          aria-label={`${action.label} ${title}`}
          onClick={(event) => {
            event.stopPropagation()
            action.onSelect(row)
          }}
          className={cn(
            'rounded-full p-1.5 transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            action.danger
              ? 'text-muted-foreground hover:bg-destructive hover:text-destructive-foreground'
              : 'text-muted-foreground hover:bg-primary hover:text-primary-foreground',
          )}
        >
          <action.icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  )
}

/** The icons the library tabs use, so call sites do not re-import them. */
export const SHAPE_ACTION_ICONS = {
  edit: Pencil,
  delete: Trash2,
  insights: BarChart3,
  link: Link2,
}
