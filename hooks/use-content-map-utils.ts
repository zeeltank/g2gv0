import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

export type LazyComponent = LazyExoticComponent<ComponentType<any>>

export interface ContentRoute {
  submenuId?: string
  menuId?: string
  component: LazyComponent
  title?: string
  description?: string
}

export const createLazyComponent = (loader: () => Promise<{ default: ComponentType<any> }>) =>
  lazy(loader)
