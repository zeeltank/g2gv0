'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Maximize2, RotateCcw, ZoomIn } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  clampOffset,
  outputType,
  panLimit,
  placement,
  type Offset,
} from '@/lib/image-crop'

/**
 * POSITION THE PICTURE BEFORE IT IS SAVED.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE COMPLAINT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * "The logo is not fitting, or it is cut."
 *
 * Both avatars in this product are round and both use `object-cover`, which is
 * the correct way to fill a circle and gives the person no say in WHICH part of
 * their picture fills it. A phone photo is 4:3, so a third of it was being
 * discarded — and the browser always discarded the left and right thirds,
 * whatever was actually in them. Somebody whose face is off to one side got a
 * picture of their shoulder, and there was nothing on the screen to do about it.
 *
 * The organisation logo was worse: it did not preview the chosen file at all. You
 * picked a logo, the monogram stayed on screen, and you found out what had been
 * stored on the next page load.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT MAKES THIS TRUSTWORTHY RATHER THAN MERELY PRESENT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A cropper has one way to betray somebody: the picture they framed is not the
 * picture that gets saved. So the preview and the export are produced by the SAME
 * function — `placement()` in `lib/image-crop.ts` — called at two different frame
 * sizes. There is no second code path to drift.
 *
 * That function is pure and has no DOM in it, which is why it can be and is
 * checked numerically: `check-image-crop-math.mjs` asserts that a 288px frame and
 * a 512px frame select the identical region of the source across five aspect
 * ratios and five zoom/pan states, that no combination can open an empty corner,
 * and that zooming in shows less rather than more.
 *
 * ── THE ROTATE BUTTON IS NOT A FEATURE, IT IS A FIX ─────────────────────────
 *
 * Phones write orientation into EXIF rather than rotating the pixels. Browsers
 * honour that when displaying an `<img>`, and `createImageBitmap` does NOT unless
 * asked — so a portrait photo could arrive on its side. The bitmap is decoded
 * with `imageOrientation: 'from-image'` to get it right automatically, and the
 * rotate control is there for the files where the EXIF is absent or lying, which
 * is common enough on images that have been through a chat app.
 *
 * ── AND IT HAS TO WORK WITHOUT A MOUSE ──────────────────────────────────────
 *
 * Drag is the obvious interaction and it is the one a keyboard user does not
 * have. The frame is focusable and takes arrow keys; zoom is a real
 * `<input type="range">` rather than a pair of buttons, because a range input
 * already answers to Home, End, arrows and a screen reader without help.
 */

const FRAME = 288 // The on-screen crop frame, in CSS pixels.
const OUTPUT = 512 // What gets saved. Comfortably sharp for a 40px avatar.
const MAX_ZOOM = 4
const NUDGE = 0.02 // One arrow press, as a fraction of the frame.
const TWO_MB = 2 * 1024 * 1024

export type CroppedImage = { file: File; preview: string }

