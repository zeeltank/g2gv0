'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface DataListItem {
  label: string
  value: string | number | React.ReactNode
}

interface DataListProps extends React.HTMLAttributes<HTMLDivElement> {
  items: DataListItem[]
  columns?: 1 | 2 | 3 | 4
  compact?: boolean
}

const DataList = React.forwardRef<HTMLDivElement, DataListProps>(
  ({ items, columns = 2, compact, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'grid gap-4',
        columns === 1 && 'grid-cols-1',
        columns === 2 && 'grid-cols-1 sm:grid-cols-2',
        columns === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        columns === 4 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
        className,
      )}
      {...props}
    >
      {items.map((item, index) => (
        <div key={index} className={cn('space-y-1', compact && 'space-y-0.5')}>
          <p className={cn('text-xs font-medium text-muted-foreground uppercase tracking-wide', compact && 'text-xs')}>
            {item.label}
          </p>
          <p className={cn('text-sm text-foreground', compact && 'text-xs font-medium')}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  ),
)
DataList.displayName = 'DataList'

export { DataList, type DataListProps, type DataListItem }
