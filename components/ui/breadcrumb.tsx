import * as React from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BreadcrumbProps extends React.HTMLAttributes<HTMLElement> {}

const Breadcrumb = React.forwardRef<HTMLElement, BreadcrumbProps>(
  ({ className, ...props }, ref) => (
    <nav
      ref={ref}
      aria-label="breadcrumb"
      className={cn('flex items-center', className)}
      {...props}
    />
  ),
)
Breadcrumb.displayName = 'Breadcrumb'

interface BreadcrumbItemProps extends React.HTMLAttributes<HTMLLIElement> {}

const BreadcrumbItem = React.forwardRef<HTMLLIElement, BreadcrumbItemProps>(
  ({ className, ...props }, ref) => (
    <li
      ref={ref}
      className={cn('flex items-center', className)}
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
      'text-sm transition-colors hover:text-foreground truncate max-w-[200px]',
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
    aria-hidden="true"
    className={cn('text-muted-foreground shrink-0', className)}
    {...props}
  >
    <ChevronRight className="size-4" />
  </span>
)
BreadcrumbSeparator.displayName = 'BreadcrumbSeparator'

export { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator }
