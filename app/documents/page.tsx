'use client'

import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgAppShell } from '@/components/shell/gtg-app-shell'
import { DocumentLibraryView } from '@/components/domain/documents/document-library-view'

export default function DocumentsPage() {
  return (
    <ProtectedLayout>
      <GtgAppShell initialActive={{ moduleId: 'documents', menuId: 'documents', submenuId: 'documents' }}>
        <DocumentLibraryView />
      </GtgAppShell>
    </ProtectedLayout>
  )
}
