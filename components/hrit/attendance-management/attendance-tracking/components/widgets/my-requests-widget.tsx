'use client'

import * as React from 'react'
import { FileText ,ChevronRight} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { MyRequest } from './widget-types'

interface MyRequestsWidgetProps {
  requests: MyRequest[]
  loading?: boolean
  onViewAll?: () => void
}

const statusVariantMap: Record<string, 'default' | 'success' | 'warning' | 'destructive'> = {
  Pending: 'warning',
  Approved: 'success',
  Rejected: 'destructive',
}

export function MyRequestsWidget({ requests, loading, onViewAll }: MyRequestsWidgetProps) {
  if (loading) {
    return (
      <Card className="h-full rounded-xl border-border bg-card shadow-sm">
        <CardHeader className="flex flex-row items-center gap-3 space-y-0 px-5 pb-4 pt-5">
          <Skeleton className="size-10 rounded-xl" />
          <Skeleton className="h-6 w-24" />
        </CardHeader>
        <CardContent className="space-y-2 px-3 pb-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="flex h-full flex-col rounded-xl border-border bg-card shadow-sm">
      <CardHeader className="flex flex-row items-center gap-3 space-y-0 px-5 pb-4 pt-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <FileText className="size-5" />
        </span>
        <CardTitle className="text-base font-bold text-foreground">
          My Requests
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between px-3 pb-3">
        <div className="flex flex-col">
          {requests.map((request) => (
            <div
              key={request.id}
              className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-muted"
            >
              <span className="text-sm font-medium text-foreground">
                {request.type}
              </span>
              <Badge
                variant={statusVariantMap[request.status] || 'default'}
                className="gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
              >
                {request.status} ({request.count})
              </Badge>
            </div>
          ))}
        </div>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
          >
            View All Requests
          <ChevronRight className="size-4" />
          </button>
        )}
      </CardContent>
    </Card>
  )
}
