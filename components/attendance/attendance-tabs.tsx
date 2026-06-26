'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ReportTab {
  id: string
  label: string
}

interface AttendanceTabsProps extends React.HTMLAttributes<HTMLDivElement> {
  tabs: ReportTab[]
  active: string
  onChange: (id: string) => void
}

export const AttendanceTabs = React.forwardRef<HTMLDivElement, AttendanceTabsProps>(
  ({ tabs, active, onChange, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="tablist"
        className={cn('flex items-center gap-1 border-b border-border', className)}
        {...props}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === active
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={cn(
                'relative -mb-px h-10 px-4 text-sm font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
              {isActive && (
                <span
                  className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary"
                  aria-hidden="true"
                />
              )}
            </button>
          )
        })}
      </div>
    )
  },
)
AttendanceTabs.displayName = 'AttendanceTabs'