import * as React from 'react'
import { cn } from '@/lib/utils'

interface DataListProps extends React.HTMLAttributes<HTMLDListElement> {
  items: Array<{
    label: string
    value: React.ReactNode
  }>
}

const DataList = React.forwardRef<HTMLDListElement, DataListProps>(
  ({ className, items, ...props }, ref) => (
    <dl
      ref={ref}
      className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2', className)}
      {...props}
    >
      {items.map((item, idx) => (
        <div key={idx} className="rounded-lg border border-border p-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {item.label}
          </dt>
          <dd className="mt-1 text-sm font-medium text-foreground">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  ),
)
DataList.displayName = 'DataList'

export { DataList }
