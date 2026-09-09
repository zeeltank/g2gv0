'use client'

import { lazy, Suspense, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgPageShell } from '@/components/shell/gtg-page-shell'
import { GtgBreadcrumbFromContext } from '@/components/shell/gtg-breadcrumb'
import { cn } from '@/lib/utils'
import { useAccount } from '@/hooks/use-account'
import {
  isSectionId,
  sectionsForRole,
  type SettingsSection,
  type SettingsSectionId,
} from '@/lib/settings-sections'

const ProfileSection = lazy(() =>
  import('./sections/profile-section').then((m) => ({ default: m.ProfileSection })),
)
const SecuritySection = lazy(() =>
  import('./sections/security-section').then((m) => ({ default: m.SecuritySection })),
)
const PreferencesSection = lazy(() =>
  import('./sections/preferences-section').then((m) => ({ default: m.PreferencesSection })),
)
const NotificationsSection = lazy(() =>
  import('./sections/notifications-section').then((m) => ({ default: m.NotificationsSection })),
)
const SavedViewsSection = lazy(() =>
  import('./sections/saved-views-section').then((m) => ({ default: m.SavedViewsSection })),
)
const PeopleAccessSection = lazy(() =>
  import('./sections/people-access-section').then((m) => ({ default: m.PeopleAccessSection })),
)
const ModulesSection = lazy(() =>
  import('./sections/modules-section').then((m) => ({ default: m.ModulesSection })),
)
const DeliverySection = lazy(() =>
  import('./sections/delivery-section').then((m) => ({ default: m.DeliverySection })),
)
const OrganizationDefaultsSection = lazy(() =>
  import('./sections/organization-defaults-section').then((m) => ({
    default: m.OrganizationDefaultsSection,
  })),
)
const SecurityPolicySection = lazy(() =>
  import('./sections/security-policy-section').then((m) => ({ default: m.SecurityPolicySection })),
)
const AuditSection = lazy(() =>
  import('./sections/audit-section').then((m) => ({ default: m.AuditSection })),
)
const RolesAccessSection = lazy(() =>
  import('./sections/roles-access-section').then((m) => ({ default: m.RolesAccessSection })),
)
const ComingSoonSection = lazy(() =>
  import('./sections/coming-soon-section').then((m) => ({ default: m.ComingSoonSection })),
)

/**
 * SETTINGS — the hub, where there was a redirect.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT `/settings` USED TO BE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `redirect('/settings/module-configuration')`. Before that,
 * `redirect('/settings/portal-review')` - so the default settings landing page
 * was a screen whose every number was hardcoded to zero and whose "Go Live"
 * button wrote a localStorage key that nothing read.
 *
 * There has never been a settings hub in this product. "Account Settings"
 * survived in the codebase only as two comments explaining why the menu entry
 * was deleted: it pointed at `/profile`, the same place as "My Profile", which
 * displays seven tabs and can change nothing.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY MASTER-DETAIL AND NOT TABS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Eleven sections do not fit in a tab strip, and `components/ui` has no `Tabs`
 * at all - the house one is `components/shared/business/shared.tsx:94` and it is
 * built for three or four.
 *
 * The layout vocabulary is lifted from `role-permissions.tsx`, the best
 * master-detail already in the product, down to the measurements: outer
 * `flex h-full min-h-0 gap-6 overflow-hidden`, an `w-80` rail, rail and pane
 * headers both `h-[116px]` so their bottom borders form one line, and the same
 * `bg-primary/10 border border-primary/20` active row. Two screens that do the
 * same thing should not look like two different products.
 *
 * ── THE SECTION IS IN THE URL ───────────────────────────────────────────────
 *
 * `?s=preferences`, so a section can be linked to, opened in a new tab, and
 * returned to by the browser Back button. A hub whose state lives only in React
 * cannot be sent to somebody, which for a settings screen - the thing support
 * spends all day directing people to - is the whole point.
 */