export function ImageCropper({
  file,
  shape = 'circle',
  title = 'Position your photo',
  onCancel,
  onApply,
}: {
  /** The file the person just picked. Never uploaded as-is. */
  file: File
  /** Matches where the result will be shown, so the frame is not a lie. */
  shape?: 'circle' | 'rounded'
  title?: string
  onCancel: () => void
  onApply: (result: CroppedImage) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const bitmapRef = useRef<ImageBitmap | HTMLImageElement | null>(null)

  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 })
  const [quarterTurns, setQuarterTurns] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /*
   * DECODE ONCE, WITH THE ORIENTATION APPLIED.
   *
   * `imageOrientation: 'from-image'` is what stops a portrait phone photo from
   * arriving on its side. Where `createImageBitmap` is unavailable or refuses the
   * option, an `<img>` element is used instead — browsers apply EXIF orientation
   * to those by default, so the fallback is not a downgrade in that respect.
   */
  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null

    async function load() {
      try {
        if (typeof createImageBitmap === 'function') {
          const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
          if (cancelled) {
            bitmap.close()
            return
          }
          bitmapRef.current = bitmap
          setNatural({ width: bitmap.width, height: bitmap.height })
          return
        }

        objectUrl = URL.createObjectURL(file)
        const image = new Image()
        image.src = objectUrl

        await image.decode()

        if (cancelled) return
        bitmapRef.current = image
        setNatural({ width: image.naturalWidth, height: image.naturalHeight })
      } catch {
        if (!cancelled) {
          setError('That image could not be opened. It may be damaged — try another file.')
        }
      }
    }

    void load()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      const held = bitmapRef.current
      if (held && 'close' in held) held.close()
      bitmapRef.current = null
    }
  }, [file])

  /*
   * A quarter turn swaps the axes, so what the maths calls "natural" has to swap
   * with it. Everything downstream then works on the rotated dimensions without
   * knowing rotation exists.
   *
   * Memoised because `draw` closes over it: a fresh object every render gave
   * `draw` a new identity every render, which repainted the canvas on every
   * keystroke and state change rather than only when the framing actually moved.
   */
  const rotated = useMemo(() => {
    if (!natural) return null

    return quarterTurns % 2 === 0
      ? natural
      : { width: natural.height, height: natural.width }
  }, [natural, quarterTurns])

  /** Draws the current framing into any square canvas. Preview and export both. */
  const draw = useCallback(
    (canvas: HTMLCanvasElement, frame: number) => {
      const image = bitmapRef.current
      if (!image || !rotated) return

      const context = canvas.getContext('2d')
      if (!context) return

      canvas.width = frame
      canvas.height = frame
      context.clearRect(0, 0, frame, frame)

      const spot = placement(rotated.width, rotated.height, frame, zoom, offset)

      // Rotation is applied around the frame's centre, and the placement is then
      // expressed in the rotated frame - which is why `rotated` was swapped above.
      context.save()
      context.translate(frame / 2, frame / 2)
      context.rotate((quarterTurns * Math.PI) / 2)
      context.translate(-frame / 2, -frame / 2)

      // `imageSmoothingQuality` matters here: the export scales a 4000px photo
      // down to 512, and the browser's fast path makes that visibly crunchy.
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'

      context.drawImage(
        image as CanvasImageSource,
        spot.x,
        spot.y,
        spot.width,
        spot.height,
      )
      context.restore()
    },
    [offset, quarterTurns, rotated, zoom],
  )

  // Repaint the preview whenever the framing changes. Not an effect that sets
  // state - it only touches the canvas, which React does not own.
  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) draw(canvas, FRAME)
  }, [draw])

  const limit = rotated ? panLimit(rotated.width, rotated.height, FRAME, zoom) : { x: 0, y: 0 }
  const canPan = limit.x > 0.0001 || limit.y > 0.0001

  /* ── dragging, and pinching, through one pointer model ──────────────────── */
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null)

  function move(dx: number, dy: number) {
    if (!rotated) return

    setOffset((current) =>
      clampOffset(
        { x: current.x + dx, y: current.y + dy },
        rotated.width,
        rotated.height,
        FRAME,
        zoom,
      ),
    )
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    // `setPointerCapture` is what keeps a drag alive when the pointer leaves the
    // frame, which it does constantly when somebody drags to the edge.
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId)
    if (!previous) return

    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const distance = Math.hypot(a.x - b.x, a.y - b.y)

      if (!pinchStart.current) {
        pinchStart.current = { distance, zoom }
        return
      }

      const ratio = distance / (pinchStart.current.distance || 1)
      setZoom(Math.min(MAX_ZOOM, Math.max(1, pinchStart.current.zoom * ratio)))
      return
    }

    // Divided by the frame, because the offset is a fraction of it - the single
    // fact that lets the export reuse this number without conversion.
    move((event.clientX - previous.x) / FRAME, (event.clientY - previous.y) / FRAME)
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size < 2) pinchStart.current = null
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? NUDGE * 4 : NUDGE

    const actions: Record<string, () => void> = {
      ArrowLeft: () => move(step, 0),
      ArrowRight: () => move(-step, 0),
      ArrowUp: () => move(0, step),
      ArrowDown: () => move(0, -step),
      '+': () => setZoom((z) => Math.min(MAX_ZOOM, z + 0.25)),
      '=': () => setZoom((z) => Math.min(MAX_ZOOM, z + 0.25)),
      '-': () => setZoom((z) => Math.max(1, z - 0.25)),
      _: () => setZoom((z) => Math.max(1, z - 0.25)),
    }

    const action = actions[event.key]
    if (!action) return

    // Only now: an unhandled key must keep working (Tab, Escape, Enter).
    event.preventDefault()
    action()
  }

  /*
   * Re-clamp when the zoom drops.
   *
   * Zooming out shrinks the pan room, so an offset that was legal at zoom 3 can
   * be outside the limit at zoom 1 and would open a gap. Adjusted during render
   * rather than in an effect, so the frame is never painted in the illegal state.
   */
  const [clampedFor, setClampedFor] = useState(zoom)

  if (rotated && clampedFor !== zoom) {
    setClampedFor(zoom)
    const safe = clampOffset(offset, rotated.width, rotated.height, FRAME, zoom)
    if (safe.x !== offset.x || safe.y !== offset.y) setOffset(safe)
  }

  function reset() {
    setZoom(1)
    setOffset({ x: 0, y: 0 })
    setQuarterTurns(0)
  }

  async function apply() {
    if (!rotated) return

    setBusy(true)
    setError(null)

    try {
      const canvas = document.createElement('canvas')
      draw(canvas, OUTPUT)

      const chosen = outputType(file.type)

      const blob = await new Promise<Blob | null>((resolve) => {
        // 0.92 rather than the 0.92-ish default: a face at 512px shows JPEG
        // ringing around the eyes below about 0.9, and the file is tiny either way.
        canvas.toBlob((result) => resolve(result), chosen.mime, 0.92)
      })

      if (!blob) {
        setError('The cropped image could not be created. Please try again.')
        return
      }

      /*
       * A PNG of a photograph can be larger than the 2MB the server accepts, even
       * at 512px. Rather than failing after the person has done the work, it falls
       * back to JPEG - which only happens for photographic PNGs, where there is no
       * transparency to lose anyway.
       */
      let finalBlob = blob
      let finalType = chosen

      if (blob.size > TWO_MB && chosen.mime !== 'image/jpeg') {
        const fallback = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((result) => resolve(result), 'image/jpeg', 0.9)
        })

        if (fallback && fallback.size <= TWO_MB) {
          finalBlob = fallback
          finalType = { mime: 'image/jpeg', extension: 'jpg' }
        }
      }

      if (finalBlob.size > TWO_MB) {
        setError('Even cropped, that image is over 2MB. Try zooming in, or use a smaller file.')
        return
      }

      const base = file.name.replace(/\.[^.]+$/, '') || 'photo'
      const cropped = new File([finalBlob], `${base}.${finalType.extension}`, {
        type: finalType.mime,
      })

      onApply({ file: cropped, preview: URL.createObjectURL(finalBlob) })
    } catch {
      setError('The cropped image could not be created. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const isGif = file.type === 'image/gif'

  return (
    <AlertDialog open onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {canPan
              ? 'Drag to move it, and zoom to fill the frame. What you see here is exactly what will be saved.'
              : 'Zoom in if you want to crop closer. What you see here is exactly what will be saved.'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col items-center gap-4">
          {/*
            THE FRAME.

            `touch-none` is required, not cosmetic: without it the browser claims
            the gesture for page scrolling and the drag never reaches this element
            on a phone — the exact device whose photos need cropping most.
          */}
          <div
            role="group"
            aria-label="Crop area. Use the arrow keys to move the image, plus and minus to zoom."
            tabIndex={0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onKeyDown}
            className={cn(
              'relative touch-none overflow-hidden border border-border bg-surface-muted outline-none',
              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              canPan ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
              shape === 'circle' ? 'rounded-full' : 'rounded-2xl',
            )}
            style={{ width: FRAME, height: FRAME }}
          >
            <canvas ref={canvasRef} className="block size-full" />

            {!natural && !error && (
              <span className="absolute inset-0 grid place-items-center">
                <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
              </span>
            )}
          </div>

          {/* The zoom control is a range input so it is keyboard and screen-reader
              accessible without any work on our part. */}
          <label className="flex w-full items-center gap-3">
            <ZoomIn className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Zoom</span>
            <input
              type="range"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              disabled={!natural}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
            />
            <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              {zoom.toFixed(1)}×
            </span>
          </label>

          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setQuarterTurns((turns) => (turns + 3) % 4)}
                disabled={!natural}
                title="Rotate a quarter turn anticlockwise"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Rotate
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={reset}
                disabled={!natural || (zoom === 1 && offset.x === 0 && offset.y === 0 && quarterTurns === 0)}
                title="Back to the whole picture, centred"
              >
                <Maximize2 className="size-4" aria-hidden="true" />
                Reset
              </Button>
            </div>

            {natural && (
              <span className="text-xs text-muted-foreground">
                Saved at {OUTPUT}×{OUTPUT}
              </span>
            )}
          </div>

          {isGif && (
            <p className="w-full text-xs text-muted-foreground">
              An animated GIF is saved as a still image — cropping keeps one frame.
            </p>
          )}

          {error && (
            <p role="alert" className="w-full text-xs text-destructive">
              {error}
            </p>
          )}
        </div>

        <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void apply()} disabled={busy || !natural}>
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {busy ? 'Preparing…' : 'Use this'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
