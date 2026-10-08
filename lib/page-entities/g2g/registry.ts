import { accountService } from '@/services/account'

import type { EntityProvider } from '../types'
import { documentLibraryProvider, type G2gEntityApp } from './documents'

/**
 * G2G's page-entity providers, wired to G2G's own services. Add a kind of record by adding a
 * provider here - the resolver, the answer shape and the chat UI are shared.
 */
export function createG2gEntityProviders(): Array<EntityProvider<G2gEntityApp>> {
  return [
    documentLibraryProvider({
      search: (context, filters) => accountService.searchDocuments(context, filters),
    }),
  ]
}
