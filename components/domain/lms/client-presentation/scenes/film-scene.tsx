'use client'

import { useRef, useState } from 'react'

import { filmOf } from '@/lib/client-presentation/atlas'
import { themeVars } from '@/lib/client-presentation/palette'

import './s17.css'
import type { SceneProps } from './types'

/**
 * A product film on its own slide, played across the whole stage: it starts by itself (muted, as browsers require) when the slide opens, and a
 * Replay button appears when it ends. The video is a render of film-studio (public/client-presentation/film); every word on it is checked tour text.
 * Like the opening film (s17-film), it carries no rail: the keys 1 to 5 and Next still work, and Next goes on to the tour.
 */
export default function FilmScene({ slide, plan, reduced }: SceneProps & { plan: { key: string; title: string } }) {
  const film = filmOf(plan.key)
  const ref = useRef<HTMLVideoElement>(null)
  const [ended, setEnded] = useState(false)
  if (!film) return null
  const replay = () => {
    const v = ref.current
    if (!v) return
    v.currentTime = 0
    void v.play()
    setEnded(false)
  }
  const label = `${plan.title}: a short silent film of the product`
  return (
    <div className="cp-scene s17" data-theme="ink" data-film={plan.key} style={themeVars('ink')}>
      <video
        ref={ref}
        className="s17-video"
        src={film.src}
        poster={film.poster}
        autoPlay={!reduced}
        muted
        playsInline
        preload="auto"
        controls={reduced}
        aria-label={label}
        onEnded={() => setEnded(true)}
        onPlay={() => setEnded(false)}
      />
      <p className="cp-sr">{label}. {slide.lines[0]?.text}</p>
      {ended && <button type="button" className="s17-replay" onClick={replay}>Replay</button>}
    </div>
  )
}
