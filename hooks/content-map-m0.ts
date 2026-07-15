import { createLazyComponent, type ContentRoute } from './use-content-map-utils'

const MainDashboard = createLazyComponent(() =>
  import('@/components/domain/main-dashboard').then((module) => ({ default: module.MainDashboard })),
)

export const M0_CONTENT: ContentRoute[] = [
  {
    menuId: 'main-dashboard',
    submenuId: 'main-dashboard',
    component: MainDashboard,
  },
]
