import { useState } from 'react'
import { ContactSection } from '@/components/domain/signals/signal-contact-section'
import type { Opportunity } from '@/services/signals/opportunities'
import { signalReviewService } from '@/services/signal-review/signal-review-service'
import type { SignalCardService } from '@/components/domain/signals/signal-card-actions'

/**
 * The contact box of one signal, with its two actions: ask for a public-web contact search, and reload the signal to show what it found.
 * Neither action touches the signal's status; a failure only shows a message and the signal stays exactly as it was.
 */
export function SignalContactPanel({ signal, service, onChanged, search = signalReviewService.researchContacts }: {
  signal: Opportunity
  service: Pick<SignalCardService, 'get'>
  onChanged: (next: Opportunity) => void
  search?: (id: number) => Promise<{ status: number; message: string }>
}) {
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const onSearch = async () => {
    setBusy(true)
    setNotice(null)
    try {
      const res = await search(signal.id)
      setNotice(res.message)
    } catch (e) {
      setNotice(e instanceof Error && e.message ? e.message : 'The contact search could not be started.')
    } finally {
      setBusy(false)
    }
  }

  const onRefresh = async () => {
    setBusy(true)
    try {
      const res = await service.get(signal.id)
      const next = (res as { data?: Opportunity }).data
      if (next) onChanged(next)
      setNotice(next?.contact?.contacts?.length ? null : 'Nothing found yet. Searching can take a minute.')
    } catch (e) {
      setNotice(e instanceof Error && e.message ? e.message : 'Could not reload the signal.')
    } finally {
      setBusy(false)
    }
  }

  return <ContactSection c={signal.contact} onSearch={onSearch} onRefresh={onRefresh} busy={busy} notice={notice} />
}
