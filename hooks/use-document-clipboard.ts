'use client'

import { useState } from 'react'

export interface DocumentClipboardEntry {
  kind: 'document' | 'folder'
  mode: 'cut' | 'copy'
  id: number
  /** For display only — "Paste 'Q3 Report'" rather than a bare id. */
  name: string
}

/**
 * Cut/Copy/Paste clipboard state — plain `useState`, NOT a shared
 * context/singleton. Each of the three document-browsing orchestrators
 * (`document-library-view.tsx` and its two siblings) calls this
 * independently, on purpose:
 *
 *  - They mount on different routes; keeping a clipboard alive across
 *    navigation between them would need a context provider wrapping the
 *    whole app shell, for a feature only these three leaf pages use.
 *  - The main page's own folder tree already spans every department's
 *    folders the caller can see, so cut-here-paste-there within just that
 *    one page already covers the realistic case.
 *  - Matches this feature's own established precedent: the three
 *    orchestrators already duplicate their own small tree-walk helpers
 *    rather than share them, for the same reason.
 */
export function useDocumentClipboard() {
  const [entry, setEntry] = useState<DocumentClipboardEntry | null>(null)

  return {
    entry,
    cut: (kind: DocumentClipboardEntry['kind'], id: number, name: string) => setEntry({ kind, mode: 'cut', id, name }),
    copy: (kind: DocumentClipboardEntry['kind'], id: number, name: string) => setEntry({ kind, mode: 'copy', id, name }),
    clear: () => setEntry(null),
  }
}
