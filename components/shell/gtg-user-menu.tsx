'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2,
  ChevronDown,
  LogOut,
  Settings,
  Sparkles,
  User,
  type LucideIcon,
} from 'lucide-react'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { platformMeService } from '@/services/platform/me'
import { useAuth } from '@/hooks/use-auth'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAppPreferences } from '@/components/providers/preferences-provider'
import { AI_CAPABILITIES } from '@shared/ai-intelligence-core'
import { PLATFORM_MENU_SECTION } from '@shared/platform-services-core'
import { platformServiceIcon } from '@/lib/platform/icons'
import { usePlatformDestination } from '@/hooks/use-platform-destination'
import { ROLE_GROUPS } from '@/types/role'

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
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * IT IS A PANEL NOW, NOT A COLUMN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * AI & Intelligence alone made this a 15-row scrolling list. Platform Services and
 * Setup & Configuration add twelve more, and 27 rows in a 288px column is not a menu
 * anybody reads — it is a list you scroll hunting for a word.
 *
 * So the sections lay out side by side in fixed 220px columns, which is the width at
 * which the longest label in the three lists still fits on one line. Below the `sm`
 * breakpoint everything stacks, since three columns do not fit a phone at any useful
 * width — which is also why a section's span is applied only from `sm` up.
 *
 * SETUP & CONFIGURATION IS A COLUMN, NOT A THIRD SECTION. A reader does not experience
 * "what the platform provides" and "how this tenant is set up" as two different menus;
 * they experience three headings and have to guess which one owns Mobile App Rights. The
 * sub-heading keeps the distinction without making it a top-level choice. That layout is
 * data, in `PLATFORM_MENU_SECTION`, so this component never learns any section's name.
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
  const panelRef = useRef<HTMLDivElement>(null)

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
   * ENTERING THE PANEL, NOT JUST OPENING IT.
   *
   * Pressing Enter on the avatar opened the panel and left focus on the avatar, so the
   * next Tab went to whatever follows the avatar in the header rather than into the
   * thing that just appeared. With 27 entries laid out in a grid that is worse than it
   * was with 15 in a column: the panel is visibly open and the keyboard is somewhere
   * else entirely.
   */
  useEffect(() => {
    if (!open) return

    const first = panelRef.current?.querySelector<HTMLElement>('button, [href]')
    first?.focus()
  }, [open])

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

  /**
   * PLATFORM SERVICES AND AI & INTELLIGENCE, DRIVEN BY REGISTRIES RATHER THAN BY LISTS
   * HERE.
   *
   * Both sections come from `packages/`, which is also what builds their consoles and
   * every detail page. Adding or renaming an entry is a registry edit; this file does
   * not change. Hand-written lists beside them would be two more places to forget.
   *
   * LMS K-12 keeps the platform half as three hand-written objects in its header — a
   * list of labels, a map of routes, a map of icons — and its own notes record the
   * cost: a screen that graduates from placeholder to built has to be updated in three
   * files, and a missed one silently sends people to the placeholder.
   *
   * WHY THEY HANG OFF THIS MENU AND NOT THE SIDEBAR
   *
   * Same reason "Create an organisation" does: `tblmenumaster_g2g` is the CUSTOMER'S
   * navigation, and these are platform administration screens that configure the
   * platform every module then runs on. Putting them in the catalogue would also mean
   * nobody could open one until rights rows had been written for every profile on the
   * estate.
   *
   * ADMINISTRATORS ONLY, AND THE SERVER AGREES
   *
   * `routes/ai.php` is behind `profile:admin`, and the platform endpoints are too, so a
   * non-administrator who reached one of these would meet a 403 on every panel. Hiding
   * the entry is the courtesy; the gate is the middleware. Doing only the first would be
   * the mistake `RequireProfile`'s own note calls out — hiding a button is not a control.
   */
  const isAdministrator = !!user && ROLE_GROUPS.admin.includes(user.role)

  const resolveService = usePlatformDestination()

  const sections = useMemo<MenuSection[]>(() => {
    if (!isAdministrator) return []

    return [
      {
        id: PLATFORM_MENU_SECTION.id,
        label: PLATFORM_MENU_SECTION.label,
        href: PLATFORM_MENU_SECTION.href,
        span: PLATFORM_MENU_SECTION.span,
        columns: PLATFORM_MENU_SECTION.columns.map((column) => ({
          label: column.label,
          items: column.items.map((service) => ({
            id: service.id,
            label: service.name,
            icon: platformServiceIcon(service.slug),
            /*
             * Resolved here so an administrator reaches the real screen in one click.
             * A service whose screen lives in the module tree resolves against THIS
             * user's own menu, and one they have no rights to falls back to the
             * service's page — which explains it — rather than to a 404.
             */
            href: resolveService(service).href,
            badge:
              service.status === 'live'
                ? undefined
                : service.status === 'in-progress'
                  ? 'WIP'
                  : 'Soon',
          })),
        })),
      },
      {
        id: 'ai-intelligence',
        label: 'AI & Intelligence',
        href: '/ai',
        span: 1,
        columns: [
          {
            items: AI_CAPABILITIES.map((capability) => ({
              id: capability.id,
              label: capability.name,
              icon: undefined,
              href: `/ai/${capability.slug}`,
              badge:
                capability.status === 'live'
                  ? undefined
                  : capability.status === 'in-progress'
                    ? 'WIP'
                    : 'Soon',
            })),
          },
        ],
      },
    ]
  }, [isAdministrator, resolveService])

  const accountItems = [
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

  const go = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        /*
         * `dialog`, not `menu`, and the panel below explains why.
         */
        aria-haspopup="dialog"
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
        /*
         * ═══════════════════════════════════════════════════════════════════
         * `role="dialog"`, AND `role="menuitem"` IS GONE
         * ═══════════════════════════════════════════════════════════════════
         *
         * `role="menu"` describes a one-dimensional list whose items are reached with
         * the arrow keys. This is a grid of up to 27 controls in three columns, and the
         * component never implemented arrow-key navigation or a roving tabindex — so
         * the old markup promised a keyboard interface it did not have, and a screen
         * reader announced "menu, 27 items" for something that does not behave like one.
         *
         * As a plain dialog of `nav`/`ul`/`li` the promise matches the behaviour: Tab
         * moves through the controls in DOM order, which is reading order, and the
         * headings give a screen reader the same grouping a sighted reader gets from the
         * columns. `aria-modal="false"` because it does not trap focus — Tab out of it
         * closes nothing, which is what a menu attached to a header should do.
         */
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-label="Account and platform services"
          /*
           * WIDTH IS CONDITIONAL, AND THE NON-ADMIN CASE IS THE REASON.
           *
           * With the grid present, `sm:w-auto` lets the three 220px columns decide the
           * width, which is what makes this a panel. With no grid — a non-administrator
           * sees only the account rail — `w-auto` would instead size the panel to its
           * longest line, which is the email address, and `truncate` cannot shorten text
           * in a container that is sizing itself to fit that text. A long address would
           * stretch the panel across the viewport.
           *
           * So a menu with no sections keeps the fixed `w-72` it has always had.
           */
          className={`absolute right-0 z-50 mt-2 flex max-h-[85vh] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg ${
            sections.length > 0 ? 'w-[min(calc(100vw-1.5rem),18rem)] sm:w-auto' : 'w-72'
          }`}
        >
          <div className="shrink-0 border-b border-border px-3 py-3">
            {/* Capped so it can never be the widest child. In the `sm:w-auto` panel the
                width is whatever the widest line needs, and `truncate` cannot shorten
                text in a box that is sizing itself around that text — so an unusually
                long address would set the panel's width instead of being cut. */}
            <p className="max-w-[16rem] truncate text-sm font-semibold text-foreground">
              {user?.name}
            </p>
            <p className="max-w-[16rem] truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {/* The account rail stays full-width above the grid: these are about YOU,
                not about the platform, and folding them into a 220px column would put
                "My Profile" beside "Event Bus" as though they were peers. */}
            <nav aria-label="Account" className="border-b border-border p-1 sm:p-2">
              <ul className="space-y-1">
                {accountItems.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => go(item.href)}
                      className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors duration-200 outline-none hover:bg-secondary hover:text-secondary-foreground focus-visible:bg-secondary"
                    >
                      <item.icon className="size-4 text-muted-foreground" aria-hidden="true" />
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>

            {sections.length > 0 && (
              <div className="grid grid-cols-1 gap-x-3 gap-y-5 p-3 sm:grid-cols-[repeat(3,220px)]">
                {sections.map((section) => (
                  <MenuSectionBlock key={section.id} section={section} onNavigate={go} />
                ))}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-border p-1">
            <button
              type="button"
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

interface MenuItem {
  id: string
  label: string
  icon: LucideIcon | undefined
  href: string
  /** `WIP` / `Soon`. Absent for anything live — a badge on everything says nothing. */
  badge?: string
}

interface MenuColumn {
  label?: string
  items: MenuItem[]
}

interface MenuSection {
  id: string
  label: string
  href: string
  span: 1 | 2
  columns: MenuColumn[]
}

/**
 * One section of the panel: a heading that is itself a destination, then its columns.
 *
 * The rule sits above the whole section rather than above each column, so a two-column
 * section reads as one heading over two lists instead of as two headings that happen to
 * be adjacent.
 */
function MenuSectionBlock({
  section,
  onNavigate,
}: {
  section: MenuSection
  onNavigate: (href: string) => void
}) {
  const headingId = `menu-section-${section.id}`

  return (
    <nav
      aria-labelledby={headingId}
      className={section.span === 2 ? 'min-w-0 sm:col-span-2' : 'min-w-0'}
    >
      <div className="px-1 pb-2">
        <button
          type="button"
          id={headingId}
          onClick={() => onNavigate(section.href)}
          className="max-w-full truncate rounded-md text-left text-sm font-bold text-popover-foreground transition-colors outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
        >
          {section.label}
        </button>
      </div>

      <div
        className={`grid gap-x-3 gap-y-4 border-t border-border pt-2 ${
          section.span === 2 ? 'sm:grid-cols-2' : ''
        }`}
      >
        {section.columns.map((column, index) => (
          <div key={column.label ?? index} className="min-w-0">
            {column.label && (
              <p className="px-1 pb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                {column.label}
              </p>
            )}

            <ul className="space-y-1">
              {column.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate(item.href)}
                    title={item.label}
                    className="flex h-10 w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-left text-sm font-semibold text-muted-foreground shadow-xs transition-all outline-none hover:border-muted-foreground/30 hover:bg-muted/60 hover:text-foreground hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {/* A label with no glyph falls back to its own initial, which is
                        what the sidebar does for an unresolvable icon — a missing
                        glyph never costs the row its shape. */}
                    <span
                      className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
                      aria-hidden="true"
                    >
                      {item.icon ? (
                        <item.icon className="size-[15px]" />
                      ) : (
                        item.label.charAt(0).toUpperCase()
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.badge && (
                      <span className="shrink-0 text-[10px] tracking-wider text-muted-foreground/70 uppercase">
                        {item.badge}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  )
}
