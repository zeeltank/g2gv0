import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

export type LazyComponent = LazyExoticComponent<ComponentType<any>>

export interface ContentRoute {
  /** Stable tblmenumaster_g2g access_link (preferred match — survives id changes). */
  accessLink?: string
  submenuId?: string
  menuId?: string
  component: LazyComponent
  title?: string
  description?: string
}

export const createLazyComponent = (loader: () => Promise<{ default: ComponentType<any> }>) =>
  lazy(loader)
