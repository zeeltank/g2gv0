'use client'

import { Suspense } from 'react'
import { notFound, useParams, useSearchParams } from 'next/navigation'

import { ProtectedLayout } from '@/components/auth/protected-layout'
import { SalesTrainingPlayer } from '@/components/domain/lms/sales-training/sales-training-player'
import { SALES_PRODUCTS, type SalesProductKey } from '@/lib/sales-training/deck'

function Player() {
  const params = useParams<{ product: string }>()
  const key = String(params?.product ?? '')
  const search = useSearchParams()
  const slideParam = Number(search?.get('slide') ?? NaN)
  // ?slide=<n> opens that slide (the study deck's own deep link works the same way).
  const initialSlide = Number.isInteger(slideParam) && slideParam > 0 ? slideParam : undefined
  const embedded = search?.get('embed') === '1'
  if (!SALES_PRODUCTS.some((p) => p.key === key)) notFound()
  return <SalesTrainingPlayer productKey={key as SalesProductKey} initialSlide={initialSlide} embedded={embedded} />
}

export default function SalesTrainingProductPage() {
  return (
    <ProtectedLayout>
      <Suspense fallback={null}>
        <Player />
      </Suspense>
    </ProtectedLayout>
  )
}
