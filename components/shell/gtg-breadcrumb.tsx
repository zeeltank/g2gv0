import * as React from 'react'
import { cn } from '@/lib/utils'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator } from '@/components/ui/breadcrumb'

export interface BreadcrumbItem {
  label: string
  href?: string
}

const BreadcrumbItemsContext = React.createContext<BreadcrumbItem[] | undefined>(undefined)

export function BreadcrumbItemsProvider({
  items,
  children,
}: {
  items: BreadcrumbItem[]
  children: React.ReactNode
}) {
  return <BreadcrumbItemsContext.Provider value={items}>{children}</BreadcrumbItemsContext.Provider>
}

export function useBreadcrumbItems(): BreadcrumbItem[] | undefined {
  return React.useContext(BreadcrumbItemsContext)
}

export function GtgBreadcrumb({
  items,
}: {
  items: BreadcrumbItem[]
}) {
  if (!items.length) return null

  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
      <Breadcrumb>
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <React.Fragment key={index}>
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {item.href && !isLast ? (
                  <BreadcrumbLink href={item.href} isActive={isLast}>
                    {item.label}
                  </BreadcrumbLink>
                ) : (
                  <span
                    className={cn(
                      'truncate max-w-[220px]',
                      isLast ? 'font-medium text-[#374151]' : 'text-[#6B7280]',
                    )}
                  >
                    {item.label}
                  </span>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          )
        })}
      </Breadcrumb>
    </nav>
  )
}

export function GtgBreadcrumbFromContext() {
  const items = useBreadcrumbItems()
  if (!items?.length) return null
  return <GtgBreadcrumb items={items} />
}
