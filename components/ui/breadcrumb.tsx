import * as React from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BreadcrumbProps extends React.OlHTMLAttributes<HTMLOListElement> {}

const Breadcrumb = React.forwardRef<HTMLOListElement, BreadcrumbProps>(
  ({ className, ...props }, ref) => (
    <nav
      aria-label="breadcrumb"
      className={cn('flex w-full', className)}
      {...props}
    >
      <ol
        ref={ref}
        className="flex flex-wrap items-center gap-1.5"
        {...props}
      />
    </nav>
  ),
)
Breadcrumb.displayName = 'Breadcrumb'

interface BreadcrumbItemProps extends React.LiHTMLAttributes<HTMLLIElement> {}

const BreadcrumbItem = React.forwardRef<HTMLLIElement, BreadcrumbItemProps>(
  ({ className, ...props }, ref) => (
    <li
      ref={ref}
      className={cn('inline-flex items-center gap-1.5', className)}
      {...props}
    />
  ),
)
BreadcrumbItem.displayName = 'BreadcrumbItem'

interface BreadcrumbLinkProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  isActive?: boolean
}

const BreadcrumbLink = React.forwardRef<
  HTMLAnchorElement,
  BreadcrumbLinkProps
>(({ className, isActive, ...props }, ref) => (
  <a
    ref={ref}
    className={cn(
      'text-sm transition-colors hover:text-foreground',
      isActive
        ? 'text-foreground font-medium'
        : 'text-muted-foreground',
      className,
    )}
    {...props}
  />
))
BreadcrumbLink.displayName = 'BreadcrumbLink'

const BreadcrumbSeparator = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => (
  <span
    role="presentation"
    className={cn(
      'text-muted-foreground',
      className,
    )}
    {...props}
  >
    <ChevronRight className="size-4" />
  </span>
)
BreadcrumbSeparator.displayName = 'BreadcrumbSeparator'

export { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator }
