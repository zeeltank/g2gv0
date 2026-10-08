'use client'

import { useState, type ReactNode } from 'react'
import './folder-icon-3d.css'

/**
 * React Bits' open-source "Folder" component (reactbits.dev, MIT — not the
 * paid Pro registry), adapted as-is: a lightly 3D folder that lifts and
 * peeks its "papers" on hover, and stays open on click. Ported in full
 * fidelity to this project's conventions (typed props, our brand blue as
 * the default color instead of upstream's purple) rather than reduced to a
 * static icon — the hover/open motion is the whole point of using this over
 * a plain `<Folder />` from lucide.
 */

function darkenColor(hex: string, percent: number): string {
  let color = hex.startsWith('#') ? hex.slice(1) : hex
  if (color.length === 3) {
    color = color
      .split('')
      .map((c) => c + c)
      .join('')
  }
  const num = parseInt(color.slice(0, 6), 16)
  let r = (num >> 16) & 0xff
  let g = (num >> 8) & 0xff
  let b = num & 0xff
  r = Math.max(0, Math.min(255, Math.floor(r * (1 - percent))))
  g = Math.max(0, Math.min(255, Math.floor(g * (1 - percent))))
  b = Math.max(0, Math.min(255, Math.floor(b * (1 - percent))))
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()
}

export interface FolderIcon3DProps {
  /** Defaults to this product's own primary blue (--primary: hsl(221 83% 53%) = #2563EB), not upstream's purple. */
  color?: string
  size?: number
  /** Up to 3 nodes rendered as "papers" peeking out when open/hovered. */
  items?: ReactNode[]
  className?: string
  /**
   * False renders a plain, non-focusable `<div>` instead of upstream's own
   * `role="button" tabIndex={0}` wrapper - for whenever this sits decoratively
   * inside a caller's own interactive element (a card's `<button>`, a link),
   * where nesting another focusable/button-role element would be invalid
   * markup and double-handle the click. The hover lift/peek is pure CSS
   * (`.folder:hover`), so it still works with no JS handlers attached;
   * only the click-to-stay-open state and its own keyboard handling are cut.
   * Defaults true (matches upstream's own always-interactive behavior) for
   * standalone use.
   */
  interactive?: boolean
}

export function FolderIcon3D({ color = '#2563EB', size = 1, items = [], className = '', interactive = true }: FolderIcon3DProps) {
  const maxItems = 3
  const papers: Array<ReactNode | null> = items.slice(0, maxItems)
  while (papers.length < maxItems) papers.push(null)

  const [open, setOpen] = useState(false)
  const [paperOffsets, setPaperOffsets] = useState(Array.from({ length: maxItems }, () => ({ x: 0, y: 0 })))

  const folderBackColor = darkenColor(color, 0.08)
  const paper1 = darkenColor('#ffffff', 0.1)
  const paper2 = darkenColor('#ffffff', 0.05)
  const paper3 = '#ffffff'

  function handleClick() {
    setOpen((prev) => !prev)
    if (open) {
      setPaperOffsets(Array.from({ length: maxItems }, () => ({ x: 0, y: 0 })))
    }
  }

  function handlePaperMouseMove(e: React.MouseEvent<HTMLDivElement>, index: number) {
    if (!open) return
    const rect = e.currentTarget.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const offsetX = (e.clientX - centerX) * 0.15
    const offsetY = (e.clientY - centerY) * 0.15
    setPaperOffsets((prev) => {
      const next = [...prev]
      next[index] = { x: offsetX, y: offsetY }
      return next
    })
  }

  function handlePaperMouseLeave(_e: React.MouseEvent<HTMLDivElement>, index: number) {
    setPaperOffsets((prev) => {
      const next = [...prev]
      next[index] = { x: 0, y: 0 }
      return next
    })
  }

  const folderStyle = {
    '--folder-color': color,
    '--folder-back-color': folderBackColor,
    '--paper-1': paper1,
    '--paper-2': paper2,
    '--paper-3': paper3,
  } as React.CSSProperties

  const folderClassName = `folder ${open ? 'open' : ''}`.trim()
  // `transform: scale()` never shrinks the box model, only what's painted
  // inside it - the unscaled 100x80px layout footprint stays exactly that
  // size regardless of `size`. `transformOrigin: top left` anchors the
  // shrink to this element's own top-left corner instead of its center, so
  // a caller that wraps this in a smaller fixed-size container (as the
  // document folder cards do) gets the scaled-down folder flush against
  // that corner instead of centered with a confusing gap on two sides.
  const scaleStyle: React.CSSProperties = { transform: `scale(${size})`, transformOrigin: 'top left' }

  const interactiveProps = interactive
    ? {
        onClick: handleClick,
        onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick()
          }
        },
        tabIndex: 0,
        role: 'button' as const,
        'aria-expanded': open,
        'aria-label': open ? 'Close folder' : 'Open folder',
      }
    : {}

  return (
    <div style={scaleStyle} className={className}>
      <div className={folderClassName} style={folderStyle} {...interactiveProps}>
        <div className="folder__back">
          {papers.map((item, i) => (
            <div
              key={i}
              className={`paper paper-${i + 1}`}
              onMouseMove={(e) => handlePaperMouseMove(e, i)}
              onMouseLeave={(e) => handlePaperMouseLeave(e, i)}
              style={
                open
                  ? ({
                      '--magnet-x': `${paperOffsets[i]?.x || 0}px`,
                      '--magnet-y': `${paperOffsets[i]?.y || 0}px`,
                    } as React.CSSProperties)
                  : {}
              }
            >
              {item}
            </div>
          ))}
          <div className="folder__front"></div>
          <div className="folder__front right"></div>
        </div>
      </div>
    </div>
  )
}
