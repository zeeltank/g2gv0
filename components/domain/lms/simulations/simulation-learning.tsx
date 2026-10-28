'use client'

import { AlertTriangle, CheckCircle2, FlaskConical, Plus, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { SearchInput } from '@/components/ui/search-input'
import { useSimulations, type SimulationProgressFilter } from '@/hooks/use-simulations'
import { cn } from '@/lib/utils'
import type { SimulationCard, SimulationStatus } from '@/services/lms/simulations'

import { AddSimulationDialog } from './add-simulation-dialog'
import { SimulationDetailSheet } from './simulation-detail-sheet'
import { SimulationCardSkeleton, SimulationGalleryCard, type SimulationCardActions } from './simulation-gallery-card'
import { SimulationPlayer } from './simulation-player'

interface Notice {
  id: number
  message: string
  tone: 'info' | 'error'
  /** Offered for a removal, so a slip of the finger is not a loss. */
  undo?: { label: string; run: () => void }
}

const PROGRESS_FILTERS: { value: SimulationProgressFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'todo', label: 'Not started' },
  { value: 'doing', label: 'In progress' },
  { value: 'done', label: 'Completed' },
]

/**
 * Simulation Learning: the gallery of this organisation's interactive simulations.
 *
 * Nothing on this screen is a list of simulations or categories - both come from the server, per organisation, so a new simulation (or a
 * whole new category) appears the moment it is added. A card opens a sheet with everything about the simulation; the sheet starts it in the
 * generic runtime. People who manage simulations can also add them (from the G2G library, or by importing a specification), publish or
 * unpublish them, and remove them with an undo.
 */
export function SimulationLearning() {
  const sims = useSimulations()
  const { visible, categories, can, filters, progressCounts } = sims

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [playingId, setPlayingId] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  // True while the pointer or keyboard focus is on the notice: it must not vanish from under someone who is about to press Undo.
  const [noticeHeld, setNoticeHeld] = useState(false)
  const noticeSeq = useRef(0)
  // The card that opened the sheet, so focus goes back to it when the sheet (or the player after it) closes. `handingToPlayer` marks the
  // sheet closing because the player is opening, which must not pull focus back behind the player.
  const openerRef = useRef<HTMLElement | null>(null)
  const handingToPlayer = useRef(false)
  // The header's Add button: where focus returns after a draft saved from the Create tab has been previewed.
  const addButtonRef = useRef<HTMLButtonElement | null>(null)
  // The draft being previewed from the Create tab, so that closing the player can offer to publish it (the dialog is gone by then).
  const previewedFromCreate = useRef<number | null>(null)

  // The sheet and the player hold an id, not a card, so they always show the freshest copy (progress ticks, status changes) the list has.
  const selected = useMemo(() => sims.simulations.find((s) => s.id === selectedId) ?? null, [sims.simulations, selectedId])
  const playing = useMemo(() => sims.simulations.find((s) => s.id === playingId) ?? null, [sims.simulations, playingId])
  const selectedIndex = useMemo(() => Math.max(0, visible.findIndex((s) => s.id === selectedId)), [visible, selectedId])

  const say = useCallback((message: string, tone: Notice['tone'] = 'info', undo?: Notice['undo']) => {
    noticeSeq.current += 1
    setNoticeHeld(false)
    setNotice({ id: noticeSeq.current, message, tone, undo })
  }, [])

  // A notice clears itself - later when it carries an undo - but never while it is being pointed at or has keyboard focus.
  // A failed quiet action (publish, remove...) arrives as hook state and is shown as a notice of its own, ahead of any other: derived here, not
  // copied into state, so there is nothing to keep in step.
  const { actionError, clearActionError } = sims
  const errorNotice = useMemo<Notice | null>(() => (actionError ? { id: -1, message: actionError, tone: 'error' } : null), [actionError])
  const shownNotice = errorNotice ?? notice

  useEffect(() => {
    if (!shownNotice || noticeHeld) return
    const timer = window.setTimeout(() => {
      if (shownNotice.id === -1) clearActionError()
      else setNotice((n) => (n?.id === shownNotice.id ? null : n))
    }, shownNotice.undo ? 9000 : 5000)
    return () => window.clearTimeout(timer)
  }, [shownNotice, noticeHeld, clearActionError])

  const actions: SimulationCardActions = useMemo(
    () => ({
      onOpen: (card) => {
        openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
        setSelectedId(card.id)
      },
      onSetStatus: async (card: SimulationCard, status: SimulationStatus) => {
        const result = await sims.setStatus(card.id, status)
        if (result.ok) say(status === 'published' ? `“${card.title}” is now visible to learners.` : `“${card.title}” moved to draft. Learners no longer see it.`)
      },
      onRemove: async (card) => {
        const result = await sims.remove(card.id)
        if (!result.ok) return
        setSelectedId((current) => (current === card.id ? null : current))
        say(`Removed “${card.title}”.`, 'info', {
          label: 'Undo',
          run: () => {
            void sims.restore(card.id).then((restored) => {
              if (restored.ok) say(`Restored “${card.title}”.`)
            })
          },
        })
      },
      onSwitchOff: async (card) => {
        const result = await sims.disable(card.id)
        if (!result.ok) return
        setSelectedId((current) => (current === card.id ? null : current))
        // Switching a platform simulation back on needs the `add` right and switching it off needed `delete`: someone who has only the second
        // would be offered an Undo the server refuses, so they are not offered one.
        say(
          `Switched off “${card.title}” for your organisation.`,
          'info',
          sims.can.add
            ? {
                label: 'Undo',
                run: () => {
                  void sims.enable(card.id).then((back) => {
                    if (back.ok) say(`“${card.title}” is back.`)
                  })
                },
              }
            : undefined,
        )
      },
    }),
    // the hook's action callbacks are stable; `sims` itself changes every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sims.setStatus, sims.remove, sims.restore, sims.disable, sims.enable, sims.can.add, say],
  )

  const canAdd = can.add
  const noSimulations = !sims.loading && !sims.error && sims.total === 0
  const noMatches = !sims.loading && !sims.error && sims.total > 0 && visible.length === 0
  const filtered = filters.search !== '' || filters.category !== 'all' || filters.progress !== 'all'

  return (
    <div className="flex h-full w-full flex-col gap-6 pb-6">
      {/* Fixed at the bottom right whatever its place in the markup; it comes first in the markup so its Undo is the first stop for the keyboard. */}
      <NoticeToast
        notice={shownNotice}
        onDismiss={() => {
          setNoticeHeld(false)
          setNotice(null)
          clearActionError()
        }}
        onHold={setNoticeHeld}
      />

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Simulation Learning</h1>
          <p className="mt-1 text-sm text-muted-foreground">Practise real decisions in interactive simulations, then see what your choices did.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-full sm:w-64">
            <SearchInput
              value={filters.search}
              onChange={(event) => sims.setFilter('search', event.target.value)}
              placeholder="Search simulations…"
              aria-label="Search simulations"
              icon={<Search className="size-4" />}
            />
          </div>
          {canAdd && (
            <Button ref={addButtonRef} className="shrink-0 gap-2" onClick={() => setAdding(true)}>
              <Plus className="size-4" aria-hidden="true" /> Add simulation
            </Button>
          )}
        </div>
      </div>

      {/* The filter chips are made on the server from the categories in use, so they are never a list kept here. */}
      {!sims.error && (sims.loading || sims.total > 0) && (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Filter by category">
            {sims.loading ? (
              [0, 1, 2, 3].map((i) => <span key={i} className="h-9 w-28 shrink-0 animate-pulse rounded-full bg-muted" aria-hidden="true" />)
            ) : (
              <>
                <Chip active={filters.category === 'all'} label="All" count={sims.total} onClick={() => sims.setFilter('category', 'all')} />
                {categories.map((category) => (
                  <Chip
                    key={category.key}
                    active={filters.category === category.key}
                    label={category.label}
                    count={category.count}
                    onClick={() => sims.setFilter('category', category.key)}
                  />
                ))}
              </>
            )}
          </div>

          {!sims.loading && (
            <div className="flex max-w-full shrink-0 items-center overflow-x-auto rounded-lg border border-border bg-muted/30 p-0.5 text-xs font-medium" role="group" aria-label="Filter by your progress">
              {PROGRESS_FILTERS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filters.progress === value}
                  onClick={() => sims.setFilter('progress', value)}
                  className={cn(
                    'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 transition-colors',
                    filters.progress === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                  <span className="tabular-nums text-muted-foreground">{progressCounts[value]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {sims.error ? (
        <ErrorState title="Simulations could not be loaded" description={sims.error} retry={sims.retry} />
      ) : noSimulations ? (
        <EmptyState
          icon={<FlaskConical className="size-10" aria-hidden="true" />}
          title="No simulations yet"
          description={
            canAdd
              ? 'Add one from the G2G library, create one from a package you edit yourself, or import a specification. Learners see it as soon as it is published.'
              : 'Nothing has been added for your organisation yet. Ask the person who manages learning to add one.'
          }
          action={
            canAdd ? (
              <Button className="gap-2" onClick={() => setAdding(true)}>
                <Plus className="size-4" aria-hidden="true" /> Add simulation
              </Button>
            ) : undefined
          }
        />
      ) : noMatches ? (
        <EmptyState
          icon={<Search className="size-10" aria-hidden="true" />}
          title="No simulations match"
          description={filtered ? 'Try a different search, category or progress filter.' : undefined}
          action={
            filtered ? (
              <Button variant="outline" onClick={sims.resetFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" aria-busy={sims.loading}>
          {sims.loading
            ? [0, 1, 2, 3, 4, 5, 6, 7].map((i) => <SimulationCardSkeleton key={i} />)
            : visible.map((card, index) => <SimulationGalleryCard key={card.id} simulation={card} index={index} can={can} actions={actions} />)}
        </ul>
      )}

      <SimulationDetailSheet
        simulation={selected}
        index={selectedIndex}
        can={can}
        actions={actions}
        busy={sims.acting}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null)
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          if (!handingToPlayer.current) openerRef.current?.focus()
          handingToPlayer.current = false
        }}
        onPlay={(card) => {
          handingToPlayer.current = true
          setSelectedId(null)
          setPlayingId(card.id)
        }}
      />

      {playing && (
        <SimulationPlayer
          key={playing.id}
          simulation={playing}
          onProgress={sims.applyProgress}
          onClose={({ completed, saved }) => {
            setPlayingId(null)
            // back to the card the learner started from
            window.setTimeout(() => openerRef.current?.focus(), 0)
            // The card already shows the progress the player reported; fetch the server's own copy too, so nothing on screen is a guess -
            // but only after the last report has gone, or the reload could bring back the older figure.
            void saved.finally(() => sims.reload())
            if (completed) say(`Well done - you completed “${playing.title}”.`)
            // A draft just previewed from the Create tab: the dialog that had the Publish button is closed, so offer it here.
            const previewed = previewedFromCreate.current === playing.id
            previewedFromCreate.current = null
            if (previewed && playing.status === 'draft') {
              say(`That was a preview of “${playing.title}”. It is still a draft, so learners cannot see it.`, 'info', {
                label: 'Publish',
                run: () => {
                  void sims.setStatus(playing.id, 'published').then((result) => {
                    if (result.ok) say(`“${playing.title}” is now visible to learners.`)
                  })
                },
              })
            }
          }}
        />
      )}

      {canAdd && (
        <AddSimulationDialog
          open={adding}
          onOpenChange={setAdding}
          categories={categories}
          simulations={sims.simulations}
          create={sims.create}
          update={sims.update}
          enable={sims.enable}
          setStatus={sims.setStatus}
          onAdded={(message) => say(message)}
          onPreview={(card) => {
            // The draft was just saved from the Create tab: close the dialog and play it, exactly as a card's Start would.
            openerRef.current = addButtonRef.current
            previewedFromCreate.current = card.id
            setAdding(false)
            setPlayingId(card.id)
          }}
        />
      )}

    </div>
  )
}

function Chip({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
        active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-accent',
      )}
    >
      {label}
      <span className={cn('tabular-nums', active ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{count}</span>
    </button>
  )
}

/** The transient message at the bottom right: what just happened, and for a removal the way to take it back. */
function NoticeToast({ notice, onDismiss, onHold }: { notice: Notice | null; onDismiss: () => void; onHold: (held: boolean) => void }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[80] w-[min(24rem,calc(100vw-2rem))]" aria-live="polite">
      {notice && (
        <div
          key={notice.id}
          className={cn(
            'pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-card p-3 shadow-lg',
            notice.tone === 'error' ? 'border-destructive/30' : 'border-border',
          )}
          role={notice.tone === 'error' ? 'alert' : 'status'}
          onMouseEnter={() => onHold(true)}
          onMouseLeave={() => onHold(false)}
          onFocus={() => onHold(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) onHold(false)
          }}
        >
          {notice.tone === 'error' ? (
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
          )}
          <p className={cn('min-w-0 flex-1 text-sm', notice.tone === 'error' ? 'text-destructive' : 'text-foreground')}>{notice.message}</p>
          {notice.undo && (
            <button
              type="button"
              onClick={() => {
                notice.undo?.run()
                onDismiss()
              }}
              className="shrink-0 rounded-md px-2 py-0.5 text-sm font-semibold text-primary outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring"
            >
              {notice.undo.label}
            </button>
          )}
          <button type="button" aria-label="Dismiss" onClick={onDismiss} className="shrink-0 text-muted-foreground transition-colors hover:text-foreground">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}
