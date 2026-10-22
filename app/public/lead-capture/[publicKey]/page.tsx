'use client'

/** Public, unauthenticated web-to-lead form - /public/lead-capture/[publicKey]. No ProtectedLayout, no sidebar, same convention /login uses. */

import { useParams } from 'next/navigation'
import { LeadCaptureForm } from '@/components/public/lead-capture-form'

export default function PublicLeadCaptureRoute() {
  const params = useParams<{ publicKey: string }>()
  const publicKey = params?.publicKey ?? ''

  return <LeadCaptureForm publicKey={publicKey} />
}
