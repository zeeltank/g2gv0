import { notFound } from 'next/navigation'

import { PublicPlayer } from '@/components/domain/lms/client-presentation/public-player'
import { CLIENT_PRESENTATION_KEYS } from '@/lib/client-presentation/link'
import { readShareConfig, verifyShareToken } from '@/lib/client-presentation/share-token'

// Every request is checked, so a revoked or expired link stops working at once and no copy of the deck page is ever served from a cache.
export const dynamic = 'force-dynamic'

/**
 * A client presentation for someone who is not signed in. It is NOT a way round sign-in: it is a separate address that opens ONE deck,
 * only with a link signed by the server's secret (lib/client-presentation/share-token.ts), and it sets no cookie and creates no session.
 * The signed-in page under /module is unchanged and still behind sign-in.
 *
 * Every refusal (no secret configured, no link, forged, expired, revoked, a link for another deck, an unknown deck) is the same plain
 * 404, so a caller cannot tell which of them it hit and an unconfigured server shows nothing at all.
 */
export default async function PublicPresentationPage({
  params,
  searchParams,
}: {
  params: Promise<{ product: string }>
  searchParams: Promise<{ k?: string | string[] }>
}) {
  const { product } = await params
  const { k } = await searchParams
  const { secret, revoked } = readShareConfig()
  const known = (CLIENT_PRESENTATION_KEYS as readonly string[]).includes(product)
  if (!known || !verifyShareToken(k, product, secret, { revoked }).ok) notFound()
  return <PublicPlayer productKey={product} />
}
