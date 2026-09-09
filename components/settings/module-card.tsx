'use client'

import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Bot,
  Boxes,
  Building2,
  GraduationCap,
  LayoutDashboard,
  Layers,
  Lock,
  Target,
  UserRound,
  UsersRound,
} from 'lucide-react'

export interface Module {
  /** tblmenumaster_g2g id of the module, as a string for the toggle handler. */
  id: string
  title: string
  /**
   * The server refuses to switch this off - it is not a label somebody typed.
   * Main Dashboard and Organizational Management, because an organisation must
   * keep the screens it would need to turn things back on.
   */
  mandatory: boolean
  selected: boolean
  description: string
  /**
   * How many actual screens this module contains, counted from the menu
   * catalogue.
   *
   * Replaces `duration` and `features`. Those were invented constants - "5-7
   * mins", "48 features" - and `features` was never even rendered. A count of
   * real screens is both true and more use to somebody deciding whether to
   * switch a module on.
   */
  screens: number
}

interface ModuleCardProps {
  module: Module
  onToggle: (id: string) => void
}

/**
 * Icon and colour, BY MENU ID.
 *
 * ── THE BUG THIS FIXES ──────────────────────────────────────────────────────
 *
 * These three lookups were keyed on strings that never arrive:
 *
 *     const icons = { organization: Building2, competency: Shield,
 *                     talent: Users, lms: GraduationCap, hrit: UsersRound }
 *
 * while `module.id` is `String(menu.id)` from the server - `'1'`, `'2'`, `'300'`.
 * Every lookup missed and fell through to the default, so ALL EIGHT CARDS
 * RENDERED THE IDENTICAL ICON IN THE IDENTICAL COLOUR, and `Shield`, `Users`,
 * `GraduationCap` and `UsersRound` were imported but unreachable.
 *
 * Keyed on the menu id now, which is what the card is actually given. Any module
 * without an entry gets `Boxes` rather than pretending to be Organizational
 * Management.
 */
const MODULE_LOOKS: Record<string, { icon: typeof Building2; fg: string; bg: string }> = {
  '300': { icon: LayoutDashboard, fg: 'text-muted-foreground', bg: 'bg-muted/60' },
  '1': { icon: Building2, fg: 'text-primary', bg: 'bg-primary/10' },
  '2': { icon: Target, fg: 'text-success', bg: 'bg-success/10' },
  '3': { icon: UserRound, fg: 'text-warning', bg: 'bg-warning/10' },
  '4': { icon: GraduationCap, fg: 'text-primary', bg: 'bg-primary/10' },
  '5': { icon: UsersRound, fg: 'text-secondary-foreground', bg: 'bg-muted/60' },
  '204': { icon: Boxes, fg: 'text-success', bg: 'bg-success/10' },
  '186': { icon: Bot, fg: 'text-warning', bg: 'bg-warning/10' },
}

const FALLBACK = { icon: Boxes, fg: 'text-muted-foreground', bg: 'bg-muted/60' }

export function ModuleCard({ module, onToggle }: ModuleCardProps) {
  const look = MODULE_LOOKS[module.id] ?? FALLBACK
  const Icon = look.icon

  return (
    <Card
      className={cn(
        'relative w-full pt-4 transition-shadow',
        module.selected
          ? 'border-primary shadow-md'
          : 'border-border shadow-sm hover:border-input hover:shadow-md',
        // An always-on module cannot be acted on, so it does not offer the
        // hover affordance of one that can.
        module.mandatory && 'bg-surface-muted/40',
      )}
    >
      <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2">
        {module.mandatory ? (
          /*
           * ── AN INERT CHECKBOX IS WORSE THAN A DISABLED ONE ────────────────
           *
           * This used to render a live-looking, undisabled Checkbox whose
           * onChange reached a handler that ignored mandatory modules. Clicking
           * it did nothing at all, silently, and the aria-label still read
           * "Deselect Main Dashboard".
           *
           * A padlock says what is true - this one cannot be switched off - and
           * the title says why. The house pattern from hr-dashboard.tsx:140:
           * disabled with a stated reason, never inert but live.
           */
          <span
            className="flex size-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm"
            title={`${module.title} is always on — it holds the screens you would need to turn anything back on.`}
            aria-label={`${module.title} is always on and cannot be switched off`}
          >
            <Lock className="size-3" aria-hidden="true" />
          </span>
        ) : (
          <Checkbox
            checked={module.selected}
            onChange={() => onToggle(module.id)}
            size="lg"
            className="rounded-full border-foreground/30 bg-background shadow-sm"
            aria-label={`${module.selected ? 'Switch off' : 'Switch on'} ${module.title}`}
          />
        )}
      </div>

      <CardHeader className="items-center px-4 pb-3 pt-2 text-center">
        <div className="flex justify-center">
          <div className={cn('flex size-14 items-center justify-center rounded-full sm:size-16', look.bg)}>
            <Icon className={cn('size-6 sm:size-7', look.fg)} aria-hidden="true" />
          </div>
        </div>
        <CardTitle className="mt-2 min-h-10 max-w-36 text-center text-sm font-semibold leading-snug text-foreground sm:text-base">
          {module.title}
        </CardTitle>
        <CardDescription>
          <p className="mt-1 text-center text-xs leading-relaxed text-muted-foreground">
            {module.description}
          </p>
        </CardDescription>
      </CardHeader>

      <CardContent className="px-4 pb-4">
        <div className="mx-auto mb-4 h-px w-24 bg-border" aria-hidden="true" />
        <div className="mt-4 flex items-center justify-between gap-2">
          {/*
            "Always on" rather than "Mandatory": it describes what the product
            does instead of instructing the reader, and it matches the padlock
            above rather than sitting beside it saying something different.
          */}
          {/*
            `variant` only. The card used to pass `tone` as well, which is
            deprecated and logs a console warning on every render in dev - one
            per module card, eight per page load.
          */}
          <Badge variant={module.mandatory ? 'default' : 'outline'}>
            {module.mandatory ? 'Always on' : module.selected ? 'On' : 'Off'}
          </Badge>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
            <Layers className="size-4" aria-hidden="true" />
            {module.screens} {module.screens === 1 ? 'screen' : 'screens'}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
