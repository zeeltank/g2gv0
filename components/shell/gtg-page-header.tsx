import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ReactNode } from 'react'

interface GtgPageHeaderProps {
  title: string
  description: string
  actions?: ReactNode
}

export function GtgPageHeader({
  title,
  description,
  actions,
}: GtgPageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="flex flex-col gap-2">
        <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
          {title}
        </h1>
        <p className="max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-3">
          {actions}
        </div>
      )}
    </div>
  )
}