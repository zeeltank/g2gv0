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
 * `max`, not `min`: covering means the SHORTEST side touches the frame and the
 * longer one overhangs, which is precisely the overhang the person then pans
 * through.
 *
 * This is the reference point rather than a floor. `zoom` multiplies it, so zoom 1
 * covers and anything below shows bare frame — see `containZoom`, which exists
 * because treating this as the minimum made a wide logo impossible to fit.
 */
export function coverScale(naturalWidth: number, naturalHeight: number, frame: number): number {
  if (naturalWidth <= 0 || naturalHeight <= 0) return 1

  return Math.max(frame / naturalWidth, frame / naturalHeight)
}

/**
 * The zoom at which the WHOLE image just fits inside the frame.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE FLOOR USED TO BE 1, AND 1 IS ALREADY A CROP
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `zoom` multiplies `coverScale`, so zoom 1 means "the short side exactly fills
 * the frame" — which for anything not square is ALREADY cropped, with the long
 * side overhanging at both ends. The first version of this cropper would not go
 * below 1, so a 1000x300 logo opened showing its middle 300x300 and there was no
 * way to make the whole thing fit. Reported as, exactly, "the image is too big to
 * fit".
 *
 * At this zoom the LONG side fills the frame instead, and nothing is cut off:
 *
 *     containZoom = min(w, h) / max(w, h)
 *
 * 1 for a square, 0.3 for that 1000x300 logo, 0.75 for a 4:3 photo. Below it the
 * image sits inside the frame with room to spare, which is what a logo that needs
 * breathing space wants.
 */
export function containZoom(naturalWidth: number, naturalHeight: number): number {
  if (naturalWidth <= 0 || naturalHeight <= 0) return 1

  return Math.min(naturalWidth, naturalHeight) / Math.max(naturalWidth, naturalHeight)
}

/**
 * Whether the image fills the frame completely at this zoom.
 *
 * True at zoom >= 1, by the definition of `coverScale`. Below that there is bare
 * frame around the image — legitimate, and it is what decides whether the export
 * has to keep an alpha channel.
 */
export function covers(zoom: number): boolean {
  return zoom >= 1
}

/**
 * How far the offset may travel.
 *
 * TWO REGIMES, where the first version had only one:
 *
 *   zoom >= 1   the image overhangs. The limit is half the overhang, so panning
 *               moves through the hidden part and never opens a gap.
 *   zoom < 1    the image is SMALLER than the frame. The limit is half the
 *               shortfall, so it can be placed anywhere inside the frame without
 *               being pushed out of it.
 *
 * `Math.abs` serves both. It was `Math.max(0, ...)`, which pinned a
 * smaller-than-frame image to the centre — defensible while zooming out was
 * impossible, meaningless now that zooming out is the point.
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
    x: Math.abs(width - frame) / 2 / frame,
    y: Math.abs(height - frame) / 2 / frame,
  }
}

/**
 * Keeps an offset inside `panLimit`.
 *
 * Above zoom 1 that means the frame can never show a gap. Below it, it means the
 * image can never be pushed out of the frame. Two different guarantees from one
 * clamp, because `panLimit` already distinguishes the regimes.
 */
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
export function outputType(
  inputType: string,
  /**
   * Whether the image fills the frame. When it does not, the rest of the frame is
   * BARE, and the format has to be able to say so.
   *
   * JPEG has no alpha, so exporting a zoomed-out logo as JPEG turns the space
   * around it black - the crop meant to stop the logo being cut off would instead
   * hand back a black square with the logo floating in it. An uncovered frame is
   * therefore always PNG, whatever came in.
   */
  frameFilled = true,
): { mime: string; extension: string } {
  if (!frameFilled) {
    return { mime: 'image/png', extension: 'png' }
  }

  if (inputType === 'image/png' || inputType === 'image/gif') {
    return { mime: 'image/png', extension: 'png' }
  }

  if (inputType === 'image/webp') {
    return { mime: 'image/webp', extension: 'webp' }
  }

  return { mime: 'image/jpeg', extension: 'jpg' }
}
