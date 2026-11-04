import * as React from 'react'
import { cn } from '@/lib/utils'

interface BreadcrumbProps extends React.HTMLAttributes<HTMLElement> {}

const Breadcrumb = React.forwardRef<HTMLElement, BreadcrumbProps>(
  ({ className, children, ...props }, ref) => (
    <nav
      ref={ref}
      aria-label="breadcrumb"
      className={cn('flex items-center', className)}
      {...props}
    >
      {/* The items are <li>s, which belong in a list. The list carries the row layout the nav used to carry; its own list styling is reset. */}
      <ol className="m-0 flex list-none items-center p-0">{children}</ol>
    </nav>
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
      'truncate max-w-[220px] transition-colors hover:text-[#0F172A]',
      isActive ? 'font-semibold text-[#0F172A]' : 'text-[#64748B]',
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
    className={cn('shrink-0 select-none text-[#CBD5E1]', className)}
    {...props}
  >
    {'>'}
  </span>
)
BreadcrumbSeparator.displayName = 'BreadcrumbSeparator'

export { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator }
