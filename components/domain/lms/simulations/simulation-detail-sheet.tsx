'use client'

import { AlertTriangle, Clock, Eye, EyeOff, Flag, Globe, Layers, Play, PowerOff, RotateCcw, Trash2, User, Users } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { describeSimulationError } from '@/hooks/use-simulations'
import { cn } from '@/lib/utils'
import {
  simulationService,
  type SimulationCard,
  type SimulationDetail,
  type SimulationRights,
  type SimulationStatus,
} from '@/services/lms/simulations'

import { CategoryIcon, DifficultyBars, MetaItem, ProgressPill, StatusPill } from './simulation-bits'
import { SimulationCover } from './simulation-cover'
import { cardNumber, categoryLabelOf, difficultyOf, minutesLabel, missionsLabel, readSpec, startLabel } from './simulation-format'
import { manageOptionsFor, type SimulationCardActions } from './simulation-gallery-card'

type DetailState = { status: 'loading' } | { status: 'ready'; detail: SimulationDetail } | { status: 'error'; message: string }

/** The specification behind a card, fetched when its sheet opens. A failure leaves the card's own facts and the Start button in place. */
function useSimulationDetail(id: number | null): DetailState {
  const [state, setState] = useState<{ id: number; value: DetailState } | null>(null)

  useEffect(() => {
    if (id === null) return
    let live = true
    simulationService
      .show(id)
      .then((response) => live && setState({ id, value: { status: 'ready', detail: response.data } }))
      .catch((err) => live && setState({ id, value: { status: 'error', message: describeSimulationError(err, 'Could not load the details.').message } }))
    return () => {
      live = false
    }
  }, [id])

  // Anything held for a different simulation is stale: show the skeleton, not the previous one's missions.
  return state && state.id === id ? state.value : { status: 'loading' }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

/** The mission kinds a specification may name are free text; show whatever it says, capitalised. */
function kindLabel(kind: string | null): string | null {
  return kind === null ? null : kind.charAt(0).toUpperCase() + kind.slice(1)
}

/**
 * Everything about one simulation before it is played: what it is, how long it takes, what the learner will do, where they are in it - and
 * the one button that starts it. People who manage simulations also get the actions that apply to this one.
 */
export function SimulationDetailSheet({
  simulation,
  index,
  can,
  actions,
  busy,
  onPlay,
  onOpenChange,
  onCloseAutoFocus,
}: {
  /** null = closed. */
  simulation: SimulationCard | null
  index: number
  can: SimulationRights
  actions: Pick<SimulationCardActions, 'onSetStatus' | 'onRemove' | 'onSwitchOff'>
  busy: boolean
  onPlay: (card: SimulationCard) => void
  onOpenChange: (open: boolean) => void
  /** Where focus goes when the sheet closes. The sheet has no trigger element of its own (a card opens it), so the caller says. */
  onCloseAutoFocus?: (event: Event) => void
}) {
  const state = useSimulationDetail(simulation?.id ?? null)
  // Keep the last card on screen while the sheet slides closed, so it does not go blank mid-animation. (State adjusted during render, the
  // pattern React documents for "state that follows a prop"; an effect would paint one frame of the old card first.)
  const [shown, setShown] = useState<SimulationCard | null>(simulation)
  if (simulation && simulation !== shown) setShown(simulation)
  const card = simulation ?? shown

  return (
    <Sheet open={simulation !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl" onCloseAutoFocus={onCloseAutoFocus}>
        {card && (
          <DetailBody
            card={card}
            index={index}
            state={state}
            can={can}
            actions={actions}
            busy={busy}
            onPlay={onPlay}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function DetailBody({
  card,
  index,
  state,
  can,
  actions,
  busy,
  onPlay,
}: {
  card: SimulationCard
  index: number
  state: DetailState
  can: SimulationRights
  actions: Pick<SimulationCardActions, 'onSetStatus' | 'onRemove' | 'onSwitchOff'>
  busy: boolean
  onPlay: (card: SimulationCard) => void
}) {
  const difficulty = difficultyOf(card.difficulty)
  const minutes = minutesLabel(card.minutes)
  const missionCount = missionsLabel(card.missions)
  const manage = manageOptionsFor(card, can)
  const manageable = manage.publish || manage.unpublish || manage.remove || manage.switchOff
  const detail = state.status === 'ready' ? state.detail : null
  // Everything taken from the specification goes through readSpec: it is data somebody wrote, and a wrong type in one field must not take the
  // sheet down for every learner who opens the card.
  const facts = detail ? readSpec(detail.spec) : null
  const missions = facts?.missions ?? []
  const intro = facts?.intro ?? null
  const authors = facts?.authors ?? []
  const competencies = facts?.competencies ?? 0
  const progress = card.progress

  return (
    <>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5 pb-6">
        <div className="flex items-center gap-2 pr-8">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1.5 text-xs font-medium text-foreground">
            <CategoryIcon category={card.category} className="size-3.5 text-primary" />
            {categoryLabelOf(card)}
          </span>
          <span className="text-xs font-semibold tabular-nums text-muted-foreground" aria-hidden="true">
            {cardNumber(index)}
          </span>
          <StatusPill status={card.status} />
          <ProgressPill progress={progress} className="ml-auto" />
        </div>

        <div className="aspect-[16/9] overflow-hidden rounded-xl border border-border">
          <SimulationCover simulation={card} />
        </div>

        <div className="space-y-2">
          <SheetTitle className="text-2xl font-bold leading-tight tracking-tight text-foreground">{card.title}</SheetTitle>
          <SheetDescription className={cn('text-sm leading-relaxed', !(card.subtitle ?? card.summary) && 'sr-only')}>
            {card.subtitle ?? card.summary ?? `${card.title} simulation`}
          </SheetDescription>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 text-sm text-muted-foreground">
            {minutes && <MetaItem icon={Clock}>{minutes}</MetaItem>}
            {difficulty && (
              <MetaItem>
                <DifficultyBars level={difficulty.level} />
                {difficulty.label}
              </MetaItem>
            )}
            {missionCount && <MetaItem icon={Layers}>{missionCount}</MetaItem>}
            {card.audience && <MetaItem icon={Users}>{card.audience}</MetaItem>}
            {card.scope === 'platform' && <MetaItem icon={Globe}>G2G library</MetaItem>}
          </div>
        </div>

        {progress && (
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">{progress.status === 'completed' ? 'You completed this simulation' : 'Your progress'}</span>
              <span className="tabular-nums text-muted-foreground">{progress.percent}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Your progress">
              <div className={cn('h-full rounded-full', progress.status === 'completed' ? 'bg-success' : 'bg-primary')} style={{ width: `${progress.percent}%` }} />
            </div>
          </div>
        )}

        {card.summary && card.summary !== card.subtitle && (
          <Section title="About">
            <p className="text-sm leading-relaxed text-foreground">{card.summary}</p>
          </Section>
        )}

        {state.status === 'loading' && (
          <div className="space-y-3" aria-hidden="true">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="mt-4 h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        )}

        {state.status === 'error' && (
          <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-foreground" role="status">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            <span>The mission list could not be loaded ({state.message}). You can still start the simulation.</span>
          </div>
        )}

        {intro && (
          <Section title="The scenario">
            <p className="text-sm leading-relaxed text-foreground">{intro}</p>
          </Section>
        )}

        {missions.length > 0 && (
          <Section title={`What you will do · ${missions.length} ${missions.length === 1 ? 'mission' : 'missions'}`}>
            <ol className="space-y-2">
              {missions.map((mission, i) => (
                <li key={mission.id ?? i} className="flex gap-3 rounded-lg border border-border bg-card p-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold tabular-nums text-primary">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{mission.title ?? `Mission ${i + 1}`}</p>
                    {mission.brief && <p className="mt-0.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{mission.brief}</p>}
                    {kindLabel(mission.kind) && (
                      <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        <Flag className="size-3" aria-hidden="true" /> {kindLabel(mission.kind)}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </Section>
        )}

        {(card.tags.length > 0 || authors.length > 0 || competencies > 0) && (
          <Section title="Details">
            {card.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {card.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              {authors.length > 0 && (
                <>
                  <dt className="flex items-center gap-1.5 text-muted-foreground">
                    <User className="size-3.5" aria-hidden="true" /> By
                  </dt>
                  <dd className="text-foreground">{authors.join(', ')}</dd>
                </>
              )}
              {competencies > 0 && (
                <>
                  <dt className="text-muted-foreground">Builds</dt>
                  <dd className="text-foreground">
                    {competencies} {competencies === 1 ? 'competency' : 'competencies'}
                  </dd>
                </>
              )}
              <dt className="text-muted-foreground">Version</dt>
              <dd className="tabular-nums text-foreground">v{card.version}</dd>
            </dl>
          </Section>
        )}
      </div>

      <div className="space-y-2.5 border-t border-border bg-card p-4">
        <Button size="lg" className="w-full gap-2" onClick={() => onPlay(card)}>
          {progress?.status === 'completed' ? <RotateCcw className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
          {startLabel(card)}
        </Button>
        {manageable && (
          <div className="flex flex-wrap gap-2">
            {manage.publish && (
              <Button variant="outline" className="flex-1 gap-2" disabled={busy} onClick={() => actions.onSetStatus(card, 'published' satisfies SimulationStatus)}>
                <Eye className="size-4" aria-hidden="true" /> Publish to learners
              </Button>
            )}
            {manage.unpublish && (
              <Button variant="outline" className="flex-1 gap-2" disabled={busy} onClick={() => actions.onSetStatus(card, 'draft' satisfies SimulationStatus)}>
                <EyeOff className="size-4" aria-hidden="true" /> Move to draft
              </Button>
            )}
            {manage.switchOff && (
              <Button variant="outline" className="flex-1 gap-2" disabled={busy} onClick={() => actions.onSwitchOff(card)}>
                <PowerOff className="size-4" aria-hidden="true" /> Switch off for my organisation
              </Button>
            )}
            {manage.remove && (
              <Button variant="outline" className="flex-1 gap-2 text-destructive hover:text-destructive" disabled={busy} onClick={() => actions.onRemove(card)}>
                <Trash2 className="size-4" aria-hidden="true" /> Remove
              </Button>
            )}
          </div>
        )}
      </div>
    </>
  )
}
