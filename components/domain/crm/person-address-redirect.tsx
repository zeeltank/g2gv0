'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgPageShell } from '@/components/shell/gtg-page-shell'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { getLaravelContext, isLaravelContextReady, type LaravelContext } from '@/lib/laravel-context'
import type { PeopleArea } from '@/lib/org-accounts/links'
import { peopleListTarget, personTarget } from '@/lib/people-redirect'
import { parseOldId } from '@/lib/portfolio-redirect'
import { crmService } from '@/services/crm'
import type { Contact } from '@/types/crm'

/** What the redirect needs of the service: one person by id. A test hands its own. */
export interface PersonLookup {
  getContact: (context: LaravelContext, id: string) => Promise<{ data: Pick<Contact, 'id' | 'organizationId'> | null }>
}

/**
 * A person's old address, /module/crm/{area}/contacts/{id}: reads the person (`GET /crm/contacts/{id}`) and replaces the address with the company's People tab, or with
 * All people when the person has no company. The area the visitor came from is kept. A person who cannot be read (gone, or not this person's to see) is said in words,
 * with a way back to All people; nothing is guessed.
 */
export function PersonAddressRedirect({ area, id, service = crmService }: { area: PeopleArea; id: string; service?: PersonLookup }) {
  const router = useRouter()
  const context = useMemo(() => getLaravelContext(), [])
  const personId = parseOldId(id)
  const [problem, setProblem] = useState('')

  useEffect(() => {
    if (personId === null) { queueMicrotask(() => setProblem('This person could not be found.')); return }
    if (!isLaravelContextReady(context)) { queueMicrotask(() => setProblem('Your ERP session is unavailable. Please sign in again.')); return }
    let active = true
    service.getContact(context, String(personId))
      .then((response) => {
        if (!active) return
        const person = response.data
        const target = person ? personTarget({ id: personId, organizationId: person.organizationId }, area) : null
        if (target) router.replace(target)
        else setProblem('This person could not be found, or you do not have access to them.')
      })
      .catch((cause: unknown) => {
        if (active) setProblem(cause instanceof Error ? cause.message : 'Failed to open this person.')
      })
    return () => { active = false }
  }, [context, service, personId, area, router])

  if (problem) {
    return (
      <div role="alert" className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/10 p-10 text-center text-sm text-destructive">
        <p>{problem}</p>
        <Button variant="outline" size="sm" onClick={() => router.replace(peopleListTarget(area))}>Back to All people</Button>
      </div>
    )
  }
  return (
    <div role="status" className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-10 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      Opening person…
    </div>
  )
}

/** The route page's body: the app shell around the redirect, with the id from the address. The address highlights the Organizations row (see lib/signals-nav.ts). */
export function PersonAddressRoute({ area }: { area: PeopleArea }) {
  const params = useParams<{ id: string }>()
  const { parseRoutePath } = useSidebarNavigation()
  const active = parseRoutePath(`/module/crm/${area}/contacts`) ?? { moduleId: '199', menuId: '', submenuId: '' }
  return (
    <ProtectedLayout>
      <GtgPageShell initialActive={active}>
        <div className="p-4 sm:p-6">
          <PersonAddressRedirect area={area} id={params?.id ?? ''} />
        </div>
      </GtgPageShell>
    </ProtectedLayout>
  )
}
