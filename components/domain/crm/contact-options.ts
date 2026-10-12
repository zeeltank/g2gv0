'use client'

/** Shared "pick a contact" option list - Quote and Opportunity forms both need a flat, searchable, all-contacts picker (not organization-scoped, same as Opportunity's existing AddContactDialog). */

import { useEffect, useState } from 'react'
import { isLaravelContextReady, type LaravelContext } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { Contact } from '@/types/crm'

export function useContactOptions(context: LaravelContext, enabled: boolean): Contact[] {
  const [contacts, setContacts] = useState<Contact[]>([])

  useEffect(() => {
    if (!enabled || !isLaravelContextReady(context)) return
    let active = true

    crmService.getContacts(context, { perPage: 100, sortBy: 'last_name', sortDir: 'asc' })
      .then((response) => { if (active) setContacts(response.data.items) })
      .catch(() => { /* the form still works with an empty picker */ })

    return () => { active = false }
  }, [context, enabled])

  return contacts
}
