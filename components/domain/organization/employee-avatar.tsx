'use client'

import { useState } from 'react'
import { User } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * ONE EMPLOYEE AVATAR, USED EVERYWHERE THE DIRECTORY SHOWS A PERSON.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS IS A COMPONENT RATHER THAN A COPIED TERNARY
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The directory list and the detail drawer each had their own copy of the same
 * img-or-placeholder ternary, at different sizes. Both were fed `row.image` - a
 * bare stored FILENAME - which a browser resolves against this app's own origin.
 * So every employee with a photo rendered a broken-image box, in two places, and
 * fixing one would have left the other.
 *
 * ── THE `onError` IS THE PART THAT WAS MISSING ──────────────────────────────
 *
 * Neither copy had one. That matters more than it sounds: the ternary commits to
 * the `<img>` the moment a src is non-empty, so once the URL fails there is no
 * path back to the placeholder. The browser shows its own broken-image glyph and
 * the component has no say. Photos live on an object store this app does not
 * control, so a missing object is an ordinary event, not a hypothetical.
 *
 * ── AND THE FALLBACK IS INITIALS, NOT ONE GLYPH FOR EVERYBODY ───────────────
 *
 * 24 of 299 live accounts have a photo. With a single person-icon the other 275
 * were visually identical, which makes a directory harder to scan than plain
 * text would be. The name is already on hand, so initials cost nothing and tell
 * people apart.
 */
export function EmployeeAvatar({
  src,
  name,
  className,
}: {
  /** A servable URL - `image_url` from the API, never the stored filename. */
  src?: string | null
  name?: string | null
  className?: string
}) {
  const [failed, setFailed] = useState(false)

  const initials = (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')

  const usable = !failed && (src ?? '').trim() !== ''

  if (usable) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- object-store URLs are not next/image sources
      <img
        src={src as string}
        alt={name ?? ''}
        onError={() => setFailed(true)}
        className={cn('shrink-0 rounded-full border border-border object-cover', className)}
      />
    )
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary',
        className,
      )}
      /*
       * Not aria-hidden. This is the only thing standing in for a person's photo,
       * so a screen reader should say whose it is rather than skip it entirely.
       */
      role="img"
      aria-label={name ? `${name} (no photo)` : 'No photo'}
      title={name ?? undefined}
    >
      {initials ? (
        <span className="text-xs font-semibold leading-none">{initials}</span>
      ) : (
        <User className="size-1/2" aria-hidden="true" />
      )}
    </div>
  )
}
