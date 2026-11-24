'use client'

import type { Asset } from '@/lib/client-presentation/deck'

import { Photo } from '../ui/primitives'
import './s01-hook.css'

/**
 * Points of light and threads over a classroom photograph, used by the opening slide and again, resolved, by the invitation.
 * Class names (hb-*) are what the two scenes' timelines select. Coordinates are in the 1920 x 1080 stage.
 */
export const HOOK_POINTS: [number, number][] = [
  [1340, 300], [1520, 400], [1720, 330], [1450, 560], [1650, 640], [1340, 720], [1780, 800], [1560, 860], [1230, 880],
]
// Each thread starts and ends on points; the opening draws them only part of the way, the invitation completes one.
export const HOOK_THREADS = [
  'M1340 300 Q1430 340 1520 400 T1720 330',
  'M1450 560 Q1580 540 1650 640 T1780 800',
  'M1340 720 Q1440 800 1560 860',
]

export function HookBackdrop({ asset }: { asset: Asset | null }) {
  return (
    <>
      <Photo asset={asset} alt="A modern Indian school classroom in soft morning light" className="hb-base" showCredit={false} />
      <Photo asset={asset} alt="" className="hb-sharp" showCredit />
      <div className="hb-scrim" />
      <svg className="hb-web" viewBox="0 0 1920 1080" aria-hidden="true">
        {HOOK_THREADS.map((d, i) => (
          <path key={i} className={`hb-t hb-t${i + 1}`} d={d} fill="none" stroke="#9fd0ff" strokeWidth="2" strokeLinecap="round" />
        ))}
        {HOOK_POINTS.map(([x, y], i) => (
          <g key={i} className="hb-pt" transform={`translate(${x} ${y})`}>
            <circle r="16" fill="none" stroke="#9fd0ff" strokeOpacity="0.35" strokeWidth="1.5" />
            <circle r="5" fill="#ffffff" />
          </g>
        ))}
      </svg>
    </>
  )
}
