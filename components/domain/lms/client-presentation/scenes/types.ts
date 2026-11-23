import type { ComponentType } from 'react'

import type { Deck, Slide } from '@/lib/client-presentation/deck'

import type { Entry } from '../motion/use-beat-timeline'

export interface SceneNav {
  /** Open another scene and come back to this one at the same beat (nothing is scored). */
  detour: (key: string) => void
  /** Leave for another scene, no way back. */
  goto: (key: string) => void
  /** Return from a detour. */
  returnBack: () => void
  canReturn: boolean
}

export interface SceneProps {
  deck: Deck
  /** The scene's own slide (the first slide for the merged scenes of the five-slide cut). */
  slide: Slide
  beat: number
  beats: number
  entry: Entry
  reduced: boolean
  nav: SceneNav
  /** True in the five-slide version. */
  short: boolean
}

export interface SceneModule {
  default: ComponentType<SceneProps>
  /** How many presses of Next reveal this scene in steps, after its entrance. */
  BEATS: number
}
