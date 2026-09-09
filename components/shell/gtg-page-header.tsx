import type { ReactNode } from 'react'

interface GtgPageHeaderProps {
  title: string
  description: string
  /** Buttons for the right-hand side of the header. Rendered — see below. */
  actions?: ReactNode
}

/**
 * A page title, its description, and optional actions beside them.
 *
 * ── TWO DEAD THINGS REMOVED FROM HERE ───────────────────────────────────────
 *
 * 1. `actions` WAS ACCEPTED, TYPED, AND ITS RENDER WAS COMMENTED OUT:
 *
 *        {/* {actions && (
 *          <div className="flex shrink-0 items-center gap-3">{actions}</div>
 *        )} *\/}
 *
 *    So any screen passing `actions` handed over its buttons and they silently
 *    vanished - no error, no warning, nothing in the DOM. Nobody had hit it yet
 *    because the one caller renders its own button row beside this component
 *    instead, which is itself a sign the prop had already been found not to
 *    work. It renders now.
 *
 * 2. A BREADCRUMB THAT WAS BUILT AND DISCARDED. The component took a
 *    `breadcrumbItems` prop, imported `GtgBreadcrumb`, computed
 *    `const breadcrumb = breadcrumbItems ?? contextItems` - and then never used
 *    the variable or the import.
 *
 *    It is removed rather than switched on, because breadcrumbs in this product
 *    come from the shell: `GtgPageShell` resolves them from the live menu tree
 *    and publishes them through context, and a screen opts in with
 *    `<GtgBreadcrumbFromContext />`. Rendering a second one here would have put
 *    two breadcrumbs on any page that does both.
 */
export function GtgPageHeader({ title, description, actions }: GtgPageHeaderProps) {
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

      {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
    </div>
  )
}
