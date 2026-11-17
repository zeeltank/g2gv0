'use client'

import type { ReactNode } from 'react'
import type { ProviderCard, Tone } from '@/lib/signals/connector-settings'
import { PlatformFacebookIcon, PlatformInstagramIcon, PlatformLinkedInIcon, PlatformYouTubeIcon } from './platform-icons'

export const TONE_TEXT: Record<Tone, string> = {
  success: 'text-emerald-600',
  warning: 'text-amber-600',
  danger: 'text-destructive',
  info: 'text-primary',
  muted: 'text-muted-foreground',
}

const TONE_CHIP: Record<Tone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
  warning: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
  danger: 'border-destructive/30 bg-destructive/5 text-destructive',
  info: 'border-primary/25 bg-primary/5 text-primary',
  muted: 'border-border bg-muted/40 text-muted-foreground',
}

/** The one status look used everywhere in Connector Settings: a small rounded label, never a coloured block. */
export function StatusChip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${TONE_CHIP[tone]}`}>{children}</span>
}

const ICONS: Record<ProviderCard['key'], { icon: (props: { className?: string }) => ReactNode; tile: string }> = {
  youtube: { icon: PlatformYouTubeIcon, tile: 'bg-red-50 text-[#ff0000] border-red-100' },
  linkedin: { icon: PlatformLinkedInIcon, tile: 'bg-blue-50 text-[#0077b5] border-blue-100' },
  facebook_page: { icon: PlatformFacebookIcon, tile: 'bg-blue-50 text-[#1877f2] border-blue-100' },
  instagram_business: { icon: PlatformInstagramIcon, tile: 'bg-pink-50 text-[#e1306c] border-pink-100' },
}

export function ProviderIcon({ card }: { card: ProviderCard }) {
  const { icon: Icon, tile } = ICONS[card.key]
  return (
    <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${tile}`}>
      <Icon className="size-5" />
    </span>
  )
}
