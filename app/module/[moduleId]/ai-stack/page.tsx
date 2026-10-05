'use client'

/**
 * `/module/{moduleId}/ai-stack` — a module's own AI Stack, reached from that module.
 *
 * WHY A ROUTE UNDER `/module/` AND NOT A QUERY PARAMETER
 *
 * `ai-stack` is a STATIC segment, so it wins over the `[menuId]` dynamic sibling beside it
 * and this page is matched before the catch-all module screen ever sees the path. Nothing
 * about module resolution therefore depends on a menu row existing for it — which matters,
 * because this page is not a menu row and must not have to be one.
 *
 * The module id in the path is the `tblmenumaster_g2g` level-1 row id, the same id the
 * sidebar hands `GtgAppShell` for every other module screen. `initialActive` therefore
 * needs no new prop and the sidebar highlights the module the stack belongs to.
 *
 * WHY THE OLD PAGE STAYS
 *
 * `/platform-services/ai-stack` is the centralised Platform Services entry point and keeps
 * its module picker. Nothing here replaces it; a module simply has a shorter, unambiguous
 * way in now. See `module-ai-stack-console.tsx` for what this page deliberately omits.
 */

import { use } from 'react'

import { GtgAppShell } from '@/components/shell/gtg-app-shell'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { ModuleAiStackConsole } from '@/components/ai-stack/module-ai-stack-console'

export default function ModuleAiStackPage({ params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = use(params)

  /*
   * The module's own row, the same triple the sidebar records for a module landing page.
   * `GtgAppShell`'s URL sync cannot resolve this path (it is not a menu row), and its
   * fallback would otherwise highlight whichever module happens to be first in the
   * tree — so the correct module is seeded here instead.
   */
  const initialActive = { moduleId, menuId: moduleId, submenuId: moduleId }

  return (
    <ProtectedLayout>
      <GtgAppShell initialActive={initialActive}>
        <ModuleAiStackConsole moduleId={moduleId} />
      </GtgAppShell>
    </ProtectedLayout>
  )
}
