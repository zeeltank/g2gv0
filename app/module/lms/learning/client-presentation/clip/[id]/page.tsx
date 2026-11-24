'use client'

import { Suspense } from 'react'
import { notFound, useParams, useSearchParams } from 'next/navigation'

import { ProtectedLayout } from '@/components/auth/protected-layout'
import { ClipPlayer } from '@/components/domain/lms/client-presentation/clips/clip-player'
import { CLIP_IDS } from '@/lib/client-presentation/clips'

/**
 * One explainer clip on its own page. The video renderer opens it at the exact stage size with ?render=1 and steps the timeline;
 * a person can also open it to watch (?ratio=h for 16:9, ?ui=shown to show the product's own screen name, ?end=0 for no closing card).
 */
function Clip() {
  const params = useParams<{ id: string }>()
  const id = String(params?.id ?? '')
  const search = useSearchParams()
  if (!CLIP_IDS.includes(id)) notFound()
  const render = search?.get('render') === '1'
  return (
    <div className="fixed inset-0 z-[60] bg-[#02080f]">
      <ClipPlayer
        clipId={id}
        ratio={search?.get('ratio') === 'h' ? 'h' : 'v'}
        ui={search?.get('ui') === 'shown' ? 'shown' : 'hidden'}
        endCard={search?.get('end') !== '0'}
        autoplay={!render && search?.get('still') !== '1'}
        expose={render}
      />
    </div>
  )
}

// Same sign-in rule as the deck. A clip holds no personal or tenant data.
export default function ClipPage() {
  return (
    <ProtectedLayout>
      <Suspense fallback={null}>
        <Clip />
      </Suspense>
    </ProtectedLayout>
  )
}
