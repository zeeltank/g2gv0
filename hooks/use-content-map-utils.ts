import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

/**
 * A screen the content map can mount.
 *
 * ── WHY THIS IS `{}` AND NOT `any` ──────────────────────────────────────────
 *
 * GtgAppShell mounts every content-map screen as `<ContentComponent />` — with
 * NO PROPS. This type was `ComponentType<any>`, and `any` accepts a component
 * with required props, so the contract "the shell passes nothing" was never
 * checked.
 *
 * It cost two finished screens. OrganizationInformation and DepartmentList were
 * both declared `({ role }: { role: Role })`; mounted propless, `role` arrived
 * undefined, `getAccess()` fell through to `'none'`, and both returned "Access
 * Restricted" to every user including the administrator — while 1,290 lines of
 * working department management sat behind them. `tsc` and `next build` both
 * passed the whole time.
 *
 * `ComponentType<{}>` says what is actually true: a screen must be renderable
 * with no props. A component with a REQUIRED prop no longer satisfies it, so
 * the same mistake is now a build error rather than a silent lockout. Optional
 * props are still fine — that is how a screen can accept an override from a
 * preview harness while defaulting to the signed-in user.
 */
export type LazyComponent = LazyExoticComponent<ComponentType<Record<string, never>>>

export interface ContentRoute {
  /** Stable tblmenumaster_g2g access_link (preferred match — survives id changes). */
  accessLink?: string
  submenuId?: string
  menuId?: string
  component: LazyComponent
  title?: string
  description?: string
}

/**
 * The loader's component must also be propless-renderable, for the same reason.
 * Typing this `any` would put the hole straight back, one level down.
 */
export const createLazyComponent = (
  loader: () => Promise<{ default: ComponentType<Record<string, never>> }>,
) => lazy(loader)
