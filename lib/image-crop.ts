/**
 * THE CROP MATHS, ON ITS OWN, SO IT CAN BE TESTED.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS IS A SEPARATE FILE WITH NO REACT IN IT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A cropper has exactly one way to betray somebody: the picture they framed and
 * the picture that gets saved are not the same picture. Every other defect is
 * visible while you use it; that one is only visible afterwards, on somebody
 * else's screen.
 *
 * The guard against it is that the on-screen preview and the exported file are
 * produced by THE SAME FUNCTION at two different sizes. `placement()` below is
 * that function. It takes no canvas and no DOM, so it can be run in a plain
 * script and checked numerically — which is the only way to know the maths is
 * right without a browser.
 *
 * ── THE COORDINATE SYSTEM, WHICH IS THE WHOLE TRICK ─────────────────────────
 *
 * The pan offset is stored as a FRACTION of the frame, not in pixels. A 288px
 * on-screen frame and a 512px exported frame then share one number: dragging 14
 * screen pixels is `14/288` of the frame either way, and the export needs no
 * conversion and no scale factor of its own. Storing pixels is how a preview and
 * an export drift apart by exactly the ratio between them.
 */

export type Offset = { x: number; y: number }

/** Where the image sits inside a square frame of `frame` pixels. */
export type Placement = {
  /** Destination rectangle, in frame pixels. Can be negative — it overhangs. */
  x: number
  y: number
  width: number
  height: number
}

/**
 * The scale at which the image exactly COVERS a square frame.
 *
 * `max`, not `min`: a frame with an empty corner is not a crop, it is a mistake
 * that somebody will only notice once the avatar is on screen beside their name.
 * Covering means the shortest side touches the frame and the longer one overhangs
 * — which is precisely the overhang the person then pans through.
 */
export function coverScale(naturalWidth: number, naturalHeight: number, frame: number): number {
  if (naturalWidth <= 0 || naturalHeight <= 0) return 1

  return Math.max(frame / naturalWidth, frame / naturalHeight)
}

/**
 * How far the offset may travel before a corner would go empty.
 *
 * Half the overhang, expressed as a fraction of the frame. At zoom 1 with a
 * square image this is 0 in both axes — there is nothing to pan, and the UI
 * should say so rather than accept a drag that does nothing.
 */
export function panLimit(
  naturalWidth: number,
  naturalHeight: number,
  frame: number,
  zoom: number,
): Offset {
  const scale = coverScale(naturalWidth, naturalHeight, frame) * zoom
  const width = naturalWidth * scale
  const height = naturalHeight * scale

  return {
    x: Math.max(0, (width - frame) / 2 / frame),
    y: Math.max(0, (height - frame) / 2 / frame),
  }
}

/** Keeps an offset inside `panLimit`, so the frame can never show a gap. */
export function clampOffset(
  offset: Offset,
  naturalWidth: number,
  naturalHeight: number,
  frame: number,
  zoom: number,
): Offset {
  const limit = panLimit(naturalWidth, naturalHeight, frame, zoom)

  return {
    x: Math.min(limit.x, Math.max(-limit.x, offset.x)),
    y: Math.min(limit.y, Math.max(-limit.y, offset.y)),
  }
}

/**
 * The destination rectangle to draw the image into, for a frame of any size.
 *
 * Called twice per crop with the same `zoom` and `offset` and two different
 * `frame` values — the on-screen preview and the exported file. That is what
 * makes the two provably identical rather than hopefully similar.
 */
export function placement(
  naturalWidth: number,
  naturalHeight: number,
  frame: number,
  zoom: number,
  offset: Offset,
): Placement {
  const safe = clampOffset(offset, naturalWidth, naturalHeight, frame, zoom)
  const scale = coverScale(naturalWidth, naturalHeight, frame) * zoom
  const width = naturalWidth * scale
  const height = naturalHeight * scale

  return {
    x: (frame - width) / 2 + safe.x * frame,
    y: (frame - height) / 2 + safe.y * frame,
    width,
    height,
  }
}

/**
 * The output format.
 *
 * ── WHY NOT ALWAYS JPEG ─────────────────────────────────────────────────────
 *
 * A logo is very often a PNG with a transparent background. JPEG has no alpha, so
 * exporting one as JPEG fills the transparency with black — a company logo
 * arrives as a black square with white letters in it. PNG is kept for PNG input
 * for exactly that reason, and the size cost is bounded because the output is
 * only ever a few hundred pixels square.
 *
 * ── GIF LOSES ITS ANIMATION, AND THE UI SAYS SO ─────────────────────────────
 *
 * A canvas holds one frame. There is no honest way to crop an animated GIF and
 * keep it animated here, so it becomes a PNG and the screen tells the person
 * before they commit rather than after.
 */
export function outputType(inputType: string): { mime: string; extension: string } {
  if (inputType === 'image/png' || inputType === 'image/gif') {
    return { mime: 'image/png', extension: 'png' }
  }

  if (inputType === 'image/webp') {
    return { mime: 'image/webp', extension: 'webp' }
  }

  return { mime: 'image/jpeg', extension: 'jpg' }
}
