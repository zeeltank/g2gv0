'use client'

import * as React from 'react'
import {
  Users,
  ShieldAlert,
  UserPlus,
  Target,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  AlertTriangle,
  Clock,
  BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Employee } from '@/types/employee'

/* ─── Types ─── */
interface PulseCard {
  id: string
  title: string
  value: string | number
  subtitle: string
  icon: React.ElementType
  trend?: {
    direction: 'up' | 'down' | 'neutral'
    label: string
  }
  tone: 'primary' | 'success' | 'warning' | 'danger'
  actionLabel?: string
  onAction?: () => void
}

/* ─── Tone mappings for consistent theming ─── */
const toneBg: Record<PulseCard['tone'], string> = {
  primary: 'bg-primary/8',
  success: 'bg-success/8',
  warning: 'bg-warning/8',
  danger: 'bg-danger/8',
}
const toneIconBg: Record<PulseCard['tone'], string> = {
  primary: 'bg-primary/12 text-primary',
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/12 text-warning',
  danger: 'bg-danger/12 text-danger',
}
const toneBorder: Record<PulseCard['tone'], string> = {
  primary: 'border-primary/15',
  success: 'border-success/15',
  warning: 'border-warning/15',
  danger: 'border-danger/15',
}
const toneAccent: Record<PulseCard['tone'], string> = {
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
}
const toneTrendBg: Record<PulseCard['tone'], string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
}

/* ─── Card Component ─── */
function PulseCardWidget({ card, index }: { card: PulseCard; index: number }) {
  const Icon = card.icon
  const TrendIcon = card.trend?.direction === 'up' ? TrendingUp : card.trend?.direction === 'down' ? TrendingDown : null

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border bg-card/60 backdrop-blur-sm p-5 transition-all duration-300 ease-out',
        'hover:shadow-md hover:-translate-y-0.5 hover:bg-card/80',
        toneBorder[card.tone],
        'animate-in fade-in slide-in-from-bottom-3',
      )}
      style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'both' }}
    >
      {/* Subtle gradient overlay */}
      <div
        className={cn(
          'absolute inset-0 opacity-[0.03] transition-opacity duration-300 group-hover:opacity-[0.06]',
          toneBg[card.tone],
        )}
      />

      {/* Decorative corner accent */}
      <div
        className={cn(
          'absolute -right-6 -top-6 size-24 rounded-full opacity-[0.04] transition-all duration-500 group-hover:opacity-[0.08] group-hover:scale-110',
          toneBg[card.tone],
        )}
      />

      <div className="relative z-10 flex flex-col gap-4">
        {/* Top row: Icon + Trend */}
        <div className="flex items-start justify-between">
          <div
            className={cn(
              'flex size-11 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105',
              toneIconBg[card.tone],
            )}
          >
            <Icon className="size-[22px]" strokeWidth={1.8} />
          </div>

          {card.trend && (
            <div
              className={cn(
                'flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide',
                toneTrendBg[card.tone],
              )}
            >
              {TrendIcon && <TrendIcon className="size-3" />}
              {card.trend.label}
            </div>
          )}
        </div>

        {/* Value + Title */}
        <div className="space-y-1">
          <div className={cn('text-3xl font-bold tracking-tight text-foreground')}>
            {card.value}
          </div>
          <div className="text-sm font-semibold text-foreground/80">{card.title}</div>
        </div>

        {/* Subtitle */}
        <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
          {card.subtitle}
        </p>

        {/* Action link */}
        {card.actionLabel && (
          <button
            type="button"
            onClick={card.onAction}
            className={cn(
              'mt-auto flex items-center gap-1.5 text-xs font-semibold transition-all duration-200 cursor-pointer',
              'opacity-70 group-hover:opacity-100',
              toneAccent[card.tone],
            )}
          >
            {card.actionLabel}
            <ArrowRight className="size-3 transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
    </div>
  )
}

/* ─── Module Pulse Container ─── */
interface ModulePulseProps {
  employees: Employee[]
  loading: boolean
  className?: string
}

