'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

import { deckStart } from '@/lib/client-presentation/start'

import { ClientPresentation } from './client-presentation'

/**
 * The deck for a visitor who is not signed in, reached only through a checked share link (app/present/[product]/page.tsx, which
 * has already said yes to this exact deck before this renders). No presenter window and no ?embed: the presenter notes are not in
 * this bundle at all (lib/client-presentation/presenter-deck.ts is never imported from here), and there is no parent frame to report to.
 */
function Player({ productKey }: { productKey: string }) {
  const search = useSearchParams()
  return <ClientPresentation productKey={productKey} {...deckStart(search)} embedded={false} presenter={false} />
}

export function PublicPlayer({ productKey }: { productKey: string }) {
  return (
    <Suspense fallback={null}>
      <Player productKey={productKey} />
    </Suspense>
  )
}
