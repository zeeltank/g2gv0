import { ATLAS_KEYS } from './atlas'
import type { Mode } from './navigation'

/**
 * Where the deck opens, from the page address: ?slide=, ?beat=, ?mode=short. Shared by the signed-in page
 * (app/module/lms/learning/client-presentation) and the public share page (app/present) so the two cannot drift apart.
 * Anything out of range is ignored, never trusted.
 */
export function deckStart(search: { get(name: string): string | null } | null): { initialSlide: number | undefined; initialBeat: number | undefined; mode: Mode } {
  const slideParam = Number(search?.get('slide') ?? NaN)
  // 1 to 17 are the story slides; 201 and up the Product Atlas slides
  const initialSlide = Number.isInteger(slideParam) && ((slideParam >= 1 && slideParam <= 17) || (slideParam > 200 && slideParam <= 200 + ATLAS_KEYS.length)) ? slideParam : undefined
  const beatParam = Number(search?.get('beat') ?? NaN)
  return {
    initialSlide,
    initialBeat: Number.isInteger(beatParam) && beatParam > 0 ? beatParam : undefined,
    mode: search?.get('mode') === 'short' ? 'short' : 'full',
  }
}
