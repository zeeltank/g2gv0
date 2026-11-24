import raw from './generated/film.json'

/**
 * The 59-second film. Text only (the claims behind each line stay in docs/client-presentation and are checked there). The film is motion
 * graphics with made-up school data, not a screen recording.
 */
export interface FilmLine {
  role: string
  text: string
}

export interface FilmBeat {
  id: string
  start: number
  end: number
  lines: FilmLine[]
}

export interface Film {
  title: string
  length: number
  fps: number
  disclosure: string
  beats: FilmBeat[]
}

export const FILM = raw as Film

export const beatOf = (id: string): FilmBeat => {
  const b = FILM.beats.find((x) => x.id === id)
  if (!b) throw new Error(`film: no beat ${id}`)
  return b
}
export const lineOf = (b: FilmBeat, role: string): string => b.lines.find((l) => l.role === role)?.text ?? ''
export const linesOf = (b: FilmBeat, role: string): string[] => b.lines.filter((l) => l.role === role).map((l) => l.text)
/** "Scholar Core: Intelligent School Operations" -> name and description. */
export const splitProduct = (text: string): { name: string; desc: string } => {
  const i = text.indexOf(': ')
  return i < 0 ? { name: text, desc: '' } : { name: text.slice(0, i), desc: text.slice(i + 2) }
}
