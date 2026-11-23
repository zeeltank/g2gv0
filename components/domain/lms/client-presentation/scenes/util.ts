import type { Line } from '@/lib/client-presentation/deck'

/** "Scholar Core: Intelligent School Operations" -> name and description. */
export function splitName(text: string): { name: string; desc: string } {
  const i = text.indexOf(': ')
  return i < 0 ? { name: text, desc: '' } : { name: text.slice(0, i), desc: text.slice(i + 2) }
}

export const nameOf = (l: Line): string => splitName(l.text).name

/** Scene a product opens when tapped (a detour from the ecosystem slide). Scholar One has none: it is the connecting layer. */
export const PRODUCT_SCENE: Record<string, string> = {
  'Scholar Core': 's7',
  'Scholar Learn': 's8',
  'Scholar CCB': 's10',
  'Scholar Insight': 's11',
  'Scholar Compass': 's12',
}
