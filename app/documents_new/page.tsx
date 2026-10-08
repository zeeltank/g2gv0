'use client';

import { ProtectedLayout } from '@/components/auth/protected-layout';
import { GtgAppShell } from '@/components/shell/gtg-app-shell';
import { IdmsLibrary } from './_components/idms-library';

/**
 * Intelligent Document Management System, mounted at `/documents_new`.
 *
 * Added beside `/documents`, not in place of it: the existing HR document
 * library keeps working unchanged. Access is decided by the backend on every
 * request; nothing on this page is an access control.
 */
export default function DocumentsNewPage() {
  return (
    <ProtectedLayout>
      <GtgAppShell initialActive={{ moduleId: 'documents', menuId: 'documents', submenuId: 'documents_new' }}>
        <IdmsLibrary />
      </GtgAppShell>
    </ProtectedLayout>
  );
}
