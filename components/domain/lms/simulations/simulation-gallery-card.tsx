'use client'

import { ArrowUpRight, Clock, Eye, EyeOff, Globe, Layers, MoreHorizontal, PowerOff, Trash2 } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { SimulationCard, SimulationRights, SimulationStatus } from '@/services/lms/simulations'

import { CategoryIcon, DifficultyBars, MetaItem, ProgressPill, StatusPill } from './simulation-bits'
import { SimulationCover } from './simulation-cover'
import { cardNumber, categoryLabelOf, difficultyOf, minutesLabel, missionsLabel } from './simulation-format'

export interface SimulationCardActions {
  onOpen: (card: SimulationCard) => void
  onSetStatus: (card: SimulationCard, status: SimulationStatus) => void
  onRemove: (card: SimulationCard) => void
  onSwitchOff: (card: SimulationCard) => void
}

/**
 * What this person may do to a simulation, from its scope and their rights. An organisation's own simulation can be published, drafted and
 * removed; a platform one can only be switched off for the organisation (it belongs to everyone, so nobody here edits or deletes it).
 */
export function manageOptionsFor(card: SimulationCard, can: SimulationRights) {
  const own = card.scope === 'tenant'
  return {
    publish: own && can.edit && card.status !== 'published',
    unpublish: own && can.edit && card.status === 'published',
    remove: own && can.delete,
    switchOff: !own && can.delete,
  }
}

/**
 * One simulation in the gallery.
 *
 * The whole card is one button (a stretched, invisible one laid over it) so it is a single tab stop with a real accessible name, and the
 * manager's "..." menu sits above that button rather than inside it - a button never contains a button. Everything shown comes from the
 * simulation's own record; the number, the dot and the arrow are decoration around it.
 */
export function SimulationGalleryCard({
  simulation,
  index,
  can,
  actions,
}: {
  simulation: SimulationCard
  index: number
  can: SimulationRights
  actions: SimulationCardActions
}) {
  const difficulty = difficultyOf(simulation.difficulty)
  const minutes = minutesLabel(simulation.minutes)
  const missions = missionsLabel(simulation.missions)
  const manage = manageOptionsFor(simulation, can)
  const hasMenu = manage.publish || manage.unpublish || manage.remove || manage.switchOff
  const progress = simulation.progress
  const description = simulation.summary ?? simulation.subtitle
  const where = progress ? (progress.status === 'completed' ? 'Completed.' : `${progress.percent}% done.`) : 'Not started.'

  return (
    <li className="min-w-0">
      <article
        className={cn(
          'group relative flex h-full flex-col rounded-2xl border border-border/80 bg-card p-3 shadow-sm',
          'transition-[transform,box-shadow,border-color] duration-300 ease-out motion-reduce:transition-none',
          'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg motion-reduce:hover:translate-y-0',
        )}
      >
        <button
          type="button"
          onClick={() => actions.onOpen(simulation)}
          className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label={`${simulation.title}. ${categoryLabelOf(simulation)}. ${where} View details`}
        />

        <div className="relative aspect-[16/10] overflow-hidden rounded-xl">
          <SimulationCover
            simulation={simulation}
            imageClassName="transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />

          {/* top-left: its number in the gallery and a dot for where the learner is in it */}
          <span
            className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-card/90 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-foreground shadow-sm backdrop-blur"
            aria-hidden="true"
          >
            {cardNumber(index)}
            <span
              className={cn(
                'size-1.5 rounded-full',
                progress?.status === 'completed' ? 'bg-success' : progress ? 'bg-primary' : 'bg-muted-foreground/50',
              )}
            />
          </span>

          {/* top-right: draft / archived (only managers are ever shown those) and the learner's own progress */}
          <span className="absolute right-3 top-3 flex items-center gap-1.5">
            <StatusPill status={simulation.status} />
            <ProgressPill progress={progress} className="bg-card/90 backdrop-blur" />
          </span>

          {progress && progress.status !== 'completed' && (
            <span className="absolute inset-x-0 bottom-0 h-1 bg-foreground/10" aria-hidden="true">
              <span className="block h-full bg-primary" style={{ width: `${Math.min(100, progress.percent)}%` }} />
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col px-2 pb-1 pt-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 min-w-0 text-base font-semibold leading-snug tracking-tight text-foreground">{simulation.title}</h3>
            {hasMenu && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Manage ${simulation.title}`}
                    className="relative z-20 -mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <MoreHorizontal className="size-4" aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onSelect={() => actions.onOpen(simulation)}>
                    <Eye /> View details
                  </DropdownMenuItem>
                  {(manage.publish || manage.unpublish || manage.remove || manage.switchOff) && <DropdownMenuSeparator />}
                  {manage.publish && (
                    <DropdownMenuItem onSelect={() => actions.onSetStatus(simulation, 'published')}>
                      <Eye /> Publish to learners
                    </DropdownMenuItem>
                  )}
                  {manage.unpublish && (
                    <DropdownMenuItem onSelect={() => actions.onSetStatus(simulation, 'draft')}>
                      <EyeOff /> Move to draft
                    </DropdownMenuItem>
                  )}
                  {manage.switchOff && (
                    <DropdownMenuItem onSelect={() => actions.onSwitchOff(simulation)}>
                      <PowerOff /> Switch off for my organisation
                    </DropdownMenuItem>
                  )}
                  {manage.remove && (
                    <DropdownMenuItem
                      className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                      onSelect={() => actions.onRemove(simulation)}
                    >
                      <Trash2 /> Remove
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          {description && <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{description}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-muted-foreground">
            {minutes && <MetaItem icon={Clock}>{minutes}</MetaItem>}
            {difficulty && (
              <MetaItem>
                <DifficultyBars level={difficulty.level} />
                {difficulty.label}
              </MetaItem>
            )}
            {missions && <MetaItem icon={Layers}>{missions}</MetaItem>}
            {simulation.scope === 'platform' && <MetaItem icon={Globe}>G2G library</MetaItem>}
          </div>

          <div className="mt-auto pt-4">
            <hr className="border-border" />
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1.5 text-xs font-medium text-foreground">
                <CategoryIcon category={simulation.category} className="size-3.5 shrink-0 text-primary" />
                <span className="truncate">{categoryLabelOf(simulation)}</span>
              </span>
              <span
                className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-card text-foreground transition-colors duration-300 group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground"
                aria-hidden="true"
              >
                <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0 motion-reduce:group-hover:translate-y-0" />
              </span>
            </div>
          </div>
        </div>
      </article>
    </li>
  )
}

/** The card's shape while the list loads, so the grid does not jump when the real cards arrive. */
export function SimulationCardSkeleton() {
  return (
    <li className="min-w-0" aria-hidden="true">
      <div className="flex h-full flex-col rounded-2xl border border-border/80 bg-card p-3 shadow-sm">
        <Skeleton className="aspect-[16/10] w-full rounded-xl" />
        <div className="space-y-3 px-2 pb-1 pt-4">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <div className="flex gap-3 pt-1">
            <Skeleton className="h-3.5 w-14" />
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3.5 w-16" />
          </div>
          <hr className="border-border" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-7 w-28 rounded-full" />
            <Skeleton className="size-9 rounded-full" />
          </div>
        </div>
      </div>
    </li>
  )
}
