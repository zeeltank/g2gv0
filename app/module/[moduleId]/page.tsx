'use client'

import { GtgAppShell } from '@/components/shell/gtg-app-shell'
import { ProtectedLayout } from '@/components/auth/protected-layout'

/**
 * THE MODULE ROOT — /module/{moduleId}, with no menu or submenu after it.
 *
 * This route did not exist. Its two deeper siblings did:
 *
 *   app/module/[moduleId]/[menuId]/page.tsx              /module/x/y    OK
 *   app/module/[moduleId]/[menuId]/[submenuId]/page.tsx  /module/x/y/z  OK
 *   (nothing here)                                       /module/x      404
 *
 * In the App Router a dynamic directory without a page.tsx produces no route at
 * all, so every link that stopped at the module root - the sidebar's own module
 * headings among them - fell through to the framework's 404. The module was not
 * broken and its data was fine; there was simply no page at that depth.
 *
 * It renders the same shell as its siblings because the shell is what reads the
 * route and resolves the content. Nothing here needs to know which module it is.
 */
export default function ModuleRootPage() {
  return (
    <ProtectedLayout>
      <GtgAppShell />
    </ProtectedLayout>
  )
}
