import { cn } from '@/lib/utils'

/** Renders an MDI icon class (e.g. "mdi mdi-domain") coming straight from tblmenumaster_g2g.icon. */
export function IconGlyph({ icon, className }: { icon?: string | null; className?: string }) {
  if (!icon) return null
  return <i className={cn(icon, className)} aria-hidden="true" />
}
