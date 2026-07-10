'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface AttendancePaginationProps extends React.HTMLAttributes<HTMLDivElement> {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

export function AttendancePagination({
  page,
  pageSize,
  total,
  onPageChange,
  className,
  ...props
}: AttendancePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const pages = React.useMemo(() => {
    const pagesList: (number | string)[] = []
    const maxVisible = 5

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pagesList.push(i)
    } else {
      pagesList.push(1)

      if (page > 3) {
        pagesList.push('...')
      }

      const start = Math.max(2, page - 1)
      const end = Math.min(totalPages - 1, page + 1)

      for (let i = start; i <= end; i++) {
        if (!pagesList.includes(i)) pagesList.push(i)
      }

      if (page < totalPages - 2) {
        if (!pagesList.includes('...')) pagesList.push('...')
      }

      pagesList.push(totalPages)
    }

    return pagesList
  }, [page, totalPages])

  return (
    <div
      className={cn(
        'flex items-center justify-between border-t border-border bg-card px-4 py-3',
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Rows per page:</span>
        <span className="text-sm font-medium text-foreground">{pageSize}</span>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
          aria-label="First page"
        >
          «
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          ‹
        </Button>

        {pages.map((p, i) =>
          typeof p === 'number' ? (
            <Button
              key={p}
              variant={page === p ? 'default' : 'outline'}
              size="icon"
              className="size-8"
              onClick={() => onPageChange(p)}
              aria-label={`Page ${p}`}
              aria-current={page === p ? 'page' : undefined}
            >
              {p}
            </Button>
          ) : (
            <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground">
              {p}
            </span>
          ),
        )}

        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          ›
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages}
          aria-label="Last page"
        >
          »
        </Button>
      </div>
    </div>
  )
}