import * as React from 'react'
import { cn } from '@/lib/utils'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator } from '@/components/ui/breadcrumb'

export interface BreadcrumbItem {
  label: string
  href?: string
}

export function GtgBreadcrumb({
  items,
}: {
  items: BreadcrumbItem[]
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex h-11 shrink-0 items-center border-b border-border bg-card px-6"
    >
      <Breadcrumb>
        {items.map((item, index) => (
          <React.Fragment key={index}>
            {index > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {item.href ? (
                <BreadcrumbLink href={item.href} isActive={index === items.length - 1}>
                  {item.label}
                </BreadcrumbLink>
              ) : (
                <span
                  className={cn(
                    'truncate text-sm max-w-[200px]',
                    index === items.length - 1
                      ? 'font-medium text-foreground'
                      : 'text-muted-foreground',
                  )}
                >
                  {item.label}
                </span>
              )}
            </BreadcrumbItem>
          </React.Fragment>
        ))}
      </Breadcrumb>
    </nav>
  )
}
