import React from 'react'
import { ArrowRight, BarChart3, CalendarDays, CalendarPlus, ClipboardList } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { LeaveQuickAction } from '@/types/leave-dashboard'

interface LeaveQuickActionsCardProps {
  actions: LeaveQuickAction[]
  onAction: (action: LeaveQuickAction) => void
}

const iconByName: Record<string, React.ElementType> = {
  'calendar-plus': CalendarPlus,
  'clipboard-list': ClipboardList,
  'calendar-days': CalendarDays,
  'chart-bar': BarChart3,
}

export function LeaveQuickActionsCard({ actions, onAction }: LeaveQuickActionsCardProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Quick Actions</CardTitle>
      </CardHeader>
      {/* Bounded like its siblings: this list is static today, but the card
          sits in the same stretch grid, so an added action would lengthen
          every card in the row, not just this one. */}
      <CardContent className="g2g-scrollbar max-h-[18rem] space-y-2 overflow-y-auto">
        {actions.map((action) => {
          const Icon = iconByName[action.icon]

          return (
            <Button
              key={action.id}
              variant="ghost"
              onClick={() => onAction(action)}
              className="h-auto w-full justify-start gap-3 rounded-lg border border-transparent px-3 py-3 hover:border-border hover:bg-surface-muted"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-semibold text-foreground">{action.label}</span>
                <span className="block truncate text-xs font-normal text-muted-foreground">{action.description}</span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            </Button>
          )
        })}
      </CardContent>
    </Card>
  )
}