export function SettingsShell() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const account = useAccount()

  const sections = useMemo(() => sectionsForRole(account.role), [account.role])

  const requested = searchParams.get('s')
  const [active, setActive] = useState<SettingsSectionId>('profile')

  /*
   * THE URL WINS, ONCE THE RAIL IS KNOWN.
   *
   * Applied during render rather than in an effect: an effect would paint
   * Profile first and then swap, so a link to `?s=security` would visibly land
   * on the wrong section before correcting itself.
   *
   * `applyKey` is null while the account is still loading, because until the
   * role is known there is no way to tell whether the requested section is one
   * this person has. Once it resolves the key changes, and the URL is applied
   * exactly once - and again whenever the URL itself changes.
   *
   * The guard matters: somebody who follows a colleague's link to `?s=people`
   * and is not an administrator lands on Profile rather than on a section their
   * rail does not contain, which would leave the rail and the pane disagreeing
   * about where they are.
   */
  const applyKey = account.loading ? null : `${account.role ?? ''}:${requested ?? ''}`
  const [appliedKey, setAppliedKey] = useState<string | null>(null)

  if (applyKey !== null && applyKey !== appliedKey) {
    setAppliedKey(applyKey)

    if (isSectionId(requested) && sections.some((section) => section.id === requested)) {
      setActive(requested)
    }
  }

  function open(id: SettingsSectionId) {
    setActive(id)
    // `replace`, not `push`: clicking through six sections should not mean six
    // presses of Back to leave Settings.
    router.replace(`/settings?s=${id}`, { scroll: false })
  }

  const current = sections.find((section) => section.id === active) ?? sections[0] ?? null

  return (
    <ProtectedLayout>
      <GtgPageShell
        breadcrumbItems={[{ label: 'Home', href: '/dashboard' }, { label: 'Settings' }]}
      >
        <GtgBreadcrumbFromContext />

        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-foreground lg:text-2xl">
              Settings
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Everything about your own account, and{' '}
              {sections.some((section) => section.group === 'Organisation')
                ? 'the settings this organisation shares.'
                : 'how this product behaves for you.'}
            </p>
          </div>

          <Button
            variant="outline"
            onClick={() => router.push('/dashboard')}
            className="shrink-0"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
          </Button>
        </div>

        {account.error && (
          <Alert variant="destructive" className="mb-5">
            <AlertCircle className="size-4" aria-hidden="true" />
            <AlertDescription>{account.error}</AlertDescription>
          </Alert>
        )}

        {/*
          * BELOW lg THE RAIL IS HIDDEN, SO THE SECTIONS MOVE HERE.
          *
          * Without this the whole area would be unusable on a phone or a narrow
          * window: the rail is the only way to change section, so hiding it
          * would strand every narrow-screen visitor on Profile with no way to
          * reach their own password. Same list, same state, same handler - laid
          * out as a scrolling row of chips instead of a column.
          */}
        <div className="mb-5 lg:hidden">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {account.loading
              ? Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-9 w-28 shrink-0 animate-pulse rounded-full bg-muted/40" />
                ))
              : sections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => open(section.id)}
                    aria-current={current?.id === section.id ? 'page' : undefined}
                    className={cn(
                      'flex shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors',
                      current?.id === section.id
                        ? 'border-primary/20 bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted/60',
                    )}
                  >
                    <section.icon className="size-4" aria-hidden="true" />
                    {section.label}
                    {section.soon && (
                      <span className="rounded-full border border-border bg-muted px-1.5 text-[10px] font-medium uppercase tracking-wide">
                        Soon
                      </span>
                    )}
                  </button>
                ))}
          </div>
        </div>

        <div className="flex min-h-[36rem] gap-6 lg:h-[calc(100vh-16rem)] lg:min-h-0 lg:overflow-hidden">
          <SectionRail
            sections={sections}
            active={current?.id ?? null}
            loading={account.loading}
            onOpen={open}
          />

          <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
            {current && (
              <div className="flex shrink-0 items-center gap-4 border-b bg-muted/10 px-4 py-4 sm:px-6 lg:h-[116px] lg:py-0">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <current.icon className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold tracking-tight text-foreground">
                    {current.label}
                  </h2>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                    {current.blurb}
                  </p>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <Suspense fallback={<PaneSkeleton />}>
                {account.loading ? <PaneSkeleton /> : <SectionBody id={current?.id} account={account} />}
              </Suspense>
            </div>
          </div>
        </div>
      </GtgPageShell>
    </ProtectedLayout>
  )
}

