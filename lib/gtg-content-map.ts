// Re-export all content map types and functions from hooks/use-content-map.ts
// This maintains backwards compatibility for existing imports from @/lib/gtg-content-map
export {
  loadContentRoute,
  loadContentRoutes,
  COMING_SOON_CONTENT,
} from '@/hooks/use-content-map'

export type { LazyComponent, ContentRoute } from '@/hooks/use-content-map'
