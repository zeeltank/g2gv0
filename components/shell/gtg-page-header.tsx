import type { ReactNode } from 'react'
import { GtgBreadcrumb, useBreadcrumbItems, type BreadcrumbItem } from '@/components/shell/gtg-breadcrumb'

interface GtgPageHeaderProps {
  title: string
  description: string
  actions?: ReactNode
  breadcrumbItems?: BreadcrumbItem[]
}

export function GtgPageHeader({
  title,
  description,
  actions,
  breadcrumbItems,
}: GtgPageHeaderProps) {
  const contextItems = useBreadcrumbItems()
  const breadcrumb = breadcrumbItems ?? contextItems

  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="flex flex-col gap-2">
        <h1 className="text-balance text-xl font-bold tracking-tight text-foreground lg:text-3xl">
          {title}
        </h1>
        <p className="max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {/* {actions && (
        <div className="flex shrink-0 items-center gap-3">
          {actions}
        </div>
      )} */}
    </div>
  )
}
