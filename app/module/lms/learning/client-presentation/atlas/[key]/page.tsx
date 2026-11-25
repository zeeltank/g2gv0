'use client'

import { Suspense } from 'react'
import { notFound, useParams } from 'next/navigation'

import { ProtectedLayout } from '@/components/auth/protected-layout'
import AtlasScene from '@/components/domain/lms/client-presentation/scenes/atlas-scenes'
import { ATLAS_PLAN } from '@/lib/client-presentation/atlas'
import { DECKS, slideByN } from '@/lib/client-presentation/deck'

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
      <div className="cp-root" style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080 }} data-atlas-ready="1">
        <div className="cp-frame">
          <AtlasScene deck={deck} slide={slide} beat={0} beats={plan.beats} entry="jump" reduced={false} short={false} nav={{ detour: () => {}, goto: () => {}, returnBack: () => {}, canReturn: false }} />
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
