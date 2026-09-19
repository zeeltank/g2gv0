'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ArrowUpRight, Check, Info, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { DataTable } from '@/components/ui/data-table'
import { cn } from '@/lib/utils'
import { useLaravelContext } from '@/hooks/use-agentic'
import { isLaravelContextReady } from '@/lib/laravel-context'
import { apiClient } from '@/services/core'
import { ROLE_PERMISSIONS_ACCESS_LINK } from '@/lib/gtg-navigation'
import { SectionBlock, SectionEmpty, SectionError, SectionSkeleton } from './section-primitives'

/**
 * ROLES & ACCESS.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS IS NOT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * It is not the permissions matrix. WHICH SCREENS a role can reach lives in
 * Role & Permissions, and that screen works — so this one links to it rather
 * than growing a second editor for the same rows. Two places writing the same
 * permissions with no rule about which wins is how access quietly drifts.
 *
 * What this covers is everything else about a role, none of which has had a
 * home: where it lands after signing in, whether it is emailed by default, and
 * what its data scope says.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * NINE STACKED CARDS BECAME ONE TABLE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This was nine `SectionBlock`s, one per role, each about 300px tall: a heading,
 * a description, two stat lines, two dropdowns, a switch and a status line. Two
 * and a half thousand pixels of scrolling to see nine rows of what is, in every
 * respect, a table — the same six values for each role, in the same order.
 *
 * The cost was not only the scrolling. Comparing two roles meant remembering one
 * card while scrolling to another, and the question people actually bring to
 * this screen is comparative: which roles can see everything, which are emailed,
 * which of them has nobody in it.
 *
 * ── WHY THE EDITORS ARE IN THE CELLS ────────────────────────────────────────
 *
 * The obvious alternative was a read-only table that opens a drawer per role.
 * That is one more click and one more surface for what is a single dropdown
 * change, and it hides the comparison the table exists to give. Every editor
 * here saves on change, so a cell is the whole interaction.
 *
 * `DataTable` carries no horizontal overflow of its own, so the wrapper below
 * supplies it: six columns with two dropdowns do not fit a narrow pane, and a
 * table that widens the page body is worse than one that scrolls inside itself.
 *
 * ── WHY NOT THE HOUSE `Tooltip` ─────────────────────────────────────────────
 *
 * It opens on `mouseenter` only — no keyboard focus, no touch — and it is
 * absolutely positioned, so inside the scroll container above it would be
 * clipped. `title` is worse-looking and better-behaved: it appears on focus and
 * is never clipped. Adopting the nicer component here would have cost keyboard
 * users the explanation entirely.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * data_scope IS SHOWN AND NOT ENFORCED, AND THE SCREEN SAYS SO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The column exists, `StandardRoles` writes it for every provisioned role, and
 * a repo-wide search finds no reader. The server returns
 * `data_scope_enforced: false` as a hard constant precisely so this screen can
 * state that in plain words.
 *
 * Setting it changes what is recorded and nothing about who can see what. An
 * administrator who set it to "Their own records only" and believed they had
 * restricted somebody would be worse off than one who was never offered the
 * control — which is why the warning sits above the table, not in a footnote.
 */

type Role = {
  id: number
  name: string
  description: string | null
  role_key: string | null
  is_system: boolean
  user_count: number
  menu_count: number
  data_scope: string | null
  data_scope_meaning: string | null
  settings: { landing_page: string; notify_email: string } | null
}

type RolesResponse = {
  status: number
  data: {
    roles: Role[]
    choices: {
      data_scope: { value: string; label: string }[]
      landing_page: string[]
    }
    data_scope_enforced: boolean
    landing_page_enforced: boolean
  }
}

