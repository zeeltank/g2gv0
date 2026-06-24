'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface FilterOption {
  id: string
  label: string
  value: string
}

interface Filter {
  id: string
  label: string
  type: 'search' | 'select' | 'date' | 'multiselect'
  options?: FilterOption[]
  value?: string | string[]
  onChange: (value: string | string[]) => void
}

interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  filters: Filter[]
  onReset?: () => void
  onApply?: () => void
  loading?: boolean
}

const FilterBar = React.forwardRef<HTMLDivElement, FilterBarProps>(
  ({ filters, onReset, onApply, loading, className, ...props }, ref) => {
    const activeFilters = filters.filter((f) => f.value)

    return (
      <div ref={ref} className={cn('space-y-3', className)} {...props}>
        <div className="flex flex-wrap gap-2 items-end justify-end">
          {filters.map((filter) => (
            <div key={filter.id} className={cn("flex flex-col gap-1", filter.type === 'search' && "mr-auto")}>
              <label className="text-xs font-medium text-muted-foreground">{filter.label}</label>
              {filter.type === 'search' && (
                <Input
                  placeholder="Search..."
                  value={filter.value as string}
                  onChange={(e) => filter.onChange(e.target.value)}
                  className="w-96 max-w-[100vw]"
                />
              )}
              {filter.type === 'select' && (
                <Select
                  value={filter.value as string}
                  onChange={(val) => filter.onChange(val)}
                  className="w-40"
                  options={[
                    { label: 'All', value: '' },
                    ...(filter.options || []).map(opt => ({ label: opt.label, value: opt.value }))
                  ]}
                />
              )}
              {filter.type === 'date' && (
                <input
                  type="date"
                  value={filter.value as string}
                  onChange={(e) => filter.onChange(e.target.value)}
                  className="px-3 py-2 text-sm border border-border rounded-md bg-card"
                />
              )}
            </div>
          ))}
          {onApply && (
            <Button onClick={onApply} size="sm" disabled={loading}>
              Apply Filters
            </Button>
          )}
          {onReset && activeFilters.length > 0 && (
            <Button onClick={onReset} variant="outline" size="sm">
              Reset
            </Button>
          )}
        </div>
        {activeFilters.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {activeFilters.map((filter) => (
              <Badge key={filter.id} variant="secondary">
                {filter.label}: {filter.value}
              </Badge>
            ))}
          </div>
        )}
      </div>
    )
  },
)
FilterBar.displayName = 'FilterBar'

export { FilterBar, type FilterBarProps, type Filter }
