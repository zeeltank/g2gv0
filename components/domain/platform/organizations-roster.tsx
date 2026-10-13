'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, Building2, Loader2, Plus } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { platformOrganizationsService, type PlatformOrganization } from '@/services/platform/organizations'

/**
 * EVERY ORGANISATION ON THE PLATFORM — the operator's roster, now also the
 * place that replaces `G2G_NOTIFY_EMAIL_TENANTS`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY "CAN SEND REAL MAIL" LIVES HERE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Approving one more organisation to actually send outbound mail used to mean
 * editing a comma-separated list in a `.env` file on whichever server is
 * running, then clearing config cache - an operation only somebody with
 * server access could do, for something that needs to happen every time a new
 * customer is trusted with real sending. `App\Support\MailGate::
 * allowedForTenant()` now reads a column on this exact table instead, so the
 * toggle below is the whole operation.
 *
 * This does NOT control `G2G_NOTIFY_EMAIL`, the platform-wide master switch -
 * that one is still deploy-level on purpose (turning it on is all-or-nothing
 * for every organisation at once, which is not a decision this screen should
 * make casually reachable). Each row's toggle is a NARROWER permission that
 * can only ever allow less than the master switch would.
 */
export function OrganizationsRoster() {
  const context = useMemo(() => getLaravelContext(), [])

  const [organizations, setOrganizations] = useState<PlatformOrganization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyIds, setBusyIds] = useState<ReadonlySet<number>>(() => new Set())

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) {
      setError('Your session is unavailable. Please sign in again.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    try {
      const response = await platformOrganizationsService.list(context)
      setOrganizations(response.data.organizations)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load organisations.')
    } finally {
      setLoading(false)
    }
  }, [context])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  async function toggleOutboundEmail(org: PlatformOrganization, enabled: boolean) {
    if (busyIds.has(org.id)) return

    setBusyIds((current) => new Set(current).add(org.id))
    // Reflected immediately; rolled back below if the request fails.
    setOrganizations((current) => current.map((o) => (o.id === org.id ? { ...o, outbound_email_enabled: enabled } : o)))

    try {
      await platformOrganizationsService.setOutboundEmail(context, org.id, enabled)
    } catch (reason) {
      setOrganizations((current) =>
        current.map((o) => (o.id === org.id ? { ...o, outbound_email_enabled: org.outbound_email_enabled } : o)),
      )
      setError(reason instanceof Error ? reason.message : `Could not update ${org.name}.`)
    } finally {
      setBusyIds((current) => {
        const next = new Set(current)
        next.delete(org.id)
        return next
      })
    }
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Organisations</h1>
          <p className="text-sm text-muted-foreground">
            Every organisation on the platform, and whether its own mail is allowed to actually leave.
          </p>
        </div>
        <Button asChild>
          <Link href="/platform/organizations/new">
            <Plus className="mr-1.5 size-4" aria-hidden="true" />
            Create organisation
          </Link>
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organisation</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>People</TableHead>
              <TableHead>Departments</TableHead>
              <TableHead>Outbound email</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  Loading organisations…
                </TableCell>
              </TableRow>
            )}

            {!loading && organizations.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-14 text-center">
                  <Building2 className="mx-auto mb-2 size-8 text-muted-foreground/50" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">No organisations yet.</p>
                </TableCell>
              </TableRow>
            )}

            {!loading &&
              organizations.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-medium text-foreground">
                    {org.name}
                    {org.short_code && <span className="ml-1.5 text-xs text-muted-foreground">({org.short_code})</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{org.email ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{org.people}</TableCell>
                  <TableCell className="text-muted-foreground">{org.departments}</TableCell>
                  <TableCell>
                    <label className="inline-flex items-center gap-2">
                      <Switch
                        size="sm"
                        checked={org.outbound_email_enabled}
                        disabled={busyIds.has(org.id)}
                        onChange={(event) => void toggleOutboundEmail(org, event.target.checked)}
                      />
                      {busyIds.has(org.id) && <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden="true" />}
                    </label>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