export function RolesAccessSection() {
  const resolveContext = useLaravelContext()

  const [data, setData] = useState<RolesResponse['data'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /*
   * A Set, not a single id.
   *
   * Every editor here saves on change, and there are three per row across nine
   * rows. A single `savingId` meant changing a second dropdown while the first
   * was still in flight moved the spinner off the row that was actually saving.
   */
  const [saving, setSaving] = useState<ReadonlySet<number>>(() => new Set())
  const [savedId, setSavedId] = useState<number | null>(null)

  const load = useCallback(async () => {
    const context = resolveContext()

    if (!isLaravelContextReady(context)) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await apiClient.get<RolesResponse>('/organization/roles', {
        type: 'api',
        token: context.token,
      })

      setData(response.data)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Roles could not be loaded. This section is available to administrators.',
      )
    } finally {
      setLoading(false)
    }
  }, [resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  const saveRole = useCallback(
    async (role: Role, changes: Record<string, string | boolean>) => {
      setSaving((current) => new Set(current).add(role.id))
      setSavedId(null)
      setError(null)

      try {
        const context = resolveContext()

        const response = await apiClient.put<RolesResponse>(`/organization/roles/${role.id}`, {
          type: 'api',
          token: context.token,
          ...changes,
        })

        setData(response.data)
        setSavedId(role.id)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'That role could not be saved.')
      } finally {
        setSaving((current) => {
          const next = new Set(current)
          next.delete(role.id)
          return next
        })
      }
    },
    [resolveContext],
  )

  /*
   * The columns are built here rather than inline so the row renderers close
   * over `data` and `saveRole` once, instead of nine times per render.
   */
  /*
   * A NOTE ON THE COLUMN IDS, WHICH LOOK WRONG AND ARE NOT.
   *
   * `DataTable` types `Column.id` as `keyof T`, so every column must borrow the
   * name of a real field on the row — it is used as the React key and to read a
   * default value. Two columns here are computed rather than a field (the Email
   * switch, which lives at `settings.notify_email`, and the save indicator,
   * which is not data at all), so they borrow unused field names. Both pass a
   * `render`, so nothing ever reads the borrowed field.
   *
   * Left as is rather than worked around: the alternative was widening the
   * primitive in `components/ui`, which this work does not modify.
   */
  const columns = useMemo(() => {
    if (!data) return []

    const landingOptions = data.choices.landing_page.map((page) => ({
      value: page,
      label: page === 'dashboard' ? 'Dashboard' : 'Last page they were on',
    }))

    return [
      {
        id: 'name' as const,
        header: 'Role',
        render: (_value: unknown, role: Role) => (
          <div className="min-w-[13rem] max-w-[18rem]">
            <p
              className="flex items-center gap-1.5 text-sm font-medium text-foreground"
              /*
               * The raw `role_key` chip is gone from the screen. It was
               * `hr_manager` in 10px monospace — a database identifier shown to
               * an administrator, at a size nobody can read, beside the human
               * name that already said the same thing. Kept here so somebody
               * debugging can still find it.
               */
              title={role.role_key ? `Internal key: ${role.role_key}` : undefined}
            >
              <span className="truncate">{role.name}</span>
              {!role.role_key && (
                <span
                  className="shrink-0 text-muted-foreground"
                  title="This role predates the current role system, so only its data scope can be set."
                >
                  <Info className="size-3.5" aria-hidden="true" />
                </span>
              )}
            </p>
            {role.description && (
              <p className="truncate text-xs text-muted-foreground" title={role.description}>
                {role.description}
              </p>
            )}
          </div>
        ),
      },
      {
        id: 'user_count' as const,
        header: 'People',
        render: (_value: unknown, role: Role) => (
          // `tabular-nums` so a column of counts lines up rather than jittering.
          <span className="block text-right text-sm tabular-nums text-foreground">
            {role.user_count}
          </span>
        ),
      },
      {
        id: 'menu_count' as const,
        header: 'Screens',
        render: (_value: unknown, role: Role) =>
          role.menu_count === 0 ? (
            /*
             * This was a full-width destructive Alert inside every affected
             * card. As a cell it is the same information where the eye already
             * is — in the column of screen counts, as the one value that is not
             * a number.
             */
            <span
              className="block text-right text-sm font-medium text-destructive"
              title="Anybody in this role signs in to an empty product until it is given rights in Role & Permissions."
            >
              None
            </span>
          ) : (
            <span className="block text-right text-sm tabular-nums text-foreground">
              {role.menu_count}
            </span>
          ),
      },
      {
        id: 'data_scope' as const,
        header: 'Data scope',
        render: (_value: unknown, role: Role) => (
          <div className="w-[13rem]">
            <Select
              value={role.data_scope ?? ''}
              onChange={(value) => void saveRole(role, { data_scope: String(value) })}
              placeholder="Not set"
              options={data.choices.data_scope}
              aria-label={`Data scope for ${role.name}`}
            />
          </div>
        ),
      },
      {
        id: 'settings' as const,
        header: 'Starts on',
        render: (_value: unknown, role: Role) => (
          <div className="w-[12rem]">
            <Select
              value={role.settings?.landing_page ?? 'dashboard'}
              onChange={(value) => void saveRole(role, { landing_page: String(value) })}
              options={landingOptions}
              aria-label={`Landing page for ${role.name}`}
              disabled={!role.settings}
            />
          </div>
        ),
      },
      {
        id: 'is_system' as const,
        header: 'Email',
        render: (_value: unknown, role: Role) =>
          role.settings ? (
            <span className="flex items-center justify-center">
              <Switch
                checked={role.settings.notify_email === '1'}
                onChange={(event) =>
                  void saveRole(role, { notify_email: event.target.checked })
                }
                aria-label={`Email people in ${role.name} by default`}
                title="Anybody who has set their own notification preferences keeps theirs."
              />
            </span>
          ) : (
            <span className="block text-center text-xs text-muted-foreground">—</span>
          ),
      },
      {
        id: 'role_key' as const,
        // Not an empty string: `header` is typed `string`, so a blank one renders
        // an unlabelled column header that a screen reader reads as nothing.
        header: 'Saved',
        render: (_value: unknown, role: Role) => (
          // A fixed width, so a spinner appearing does not shift the columns.
          <span className="flex w-16 items-center justify-end">
            {saving.has(role.id) ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
            ) : savedId === role.id ? (
              <span className="flex items-center gap-1 text-xs text-success">
                <Check className="size-3.5" aria-hidden="true" />
                Saved
              </span>
            ) : null}
          </span>
        ),
      },
    ]
  }, [data, saveRole, saving, savedId])

  if (loading) {
    return <SectionSkeleton rows={4} />
  }

  if (!data) {
    return (
      <SectionError
        title="Roles could not be loaded"
        description={error ?? 'This section is available to administrators.'}
        onRetry={() => void load()}
      />
    )
  }

  const emptyRoles = data.roles.filter((role) => role.menu_count === 0)

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/*
        TWO BANNERS BECAME ONE LINE AND ONE NOTICE.

        This opened with ~90 words in two stacked full-width Alerts, before any
        control: one explaining that permissions live elsewhere, one explaining
        that data scope is not enforced. Both were true and both fired on every
        single visit.

        The first is orientation, so it is a line with a link. The second is a
        warning that changes how somebody should read a control below it, so it
        stays a notice — it is the one thing on this screen that could mislead an
        administrator into thinking they had restricted somebody.
      */}
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
        Which screens a role can open is set in
        <Link
          href={ROLE_PERMISSIONS_ACCESS_LINK}
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          Role &amp; Permissions
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </Link>
        . This page covers where each role starts and how it is notified.
      </p>

      {!data.data_scope_enforced && (
        <Alert variant="info">
          <Info className="size-4" aria-hidden="true" />
          <AlertDescription>
            <strong>Data scope is recorded, not enforced.</strong> Nothing reads it yet, so
            changing it does not restrict what anybody can see.
          </AlertDescription>
        </Alert>
      )}

      <SectionBlock
        title="Roles in this organisation"
        description="Every change here saves as you make it. Hover a role for its internal key."
        badge={
          emptyRoles.length > 0
            ? `${emptyRoles.length} with no screens`
            : `${data.roles.length} roles`
        }
        badgeTitle={
          emptyRoles.length > 0
            ? `${emptyRoles.map((role) => role.name).join(', ')} can open no screens at all.`
            : undefined
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={saving.size > 0}
          >
            Refresh
          </Button>
        }
      >
        {data.roles.length === 0 ? (
          <SectionEmpty
            title="No roles yet"
            description="Roles are created when the organisation is set up."
          />
        ) : (
          /*
            The overflow lives here, not on the page.
            `DataTable` renders a bare `<Table>` inside a bordered div with no
            overflow of its own, so without this the six columns would widen the
            whole settings pane and put a horizontal scrollbar on the document.
          */
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <DataTable
              columns={columns}
              data={data.roles}
              getRowId={(role: Role) => String(role.id)}
              density="compact"
              striped={false}
              className={cn('min-w-[54rem]')}
            />
          </div>
        )}
      </SectionBlock>
    </div>
  )
}
