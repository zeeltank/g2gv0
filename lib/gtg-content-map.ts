// Re-export all content map types and functions from hooks/use-content-map.ts
// This maintains backwards compatibility for existing imports from @/lib/gtg-content-map
export {
  M1_CONTENT,
  M2_CONTENT,
  M3_CONTENT,
  M4_CONTENT,
  M5_CONTENT,
  M6_CONTENT,
  MODULE_CONTENT_MAP,
  getContentRoute,
  COMING_SOON_CONTENT,
} from '@/hooks/use-content-map'

export type { LazyComponent, ContentRoute } from '@/hooks/use-content-map'
