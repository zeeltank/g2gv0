import type { ComponentType } from 'react'

import { FULL_ORDER, SHORT_ORDER } from '@/lib/client-presentation/navigation'

import S01, { BEATS as B01 } from './s01-hook'
import S02, { BEATS as B02 } from './s02-hidden-question'
import S03, { BEATS as B03 } from './s03-familiar-situation'
import S04, { BEATS as B04 } from './s04-info-to-action'
import S05, { BEATS as B05 } from './s05-introducing'
import S06, { BEATS as B06 } from './s06-ecosystem'
import S07, { BEATS as B07 } from './s07-core'
import S08, { BEATS as B08 } from './s08-learn'
import S09, { BEATS as B09 } from './s09-teacher-ai'
import S10, { BEATS as B10 } from './s10-ccb'
import S11, { BEATS as B11 } from './s11-insight'
import S12, { BEATS as B12 } from './s12-compass'
import S13, { BEATS as B13 } from './s13-connected'
import S14, { BEATS as B14 } from './s14-principals-day'
import S15, { BEATS as B15 } from './s15-invitation'
import S16, { BEATS as B16 } from './s16-see-it-work'
import S17, { BEATS as B17 } from './s17-film'
import Short2, { BEATS as BS2 } from './short-2-hidden-challenge'
import Short3, { BEATS as BS3 } from './short-3-approach'
import type { SceneProps } from './types'

export interface SceneDef {
  key: string
  /** Slide numbers whose text the scene shows; the first one supplies the presenter notes. */
  slides: number[]
  beats: number
  Component: ComponentType<SceneProps>
}

export const SCENES: Record<string, SceneDef> = {
  s1: { key: 's1', slides: [1], beats: B01, Component: S01 },
  s2: { key: 's2', slides: [2], beats: B02, Component: S02 },
  s3: { key: 's3', slides: [3], beats: B03, Component: S03 },
  s4: { key: 's4', slides: [4], beats: B04, Component: S04 },
  s5: { key: 's5', slides: [5], beats: B05, Component: S05 },
  s6: { key: 's6', slides: [6], beats: B06, Component: S06 },
  s7: { key: 's7', slides: [7], beats: B07, Component: S07 },
  s8: { key: 's8', slides: [8], beats: B08, Component: S08 },
  s9: { key: 's9', slides: [9], beats: B09, Component: S09 },
  s10: { key: 's10', slides: [10], beats: B10, Component: S10 },
  s11: { key: 's11', slides: [11], beats: B11, Component: S11 },
  s12: { key: 's12', slides: [12], beats: B12, Component: S12 },
  s13: { key: 's13', slides: [13], beats: B13, Component: S13 },
  s14: { key: 's14', slides: [14], beats: B14, Component: S14 },
  s15: { key: 's15', slides: [15], beats: B15, Component: S15 },
  s16: { key: 's16', slides: [16], beats: B16, Component: S16 },
  s17: { key: 's17', slides: [17], beats: B17, Component: S17 },
  'short-2': { key: 'short-2', slides: [2, 4], beats: BS2, Component: Short2 },
  'short-3': { key: 'short-3', slides: [5, 6], beats: BS3, Component: Short3 },
}

export const beatsOf = (key: string): number => SCENES[key]?.beats ?? 0

// A scene key in either order must exist, or navigation would land on nothing.
for (const k of [...FULL_ORDER, ...SHORT_ORDER]) {
  if (!SCENES[k]) throw new Error(`client presentation: no scene registered for ${k}`)
}
