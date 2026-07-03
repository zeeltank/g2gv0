import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  TrendingDown,
  TrendingUp,
  UsersRound,
  XCircle,
  type LucideIcon,
} from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { DashboardStat, DashboardStatTone } from '@/types/Leavedashboard'

interface DashboardStatsProps {
  stats: DashboardStat[]
}

const iconMap: Record<DashboardStat['icon'], LucideIcon> = {
  'calendar-days': CalendarDays,
  'check-circle': CheckCircle2,
  'clipboard-list': ClipboardList,
  clock: Clock3,
  users: UsersRound,
  'x-circle': XCircle,
}

const toneClassMap: Record<DashboardStatTone, string> = {
  destructive: 'bg-destructive/10 text-destructive ring-destructive/20',
  info: 'bg-info/10 text-info ring-info/20',
  muted: 'bg-muted text-muted-foreground ring-border',
  primary: 'bg-primary/10 text-primary ring-primary/20',
  success: 'bg-success/10 text-success ring-success/20',
  warning: 'bg-warning/10 text-warning ring-warning/20',
}

export function DashboardStats({ stats }: DashboardStatsProps) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {stats.map((stat) => {
        const Icon = iconMap[stat.icon]
        const isPositive = stat.percentageChange >= 0
        const TrendIcon = isPositive ? TrendingUp : TrendingDown

        return (
          <Card
            key={stat.id}
            className="group transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md"
          >
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className={cn('rounded-lg p-2.5 ring-1', toneClassMap[stat.tone])}>
                  <Icon className="size-5" />
                </div>
                <div
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
                    isPositive
                      ? 'bg-success/10 text-success'
                      : 'bg-destructive/10 text-destructive',
                  )}
                >
                  <TrendIcon className="size-3" />
                  {Math.abs(stat.percentageChange)}%
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-semibold tracking-normal text-foreground">
                    {stat.value.toLocaleString()}
                  </p>
                  {stat.suffix ? (
                    <span className="text-sm font-medium text-muted-foreground">{stat.suffix}</span>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </section>
  )
}
