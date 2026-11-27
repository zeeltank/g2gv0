'use client'

import { Download, ExternalLink, Eye, Loader2, MoreHorizontal, Pencil, Play, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { linkHref, primaryAction, secondaryAction, type KitActionId } from '@/lib/portfolio/sales-kit-model'
import type { KitCan, KitItem } from '@/services/product-master/kit-types'

const ICON: Record<KitActionId, typeof Download> = { 'open-link': ExternalLink, download: Download, preview: Eye, play: Play }

/** What a button of an entry can ask the screen to do. An address is not one of them: it is a real link and opens itself. */
export type KitRun = (action: Exclude<KitActionId, 'open-link'>, item: KitItem) => void

/**
 * The actions of one entry: the main one with its words (an address opens in a new tab as a real link, anything else is a button), and Download beside a preview or a player. Every button's
 * name starts with its visible words and ends with the entry's title, so a list of twenty reads as twenty different things to a screen reader. A file that is gone has none.
 */
export function KitActionButtons({ item, large = false, busy = false, onRun }: { item: KitItem; large?: boolean; busy?: boolean; onRun: KitRun }) {
  const main = primaryAction(item)
  const also = secondaryAction(item)
  if (!main) return null
  const Icon = ICON[main.id]
  const look = large ? { size: 'lg' as const, variant: 'default' as const } : { size: 'sm' as const, variant: 'outline' as const }
  const name = `${main.label}, ${item.title}`
  const href = main.id === 'open-link' ? linkHref(item.url) : null

  return (
    <>
      {main.id === 'open-link' && href
        ? (
          <Button asChild {...look}>
            <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${name} (opens in a new tab)`}><Icon aria-hidden="true" />{main.label}</a>
          </Button>
        )
        : (
          <Button type="button" {...look} disabled={busy} aria-label={name} onClick={() => onRun(main.id as Exclude<KitActionId, 'open-link'>, item)}>
            {busy ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Icon aria-hidden="true" />}
            {main.label}
          </Button>
        )}
      {also && (
        <Button type="button" variant="ghost" size={large ? 'icon' : 'icon-sm'} disabled={busy} aria-label={`${also.label} ${item.title}`} onClick={() => onRun('download', item)}>
          <Download aria-hidden="true" />
        </Button>
      )}
    </>
  )
}

/**
 * What a manager may do to an entry. A file that is gone can only be removed, so it gets that one button, drawn plainly; any other entry gets one menu. Nothing is drawn for a person who
 * may neither edit nor remove.
 */
export function KitManage({ item, can, onEdit, onRemove }: { item: KitItem; can: KitCan; onEdit: (item: KitItem) => void; onRemove: (item: KitItem) => void }) {
  if (item.missing) {
    return can.delete ? <Button type="button" variant="outline" size="sm" aria-label={`Remove ${item.title}`} onClick={() => onRemove(item)}><Trash2 aria-hidden="true" />Remove</Button> : null
  }
  if (!can.edit && !can.delete) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`More actions for ${item.title}`}><MoreHorizontal aria-hidden="true" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {can.edit && <DropdownMenuItem onSelect={() => onEdit(item)}><Pencil className="mr-2 size-4" aria-hidden="true" />Edit details</DropdownMenuItem>}
        {can.delete && <DropdownMenuItem onSelect={() => onRemove(item)}><Trash2 className="mr-2 size-4" aria-hidden="true" />Remove</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
