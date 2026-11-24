'use client'

import { Suspense } from 'react'
import { notFound, useParams, useSearchParams } from 'next/navigation'

import { ProtectedLayout } from '@/components/auth/protected-layout'
import { ClientPresentation } from '@/components/domain/lms/client-presentation/client-presentation'
import { PresenterView } from '@/components/domain/lms/client-presentation/presenter-view'
import { DECK_KEYS } from '@/lib/client-presentation/deck'

function Player() {
  const params = useParams<{ product: string }>()
  const key = String(params?.product ?? '')
  const search = useSearchParams()
  if (!DECK_KEYS.includes(key)) notFound()
  if (search?.get('view') === 'presenter') return <PresenterView productKey={key} />
  const slideParam = Number(search?.get('slide') ?? NaN)
  const initialSlide = Number.isInteger(slideParam) && slideParam >= 1 && slideParam <= 16 ? slideParam : undefined
  const beatParam = Number(search?.get('beat') ?? NaN)
  return (
    <ClientPresentation
      productKey={key}
      initialSlide={initialSlide}
      initialBeat={Number.isInteger(beatParam) && beatParam > 0 ? beatParam : undefined}
      mode={search?.get('mode') === 'short' ? 'short' : 'full'}
      embedded={search?.get('embed') === '1'}
    />
  )
}

// The same sign-in rule as every other My Learning page. The deck itself holds no personal or tenant data.
export default function ClientPresentationPage() {
  return (
    <ProtectedLayout>
      <Suspense fallback={null}>
        <Player />
      </Suspense>
    </ProtectedLayout>
  )
}
