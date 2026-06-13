import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function GtgPageHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
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
      <div className="flex shrink-0 items-center gap-3">
        <Button variant="outline" size="lg">
          Export
        </Button>
        <Button size="lg">
          <Plus aria-hidden="true" />
          New Record
        </Button>
      </div>
    </div>
  )
}
