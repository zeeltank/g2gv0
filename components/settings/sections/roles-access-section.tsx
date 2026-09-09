'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ArrowUpRight, Check, Info, Loader2, ShieldCheck, Users } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useLaravelContext } from '@/hooks/use-agentic'
import { isLaravelContextReady } from '@/lib/laravel-context'
import { apiClient } from '@/services/core'
import { ROLE_PERMISSIONS_ACCESS_LINK } from '@/lib/gtg-navigation'
import { Field, SectionBlock, ToggleRow } from './section-primitives'

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
 * control — which is exactly why the warning sits above the control and not in
 * a footnote.
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
  const [savingId, setSavingId] = useState<number | null>(null)
  const [savedId, setSavedId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  async function saveRole(role: Role, changes: Record<string, string | boolean>) {
    setSavingId(role.id)
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
      setSavingId(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-xl bg-muted/40" />
        ))}
      </div>
    )
  }

  if (!data) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" aria-hidden="true" />
        <AlertDescription>{error ?? 'Roles could not be loaded.'}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Alert>
        <ShieldCheck className="size-4" aria-hidden="true" />
        <AlertDescription>
          <strong>Which screens a role can open is set in Role &amp; Permissions</strong>, not here.
          This page covers where each role starts, how it is notified, and what its data scope
          records.
          <Link
            href={ROLE_PERMISSIONS_ACCESS_LINK}
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            Open Role &amp; Permissions
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
        </AlertDescription>
      </Alert>

      {!data.data_scope_enforced && (
        <Alert>
          <Info className="size-4" aria-hidden="true" />
          <AlertDescription>
            <strong>Data scope is recorded, not enforced.</strong> Nothing in this product reads it
            yet, so changing it does not restrict what anybody can see. It is here so the intent is
            written down and applies the day it is enforced — until then, what a role can reach is
            decided entirely by Role &amp; Permissions.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        {data.roles.map((role) => (
          <SectionBlock
            key={role.id}
            title={role.name}
            description={role.description ?? undefined}
          >
            <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Users className="size-3.5" aria-hidden="true" />
                {role.user_count} {role.user_count === 1 ? 'person' : 'people'}
              </span>
              <span>
                {role.menu_count} {role.menu_count === 1 ? 'screen' : 'screens'} visible
              </span>
              {role.role_key && (
                <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                  {role.role_key}
                </span>
              )}
              {role.is_system && (
                <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                  Built in
                </span>
              )}
            </div>

            {role.menu_count === 0 && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="size-4" aria-hidden="true" />
                <AlertDescription>
                  This role can open no screens at all. Anybody in it will sign in to an empty
                  product until it is given rights in Role &amp; Permissions.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Data scope"
                hint={
                  data.data_scope_enforced
                    ? undefined
                    : 'Recorded only — see the note above. It restricts nothing today.'
                }
              >
                <Select
                  value={role.data_scope ?? ''}
                  onChange={(value) => saveRole(role, { data_scope: String(value) })}
                  placeholder="Not set"
                  options={data.choices.data_scope}
                />
              </Field>

              <Field
                label="Lands on"
                hint={
                  data.landing_page_enforced
                    ? 'Where somebody in this role goes after signing in.'
                    : 'Stored as a default. A person’s own choice under Preferences is what applies today.'
                }
              >
                <Select
                  value={role.settings?.landing_page ?? 'dashboard'}
                  onChange={(value) => saveRole(role, { landing_page: String(value) })}
                  options={data.choices.landing_page.map((page) => ({
                    value: page,
                    label: page === 'dashboard' ? 'Dashboard' : 'The last page they were on',
                  }))}
                />
              </Field>
            </div>

            {role.settings && (
              <div className="mt-3 space-y-1 border-t border-border pt-3">
                <ToggleRow
                  label="Email people in this role by default"
                  description="Anybody who has set their own notification preferences keeps theirs."
                  checked={role.settings.notify_email === '1'}
                  onChange={(value) => saveRole(role, { notify_email: value })}
                />
              </div>
            )}

            {!role.role_key && (
              <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                This role predates the current role system, so only its data scope can be set here.
              </p>
            )}

            <div className="mt-3 flex h-5 items-center">
              {savingId === role.id && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  Saving…
                </span>
              )}
              {savedId === role.id && savingId !== role.id && (
                <span className={cn('flex items-center gap-1.5 text-xs text-success')}>
                  <Check className="size-3.5" aria-hidden="true" />
                  Saved
                </span>
              )}
            </div>
          </SectionBlock>
        ))}
      </div>

      {data.roles.length === 0 && (
        <Alert>
          <Info className="size-4" aria-hidden="true" />
          <AlertDescription>
            This organisation has no roles yet. They are created when it is set up.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end border-t border-border pt-5">
        <Button variant="outline" onClick={() => load()} disabled={savingId !== null}>
          Refresh
        </Button>
      </div>
    </div>
  )
}
