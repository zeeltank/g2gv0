import { ImageResponse } from 'next/og'

/*
 * The browser-tab favicon — not a separate mark, the same tile
 * `GtgBrandMark` (components/shell/gtg-brand-mark.tsx) renders in the
 * sidebar: a rounded `--primary` square with "G2G" in bold on top. Next.js's
 * file convention (a default export from `app/icon.tsx`) picks this up and
 * wires the `<link rel="icon">` tag into every page automatically — nothing
 * to add in layout.tsx.
 *
 * Can't reference `var(--primary)` here — Satori (what ImageResponse renders
 * through) has no DOM/CSSOM, so custom properties never resolve; the same
 * reason app/api/talent/poster/route.tsx loads its own font file instead of
 * trusting a CSS font-family. The literal below is globals.css's light-mode
 * `--primary` (hsl(221 83% 53%)) copied in by value — a favicon has no theme
 * to switch with, so there's no "dark-mode version" to also keep in sync.
 */
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'hsl(221 83% 53%)',
          borderRadius: 7,
          color: '#fff',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '-0.5px',
        }}
      >
        G2G
      </div>
    ),
    { ...size },
  )
}
