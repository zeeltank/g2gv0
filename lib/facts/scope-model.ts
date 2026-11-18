import type { PageTab } from '@/components/shared/scaffolds/page-tabs'

/**
 * The scope switch of the Contacts list (`?scope=suggestions`). Pure, so a link such as `?scope=suggestions` is proved to read back the way it was written.
 * The first scope is the default and keeps the plain address: today's list, unchanged.
 */
export const CONTACT_SCOPE_IDS = ['contacts', 'suggestions'] as const
export type ContactScope = (typeof CONTACT_SCOPE_IDS)[number]
export const CONTACT_SCOPE_PARAM = 'scope'

/**
 * The tabs of the switch. The Contacts scope carries no count: its own list already says how many contacts there are. The Suggestions count is how many
 * facts wait for a person across the organisation; null until it has been read (or when it cannot be), so nothing is guessed before then.
 */
export function contactScopeTabs(waiting: number | null): PageTab[] {
  return [
    { id: 'contacts', label: 'Contacts' },
    { id: 'suggestions', label: 'Suggestions', count: waiting },
  ]
}