function SectionRail({
  sections,
  active,
  loading,
  onOpen,
}: {
  sections: SettingsSection[]
  active: SettingsSectionId | null
  loading: boolean
  onOpen: (id: SettingsSectionId) => void
}) {
  // Grouped so "You" and "Organisation" read as two different kinds of setting -
  // one changes what YOU see, the other changes it for everybody.
  const groups = useMemo(() => {
    const order: SettingsSection['group'][] = ['You', 'Organisation']

    return order
      .map((group) => ({ group, items: sections.filter((section) => section.group === group) }))
      .filter((entry) => entry.items.length > 0)
  }, [sections])

  return (
    <nav
      aria-label="Settings sections"
      className="hidden w-80 shrink-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm lg:flex"
    >
      <div className="flex h-[116px] shrink-0 flex-col justify-center gap-1 border-b bg-muted/20 px-5">
        <h2 className="text-base font-semibold text-foreground">All settings</h2>
        <p className="text-sm text-muted-foreground">
          {loading ? 'Loading…' : `${sections.length} sections available to you`}
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-2">
        {loading &&
          Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-lg bg-muted/40" />
          ))}

        {!loading &&
          groups.map(({ group, items }) => (
            <div key={group} className="space-y-1">
              <p className="px-3 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group}
              </p>

              {items.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => onOpen(section.id)}
                  aria-current={active === section.id ? 'page' : undefined}
                  className={cn(
                    'flex w-full cursor-pointer items-start gap-3 rounded-lg px-3 py-3 text-left transition-all duration-300 active:scale-[0.98]',
                    active === section.id
                      ? 'border border-primary/20 bg-primary/10 shadow-sm'
                      : 'border border-transparent hover:bg-muted/60 hover:shadow-sm',
                  )}
                >
                  <section.icon
                    className={cn(
                      'mt-0.5 size-4 shrink-0',
                      active === section.id ? 'text-primary' : 'text-muted-foreground',
                    )}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'flex items-center gap-2 text-sm',
                        active === section.id
                          ? 'font-semibold text-primary'
                          : 'font-medium text-foreground',
                      )}
                    >
                      <span className="truncate">{section.label}</span>
                      {section.soon && (
                        <span className="shrink-0 rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Soon
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 line-clamp-1 block text-xs text-muted-foreground">
                      {section.blurb}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ))}
      </div>
    </nav>
  )
}

function SectionBody({
  id,
  account,
}: {
  id: SettingsSectionId | undefined
  account: ReturnType<typeof useAccount>
}) {
  switch (id) {
    case 'profile':
      return <ProfileSection account={account} />
    case 'security':
      return <SecuritySection />
    case 'preferences':
      return <PreferencesSection account={account} />
    case 'notifications':
      return <NotificationsSection account={account} />
    case 'saved-views':
      return <SavedViewsSection />
    case 'people':
      return <PeopleAccessSection />
    case 'modules':
      return <ModulesSection />
    case 'delivery':
      return <DeliverySection />
    case 'organization':
      return <OrganizationDefaultsSection />
    case 'policy':
      return <SecurityPolicySection />
    case 'audit':
      return <AuditSection />
    case 'roles':
      return <RolesAccessSection />
    default:
      return <ComingSoonSection id={id} />
  }
}

function PaneSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-20 animate-pulse rounded-xl border border-border/70 bg-muted/30" />
      ))}
    </div>
  )
}

/** Shared by every section, so a "saving…" button looks the same everywhere. */
export function SaveButton({
  dirty,
  saving,
  onClick,
  label = 'Save changes',
}: {
  dirty: boolean
  saving: boolean
  onClick: () => void
  label?: string
}) {
  return (
    <Button
      onClick={onClick}
      disabled={!dirty || saving}
      className={cn(
        'shadow-sm transition-all duration-300 active:scale-95',
        dirty && !saving
          ? 'hover:-translate-y-0.5 hover:shadow-md'
          : 'bg-muted text-muted-foreground',
      )}
    >
      {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {saving ? 'Saving…' : dirty ? label : 'Saved'}
    </Button>
  )
}
