import { BriefcaseBusiness, HeartPulse, Plane, TimerReset,ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { LeaveBalanceSnapshot } from '@/types/Leavedashboard'

interface LeaveBalanceSnapshotCardProps {
  balances: LeaveBalanceSnapshot[]
}

const iconById = {
  casual: BriefcaseBusiness,
  sick: HeartPulse,
  earned: Plane,
  'comp-off': TimerReset,
}

const iconToneClass: Record<string, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
}

export function LeaveBalanceSnapshotCard({ balances }: LeaveBalanceSnapshotCardProps) {
  return (
    <Card className="h-full">
      <CardHeader  className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Leave Balance Snapshot</CardTitle>
        <Button variant="link" className="h-auto px-0 text-xs font-semibold">
          View all
          <ArrowRight className="size-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {balances.map((balance) => {
          const Icon = iconById[balance.id as keyof typeof iconById] ?? BriefcaseBusiness

          return (
            <div key={balance.id} className="flex items-center gap-3">
              <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${iconToneClass[balance.tone]}`}>
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-foreground">{balance.label}</span>
                  <span className="shrink-0 text-sm font-bold text-foreground">{balance.used.toFixed(1)}</span>
                </div>
                <Progress value={balance.used} max={balance.total} variant={balance.tone as 'default' | 'primary' | 'success' | 'warning' | 'destructive'} />
                <p className="text-xs text-muted-foreground">
                  {balance.used} / {balance.total} days
                </p>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}