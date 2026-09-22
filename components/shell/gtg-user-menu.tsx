'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, ChevronDown, LogOut, Settings, User } from 'lucide-react'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { platformMeService } from '@/services/platform/me'
import { useAuth } from '@/hooks/use-auth'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAppPreferences } from '@/components/providers/preferences-provider'

/**
 * THE AVATAR MENU — one implementation, where there were two.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE EXISTS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `gtg-header.tsx` and `gtg-header-base.tsx` each carried a private
 * `UserProfileMenu`, identical apart from whitespace and one icon size that had
 * already drifted (`size-4` in one, `size-5` in the other). Every change had to
 * be made twice, and the notification bell proves what happens when it is not:
 * the same dead control shipped in both copies.
 *
 * ── ACCOUNT SETTINGS IS BACK, BECAUSE IT NOW EXISTS ─────────────────────────
 *
 * It was removed for a good reason: it sat beside "My Profile" as a second entry
 * with its own icon, and the click handler sent BOTH of them to `/profile`. Two
 * labels, one destination, and no settings screen to be the difference.
 *
 * There is now a difference. `/profile` shows your employment record; `/settings`
 * is where you change your own password, theme, notifications and sessions — and
 * for an administrator, the organisation's settings.
 *
 * ── MODULE CONFIGURATION IS NO LONGER A SEPARATE ENTRY ──────────────────────
 *
 * It is a section INSIDE Settings now, so listing it here as a sibling would put
 * two doors to the same room in a five-item menu. `/settings/module-configuration`
 * still resolves — it is linked from the setup wizard and from the module cards,
 * and quietly breaking a bookmarked URL to tidy a menu is not an improvement.
 */
export function GtgUserMenu() {
  const router = useRouter()
  const { user, logout } = useAuth()
  /*
   * THE HEADER NOW SHOWS THE PHOTO.
   *
   * It rendered initials and nothing else, so uploading a picture in Settings
   * updated the profile screen and no other surface in the product — which
   * reads as "the upload is not working". It was working; there was simply
   * nowhere else that displayed it.
   *
   * The provider holds the profile app-wide and Settings calls its `refresh()`
   * after an upload, so the new picture appears here immediately rather than on
   * the next full page load.
   */
  const { profile } = useAppPreferences()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  /*
   * CLOSING IT WITHOUT A MOUSE.
   *
   * The only dismissal path was the mousedown listener below - no Escape, no
   * keyboard exit at all. A popup that a mouse can close and a keyboard cannot
   * is a trap: somebody who opens it by pressing Enter on the avatar has no way
   * out except Tab-ing through every item in it.
   *
   * Escape also returns focus to the trigger, so the person is put back where
   * they were rather than at the top of the document.
   */
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return

      setOpen((wasOpen) => {
        if (wasOpen) triggerRef.current?.focus()
        return false
      })
    }

    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  /*
   * "Create an organisation" appears only for platform owners.
   *
   * It is not in tblmenumaster_g2g and must not be: the menu catalogue is the
   * CUSTOMER'S navigation, and this is an internal operator's screen that acts
   * above every tenant. So it hangs here, off a fact the server reports.
   *
   * A failed check hides the entry. That is the safe direction - a network
   * hiccup costs an operator one extra step, whereas defaulting to visible
   * would show every administrator a door that answers 404.
   */
  const [isPlatformOwner, setIsPlatformOwner] = useState(false)

  useEffect(() => {
    const context = getLaravelContext(user)

    if (!isLaravelContextReady(context)) return

    let active = true

    queueMicrotask(() => {
      platformMeService
        .get(context)
        .then((response) => {
          if (active) setIsPlatformOwner(Boolean(response.data?.is_platform_owner))
        })
        .catch(() => {
          if (active) setIsPlatformOwner(false)
        })
    })

    return () => {
      active = false
    }
  }, [user])

  const items = [
    { id: 'profile', label: 'My Profile', icon: User, href: '/settings?s=profile' },
    { id: 'settings', label: 'Account Settings', icon: Settings, href: '/settings' },
    ...(isPlatformOwner
      ? [
          {
            id: 'new-organization',
            label: 'Create an organisation',
            icon: Building2,
            href: '/platform/organizations/new',
          },
        ]
      : []),
  ]

  const userInitials =
    user?.name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'AM'

  return (
    <div className="relative" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md py-1 pr-2 pl-1 transition-colors duration-200 outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
      >
        {/*
          THE SAME AVATAR BUG AS THE PROFILE SECTION, IN THE MORE VISIBLE PLACE.
          ───────────────────────────────────────────────────────────────────
          `profile?.image_url ? <img> : <initials>` asks whether a URL EXISTS,
          not whether the image LOADS. Every upload writes a new key
          (`<id>_<random>.<ext>`), so a URL from an `/account/me` response that
          predates a change — or an object removed from storage — rendered a bare
          `<img>` with `alt=""`: an empty circle in the top bar, on every page,
          with no initials to fall back to.

          `AvatarImage` swaps to the fallback on the load error instead, so the
          worst case is the initials rather than a hole in the nav bar.

          `aria-hidden` stays on the whole thing: the button already names the
          person in the text beside it, so announcing the avatar as well would
          read the same name twice.
        */}
        <Avatar className="size-8 shrink-0" aria-hidden="true">
          <AvatarImage src={profile?.image_url ?? undefined} alt="" />
          <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
            {userInitials}
          </AvatarFallback>
        </Avatar>
        <span className="hidden flex-col items-start leading-tight md:flex">
          <span className="text-sm font-semibold text-foreground">{user?.name}</span>
          <span className="text-xs text-muted-foreground">{user?.role}</span>
        </span>
        <ChevronDown className="hidden size-4 text-muted-foreground md:block" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
        >
          <div className="border-b border-border px-3 py-3">
            <p className="text-sm font-semibold text-foreground">{user?.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>

          <div className="p-1">
            {items.map((item) => {
              const Icon = item.icon

              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false)
                    router.push(item.href)
                  }}
                  className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors duration-200 outline-none hover:bg-secondary hover:text-secondary-foreground focus-visible:bg-secondary"
                >
                  <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                  {item.label}
                </button>
              )
            })}
          </div>

          <div className="border-t border-border p-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                logout()

                /*
                 * A HARD NAVIGATION, NOT `router.push`.
                 *
                 * `router.push` is a client-side route change: the root layout is
                 * never unmounted, so every provider above the router keeps its
                 * state. That is what let one person's cached `/account/me`
                 * payload survive into the next person's session and show their
                 * name and photo on somebody else's profile.
                 *
                 * `PreferencesProvider` now resets on a session change and would
                 * handle this on its own. This stays as well, deliberately: it
                 * guarantees that NOTHING in memory survives a sign-out, including
                 * state in some provider nobody thought to reset. Belt and braces
                 * on the one action where leaking across users matters most, and
                 * the cost is a page load somebody is leaving anyway.
                 */
                window.location.assign('/login')
              }}
              className="flex w-full items-center gap-2.5 rounded-md bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive transition-colors duration-200 outline-none hover:bg-destructive/20 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LogOut className="size-4" aria-hidden="true" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
