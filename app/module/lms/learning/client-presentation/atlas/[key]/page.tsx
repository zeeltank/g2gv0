'use client'

import { Suspense } from 'react'
import { notFound, useParams } from 'next/navigation'

import { ProtectedLayout } from '@/components/auth/protected-layout'
import AtlasScene from '@/components/domain/lms/client-presentation/scenes/atlas-scenes'
import { ATLAS_PLAN } from '@/lib/client-presentation/atlas'
import { DECKS, slideByN } from '@/lib/client-presentation/deck'
import { rootVars } from '@/lib/client-presentation/palette'

// The stage styles (.cp-root, .cp-scene[data-theme] colours and backgrounds). Only the player imported them, so a slide opened here for the video renderer fell back
// to the page's dark body text on a plain black ground: the 25 atlas videos rendered before 26 Nov 2026 have near-invisible text because of it.
import '@/components/domain/lms/client-presentation/styles/base.css'

/**
 * One Product Atlas slide on its own at 1920 x 1080, for the video renderer (scripts/client-presentation/render-atlas.mjs): the scene (use-beat-timeline.ts, which recognises this path)
 * builds its whole timeline and hands it to window.__atlasTl, and the renderer steps it by time. A person can open it too (it shows the first state).
 */
function Slide() {
  const params = useParams<{ key: string }>()
  const key = String(params?.key ?? '')
  const plan = ATLAS_PLAN.find((s) => s.key === key)
  if (!plan) notFound()
  const deck = DECKS.scholarclone
  const slide = slideByN(deck, plan.n)
  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-[#02080f]">
      {/* rootVars: the palette the scenes read (--cp-on-ink, --cp-ink ...). The player sets them on its own root; this page did not, so every video rendered
          from it had dark text on a dark ground (found 26 Nov 2026 in the first tour stills; the 25 earlier atlas videos have it). */}
      <div className="cp-root at-render" style={{ ...(rootVars as React.CSSProperties), position: 'absolute', left: 0, top: 0, width: 1920, height: 1080 }} data-atlas-ready="1">
        <div className="cp-frame">
          <AtlasScene deck={deck} slide={slide} beat={0} beats={plan.beats} entry="jump" reduced={false} short={false} nav={{ detour: () => {}, goto: () => {}, returnBack: () => {}, canReturn: false, setBeat: () => {} }} />
        </div>
      </div>
    </div>
  )
}

export default function AtlasSlidePage() {
  return (
    <ProtectedLayout>
      <Suspense fallback={null}>
        <Slide />
      </Suspense>
    </ProtectedLayout>
  )
}
