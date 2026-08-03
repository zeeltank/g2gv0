'use client'

import { useState } from 'react'
import { GaugeCircle } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import { useLevelsOfResponsibility } from '@/hooks/use-competency-libraries'

/**
 * The responsibility ladder that sits under the job role taxonomy: pick a
 * level, read its essence and the attributes (autonomy, influence, complexity,
 * knowledge, business skills) expected at it.
 *
 * Reference content shared by every tenant, so it is read-only here.
 */
export function LevelsOfResponsibility({ enabled = true }: { enabled?: boolean }) {
  const { levels, loading, error } = useLevelsOfResponsibility(enabled)
  const [activeLevel, setActiveLevel] = useState<string | null>(null)
  const [activeGroup, setActiveGroup] = useState<string | null>(null)

  // Default to the first level / first attribute group without an effect: the
  // fallback is derived, and a click simply overrides it.
  const current = levels.find((level) => level.level === activeLevel) ?? levels[0] ?? null
  const group = current?.groups.find((item) => item.name === activeGroup) ?? current?.groups[0] ?? null

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-9 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    )
  }

  if (error || levels.length === 0) {
    return (
      <EmptyState
        className="border-0 py-8"
        icon={<GaugeCircle className="h-8 w-8" />}
        title="No responsibility levels"
        description={error ?? 'The responsibility ladder has not been loaded for this platform yet.'}
      />
    )
  }

  return (
    <div className="space-y-3">
      {/* Level picker */}
      <div className="g2g-scrollbar flex gap-1.5 overflow-x-auto pb-1">
        {levels.map((level) => {
          const isActive = current?.level === level.level
          return (
            <button
              key={level.level}
              type="button"
              onClick={() => {
                setActiveLevel(level.level)
                setActiveGroup(null)
              }}
              className={cn(
                'flex shrink-0 flex-col items-center rounded-xl border px-3 py-2 transition-colors',
                isActive
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:bg-accent',
              )}
            >
              <span className="text-xs font-semibold uppercase tracking-wider">Level</span>
              <span className="text-lg font-bold tabular-nums leading-none">{level.level}</span>
              {level.guiding_phrase && (
                <span className="mt-1 text-[11px] font-medium">{level.guiding_phrase}</span>
              )}
            </button>
          )
        })}
      </div>

      {current && (
        <div className="rounded-xl border border-border bg-background/40 p-4 space-y-3">
          {current.essence && (
            <p className="text-sm leading-relaxed text-foreground">{current.essence}</p>
          )}

          {current.groups.length > 0 && (
            <>
              <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
                {current.groups.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => setActiveGroup(item.name)}
                    className={cn(
                      'rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors',
                      group?.name === item.name
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {item.name}
                  </button>
                ))}
              </div>

              <div className="space-y-2.5">
                {(group?.attributes ?? []).map((attribute, index) => (
                  <div key={`${attribute.code ?? attribute.name ?? index}`} className="rounded-lg bg-muted/40 p-3">
                    <p className="text-sm font-bold text-foreground">{attribute.name ?? '—'}</p>
                    {attribute.description && (
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{attribute.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
