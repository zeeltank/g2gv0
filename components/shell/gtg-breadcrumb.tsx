import * as React from 'react'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator } from '@/components/ui/breadcrumb'

export function GtgBreadcrumb({
  module,
  menu,
  submenu,
}: {
  module: string
  menu: string
  submenu: string
}) {
  const trail = [module, menu].filter(Boolean)

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex h-11 shrink-0 items-center border-b border-border bg-card px-6"
    >
      <Breadcrumb>
        <BreadcrumbItem>
          <BreadcrumbLink href="/">Home</BreadcrumbLink>
        </BreadcrumbItem>
        {trail.map((item, index) => (
          <React.Fragment key={index}>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#">{item}</BreadcrumbLink>
            </BreadcrumbItem>
          </React.Fragment>
        ))}
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <span className="truncate text-sm font-medium text-foreground">{submenu}</span>
        </BreadcrumbItem>
      </Breadcrumb>
    </nav>
  )
}