export function ModulePulse({ employees, loading, className }: ModulePulseProps) {
  // Compute pulse metrics from real employee data
  const metrics = React.useMemo(() => {
    if (!employees.length) {
      return {
        totalActive: 0,
        totalInactive: 0,
        complianceAtRisk: 0,
        pendingOnboarding: 0,
        skillDeficit: 0,
      }
    }

    const totalActive = employees.filter(
      (e) => e.status?.toLowerCase() === 'active'
    ).length
    const totalInactive = employees.filter(
      (e) => e.status?.toLowerCase() !== 'active'
    ).length

    // Employees missing critical profile data (simulate compliance risk)
    const complianceAtRisk = employees.filter(
      (e) =>
        !e.email || e.email === 'N/A' ||
        !e.mobile || e.mobile === 'N/A' ||
        !e.department_name || e.department_name === 'N/A'
    ).length

    // Employees with missing job role or designation (simulate pending onboarding)
    const pendingOnboarding = employees.filter(
      (e) =>
        !e.jobRole || e.jobRole === 'N/A' ||
        !e.designation || e.designation === 'N/A'
    ).length

    // Employees missing skills or profile_name (simulate skill deficit)
    const skillDeficit = employees.filter(
      (e) =>
        !e.skills || e.skills.length === 0 ||
        !e.profile_name || e.profile_name === 'Unknown'
    ).length

    return {
      totalActive,
      totalInactive,
      complianceAtRisk,
      pendingOnboarding,
      skillDeficit,
    }
  }, [employees])

  const pulseCards: PulseCard[] = [
    {
      id: 'active-headcount',
      title: 'Active Headcount',
      value: loading ? '—' : metrics.totalActive,
      subtitle: loading
        ? 'Calculating workforce data...'
        : `${metrics.totalInactive} inactive · ${employees.length} total workforce`,
      icon: Users,
      trend: loading
        ? undefined
        : {
            direction: 'up' as const,
            label: `${employees.length} total`,
          },
      tone: 'primary',
      actionLabel: 'View workforce breakdown',
    },
    {
      id: 'compliance-risk',
      title: 'Compliance At Risk',
      value: loading ? '—' : metrics.complianceAtRisk,
      subtitle: loading
        ? 'Scanning compliance data...'
        : metrics.complianceAtRisk > 0
          ? `${metrics.complianceAtRisk} employee${metrics.complianceAtRisk !== 1 ? 's' : ''} missing critical profile data`
          : 'All employees have complete profile records',
      icon: ShieldAlert,
      trend: loading
        ? undefined
        : metrics.complianceAtRisk > 0
          ? { direction: 'up' as const, label: 'Needs review' }
          : { direction: 'down' as const, label: 'All clear' },
      tone: metrics.complianceAtRisk > 0 ? 'danger' : 'success',
      actionLabel: metrics.complianceAtRisk > 0 ? 'Review incomplete profiles' : undefined,
    },
    {
      id: 'pending-onboarding',
      title: 'Pending Onboarding',
      value: loading ? '—' : metrics.pendingOnboarding,
      subtitle: loading
        ? 'Checking onboarding pipeline...'
        : metrics.pendingOnboarding > 0
          ? `${metrics.pendingOnboarding} employee${metrics.pendingOnboarding !== 1 ? 's' : ''} awaiting role or designation assignment`
          : 'All employees fully onboarded with roles assigned',
      icon: UserPlus,
      trend: loading
        ? undefined
        : metrics.pendingOnboarding > 0
          ? { direction: 'up' as const, label: 'Action needed' }
          : { direction: 'down' as const, label: 'Complete' },
      tone: metrics.pendingOnboarding > 0 ? 'warning' : 'success',
      actionLabel: metrics.pendingOnboarding > 0 ? 'Complete onboarding setup' : undefined,
    },
    {
      id: 'skill-deficit',
      title: 'Skill Deficit',
      value: loading
        ? '—'
        : employees.length > 0
          ? `${Math.round((metrics.skillDeficit / employees.length) * 100)}%`
          : '0%',
      subtitle: loading
        ? 'Analyzing competency gaps...'
        : metrics.skillDeficit > 0
          ? `${metrics.skillDeficit} of ${employees.length} employees lack competency mapping or role profiles`
          : 'All employees have complete competency profiles',
      icon: Target,
      trend: loading
        ? undefined
        : metrics.skillDeficit > 0
          ? { direction: 'up' as const, label: `${metrics.skillDeficit} unmapped` }
          : { direction: 'down' as const, label: 'Fully mapped' },
      tone: metrics.skillDeficit > 0 ? 'warning' : 'success',
      actionLabel: metrics.skillDeficit > 0 ? 'Map competencies' : undefined,
    },
  ]

  return (
    <div className={cn('space-y-4', className)}>
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <BarChart3 className="size-4" strokeWidth={2} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground tracking-tight">Module Pulse</h3>
          <p className="text-[11px] text-muted-foreground">Real-time workforce intelligence</p>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {pulseCards.map((card, i) => (
          <PulseCardWidget key={card.id} card={card} index={i} />
        ))}
      </div>
    </div>
  )
}
