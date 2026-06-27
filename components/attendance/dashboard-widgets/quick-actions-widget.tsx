'use client'

import * as React from 'react'
import { Zap , ChevronRight} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { QuickAction } from './widget-types'

interface QuickActionsWidgetProps {
  actions: QuickAction[]
  loading?: boolean
}

const iconWrapperClass = 'grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground'

export function QuickActionsWidget({ actions, loading }: QuickActionsWidgetProps) {
  if (loading) {
    return (
      <Card className="h-full rounded-xl border-border bg-card shadow-sm">
        <CardHeader className="flex flex-row items-center gap-3 space-y-0 px-5 pb-4 pt-5">
          <Skeleton className="size-10 rounded-xl" />
          <Skeleton className="h-6 w-24" />
        </CardHeader>
        <CardContent className="space-y-1 px-3 pb-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="flex h-full flex-col rounded-xl border-border bg-card shadow-sm">
      <CardHeader className="flex flex-row items-center gap-3 space-y-0 px-5 pb-4 pt-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-warning/10 text-warning">
          <Zap className="size-5" />
        </span>
        <CardTitle className="text-base font-bold text-foreground">
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 px-3 pb-3">
        <div className="flex flex-col">
          {actions.map((action) => {
            const Icon = action.icon
            const content = (
              <span className="flex w-full items-center gap-3">
                <span className={iconWrapperClass}>
                  <Icon className="size-4" />
                </span>
                <span className="flex-1 text-left text-sm font-medium text-foreground">
                  {action.label}
                </span>
                <span className="grid size-6 place-items-center rounded-md text-muted-foreground">
                  <ChevronRight className="size-4" />
                </span>
              </span>
            )

            if (action.href) {
              return (
                <a
                  key={action.id}
                  href={action.href}
                  className="flex w-full"
                  onClick={action.onClick}
                >
                  <Button
                    variant="ghost"
                    className="h-11 w-full justify-start rounded-lg px-3 text-sm font-medium"
                  >
                    {content}
                  </Button>
                </a>
              )
            }

            return (
              <Button
                key={action.id}
                variant="ghost"
                className="h-11 w-full justify-start rounded-lg px-3 text-sm font-medium"
                onClick={action.onClick}
              >
                {content}
              </Button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
