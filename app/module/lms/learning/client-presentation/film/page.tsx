'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

import { ProtectedLayout } from '@/components/auth/protected-layout'
import { FilmPlayer } from '@/components/domain/lms/client-presentation/film/film-player'

/**
 * The 59-second film on its own page. The renderer opens it at 1920 x 1080 with ?render=1 and steps the timeline; a person can watch it
 * here too (it loops with ?loop=1, shows its last frame with ?still=1).
 */
function Film() {
  const search = useSearchParams()
  const render = search?.get('render') === '1'
  return (
    <div className="fixed inset-0 z-[60] bg-[#02080f]">
      <FilmPlayer autoplay={!render && search?.get('still') !== '1'} expose={render} loop={search?.get('loop') === '1'} />
    </div>
  )
}

// Same sign-in rule as the deck. The film holds no personal or tenant data.
export default function FilmPage() {
  return (
    <ProtectedLayout>
      <Suspense fallback={null}>
        <Film />
      </Suspense>
    </ProtectedLayout>
  )
}
