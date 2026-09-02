'use client'

/**
 * Administration > Permissions.
 *
 * Renders the matrix the server actually enforces: profiles come from
 * tbluserprofilemaster and the ability list mirrors TaskPermissionMiddleware.
 * Previously a hardcoded matrix of invented roles ("Executive", "Dept Head")
 * with a Save button that saved nothing.
 *
 * Deliberately read-only: the rule (Employee is denied privileged abilities)
 * lives in middleware code, so an editable matrix here would be another lie.
 * Per-tenant permission editing needs a storage decision first.
 */

import { useEffect, useState } from 'react'
import { Check, ShieldCheck, X } from 'lucide-react'

import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { taskService } from '@/services/task'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import type { PermissionAbility } from '@/types/task-management'

export function TmPermissions() {
  const [profiles, setProfiles] = useState<string[]>([])
  const [abilities, setAbilities] = useState<PermissionAbility[]>([])
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    // Deferred so the load's first setState lands after this render.
    queueMicrotask(async () => {
      const context = getLaravelContext()
      if (!isLaravelContextReady(context)) {
        if (active) { setError('Your ERP session is unavailable. Please sign in again.'); setLoading(false) }
        return
      }
      try {
        const response = await taskService.getPermissionsMatrix(context)
        if (!active) return
        setProfiles(response.data.profiles)
        setAbilities(response.data.abilities)
        setNote(response.data.note)
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to load the permission matrix.')
      } finally {
        if (active) setLoading(false)
      }
    })
    return () => { active = false }
  }, [])

  return (
    <div className="g2g-scrollbar flex h-full flex-col gap-8 overflow-y-auto p-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-foreground">
          <div className="rounded-xl border border-primary/20 bg-primary/10 p-2.5 text-primary shadow-sm">
            <ShieldCheck className="h-6 w-6" />
          </div>
          Permissions Matrix
        </h1>
        {note && <p className="text-sm text-muted-foreground">{note}</p>}
      </div>

      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
      {loading && <div className="flex h-40 items-center justify-center"><Spinner /></div>}

      {!loading && !error && (
        <div className="overflow-hidden rounded-[24px] border border-primary/10 bg-card/90 shadow-xl backdrop-blur-2xl">
          <div
            className="grid border-b border-primary/10 bg-primary/5"
            style={{ gridTemplateColumns: `2fr repeat(${profiles.length}, 1fr)` }}
          >
            <div className="flex items-center p-4 text-sm font-bold text-foreground">Capability</div>
            {profiles.map((profile) => (
              <div key={profile} className="flex items-center justify-center p-4 text-sm font-bold text-primary">
                {profile}
              </div>
            ))}
          </div>

          {abilities.map((ability) => (
            <div
              key={ability.key}
              className="grid border-t border-primary/5 transition-colors hover:bg-primary/5"
              style={{ gridTemplateColumns: `2fr repeat(${profiles.length}, 1fr)` }}
            >
              <div className="flex items-center p-4 text-sm font-bold text-foreground">{ability.label}</div>
              {profiles.map((profile) => {
                const allowed = ability.roles[profile] ?? false

                return (
                  <div key={profile} className="flex items-center justify-center p-4">
                    <span
                      title={`${profile} ${allowed ? 'can' : 'cannot'}: ${ability.label}`}
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-lg border shadow-sm',
                        allowed
                          ? 'border-primary/30 bg-primary/10 text-primary'
                          : 'border-border bg-background text-muted-foreground/40',
                      )}
                    >
                      {allowed ? <Check className="h-4 w-4 stroke-[3]" /> : <X className="h-4 w-4" />}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
