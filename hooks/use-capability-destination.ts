'use client'

/**
 * Turning an AI capability's declared destination into a path THIS user can actually open.
 *
 * Mirrors `usePlatformDestination` exactly, for the same reason: a capability with
 * `accessLink` lives inside the module shell at `/module/{moduleId}/{menuId}/{submenuId}`,
 * built from menu-row ids that differ between deployments — only
 * `useSidebarNavigation().resolveAccessLink()` can turn it into this user's real path,
 * and a profile with no rights to that screen resolves to nothing rather than a 404.
 *
 * Before this hook existed, every caller (the navbar launcher included) used
 * `capabilityHref()` alone, which cannot see `accessLink` at all and always fell back to
 * the generic `/ai/<slug>` description page — so "Agent Management" never opened the
 * real Agentic AI module, only explained it.
 */

import { useCallback } from 'react'

import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { capabilityHref, type AiCapability } from '@shared/ai-intelligence-core'

export interface CapabilityDestinationResult {
  /** Where the entry should navigate. Never null — worst case, the capability's own page. */
  href: string
  /** Whether that href is the real screen rather than the explanatory page. */
  isRealScreen: boolean
}

export function useCapabilityDestination(): (capability: AiCapability) => CapabilityDestinationResult {
  const { resolveAccessLink } = useSidebarNavigation()

  return useCallback(
    (capability: AiCapability): CapabilityDestinationResult => {
      if (capability.accessLink) {
        const resolved = resolveAccessLink(capability.accessLink)

        // '/dashboard' is resolveAccessLink's way of saying "you cannot see that
        // screen" — see usePlatformDestination's identical note.
        if (resolved && resolved !== '/dashboard') {
          return { href: resolved, isRealScreen: true }
        }

        return { href: capabilityHref(capability), isRealScreen: false }
      }

      return { href: capabilityHref(capability), isRealScreen: capability.href !== undefined }
    },
    [resolveAccessLink],
  )
}
