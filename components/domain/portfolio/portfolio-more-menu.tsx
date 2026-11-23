'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Download, DownloadCloud, FileUp, MoreHorizontal, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { CRM_RECYCLE_BIN_PATH } from '@/lib/gtg-navigation'
import { getLaravelContext } from '@/lib/laravel-context'
import { IMPORT_HEADER_MAP, importNoun, TEMPLATE_HEADERS } from '@/lib/portfolio-list/import-template'
import type { PortfolioItemType } from '@/services/product-master/portfolio-list-types'
import { crmService } from '@/services/crm'
import { portfolioService } from '@/services/portfolio/portfolio-service'
import { CrmDuplicatesDialog } from '@/components/domain/crm/crm-duplicates-dialog'
import { CrmImportDialog } from '@/components/domain/crm/crm-import-dialog'

/**
 * The More menu of the Product Portfolio list: what the old Products screen kept in its header (Import, Export, Find duplicates, the Recycle Bin) and the
 * Portfolio's own Sync Excel. Each action keeps the endpoint the old screen used (`services/crm` product functions, `portfolioService.triggerImport`).
 *
 * Import, Export and Find duplicates work on ONE item type, as the old Products and Services screens did: Services when the Type filter says Service,
 * Sub-products otherwise. They and the Recycle Bin are for a caller who may view Sell; Sync Excel for the people who manage the Portfolio.
 */
export function PortfolioMoreMenu({ itemType, search, canViewSell, canManage, onChanged, onNotice, onError }: {
  itemType: PortfolioItemType
  search: string
  canViewSell: boolean
  canManage: boolean
  /** The list should read again (something was imported, merged or synced). */
  onChanged: () => void
  onNotice: (text: string) => void
  onError: (text: string) => void
}) {
  const router = useRouter()
  const context = useMemo(() => getLaravelContext(), [])
  const [importOpen, setImportOpen] = useState(false)
  const [duplicatesOpen, setDuplicatesOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const noun = importNoun(itemType)

  // Stable, because the dialog reads its groups again whenever this function changes.
  const getDuplicates = useCallback((ctx: Parameters<typeof crmService.getProductDuplicates>[0]) => crmService.getProductDuplicates(ctx, itemType), [itemType])

  const sync = async () => {
    setSyncing(true)
    try {
      const answer = await portfolioService.triggerImport(context)
      onNotice(`Import complete: ${answer.data.imported} imported, ${answer.data.updated} updated, ${answer.data.skipped} skipped.`)
      onChanged()
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : 'The sync failed.')
    } finally {
      setSyncing(false)
    }
  }

  if (!canViewSell && !canManage) return null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" aria-label="More actions"><MoreHorizontal className="mr-1.5 size-4" aria-hidden="true" />More</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canViewSell && (
            <DropdownMenuItem onSelect={() => setImportOpen(true)}>
              <FileUp className="mr-2 size-4" aria-hidden="true" />Import CSV
            </DropdownMenuItem>
          )}
          {canManage && (
            <DropdownMenuItem disabled={syncing} onSelect={() => void sync()} title="Sync from G2G_Foundation_Data_Portfolio_Partners.xlsx">
              <DownloadCloud className="mr-2 size-4" aria-hidden="true" />{syncing ? 'Syncing…' : 'Sync Excel'}
            </DropdownMenuItem>
          )}
          {canViewSell && (
            <DropdownMenuItem asChild>
              <a href={crmService.productsExportUrl(context, itemType, search || undefined)} data-export-href>
                <Download className="mr-2 size-4" aria-hidden="true" />Export CSV
              </a>
            </DropdownMenuItem>
          )}
          {canViewSell && (
            <DropdownMenuItem onSelect={() => setDuplicatesOpen(true)}>
              <Copy className="mr-2 size-4" aria-hidden="true" />Find duplicates
            </DropdownMenuItem>
          )}
          {canViewSell && (
            <DropdownMenuItem onSelect={() => router.push(CRM_RECYCLE_BIN_PATH)}>
              <Trash2 className="mr-2 size-4" aria-hidden="true" />Recycle Bin
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {canViewSell && (
        <>
          <CrmImportDialog
            isOpen={importOpen}
            onClose={() => setImportOpen(false)}
            noun={noun}
            headerMap={IMPORT_HEADER_MAP}
            templateHeaders={TEMPLATE_HEADERS}
            templateFilename={`${noun}s-template.csv`}
            submitImport={(ctx, rows) => crmService.importProducts(ctx, itemType, rows)}
            onImported={onChanged}
          />
          <CrmDuplicatesDialog
            isOpen={duplicatesOpen}
            onClose={() => setDuplicatesOpen(false)}
            noun={noun}
            getDuplicates={getDuplicates}
            merge={crmService.mergeProducts}
            getLabel={(row) => (row.name as string) ?? 'Unnamed'}
            getSubLabel={(row) => (row.sku as string | null) ?? (row.productNo as string | null)}
            onMerged={onChanged}
          />
        </>
      )}
    </>
  )
}
