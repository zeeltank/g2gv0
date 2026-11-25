'use client'

import { useRef, useState } from 'react'

import { textOf } from '@/lib/client-presentation/deck'
import { themeVars } from '@/lib/client-presentation/palette'

import './s17.css'
import type { SceneProps } from './types'

/**
 * The 59-second film, played across the whole stage. It starts by itself (muted, as browsers require) when the scene opens, and a Replay
 * button appears when it ends. The film is a rendered video (public/client-presentation/film), motion graphics with made-up school data.
 */
export const BEATS = 0

const FILM_SRC = '/client-presentation/film/scholarclone-59s.mp4'
const POSTER = '/client-presentation/film/scholarclone-59s-poster.jpg'

export default function Scene({ slide, reduced }: SceneProps) {
  const ref = useRef<HTMLVideoElement>(null)
  const [ended, setEnded] = useState(false)
  const replay = () => {
    const v = ref.current
    if (!v) return
    v.currentTime = 0
    void v.play()
    setEnded(false)
  }
  return (
    <div className="cp-scene s17" data-theme="ink" style={themeVars('ink')}>
      <video
        ref={ref}
        className="s17-video"
        src={FILM_SRC}
        poster={POSTER}
        autoPlay={!reduced}
        muted
        playsInline
        preload="auto"
        controls={reduced}
        aria-label={textOf(slide, 'headline')}
        onEnded={() => setEnded(true)}
        onPlay={() => setEnded(false)}
      />
      <p className="cp-sr">{textOf(slide, 'headline')}. {textOf(slide, 'note')}</p>
      {ended && <button type="button" className="s17-replay" onClick={replay}>Replay</button>}
    </div>
  )
}
