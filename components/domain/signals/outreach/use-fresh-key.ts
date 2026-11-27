'use client'

import { useState } from 'react'

/**
 * A number that goes up every time `open` turns true. A dialog puts it on its form as the `key`, so each opening starts from an empty form even when the last one is still fading
 * out on the page (the closed dialog keeps its content for the length of the fade, and a form that was only "unmounted by closing" would come back with the old words in it).
 */
export function useFreshKey(open: boolean): number {
  const [state, setState] = useState({ key: 0, open })
  if (state.open !== open) setState({ key: open ? state.key + 1 : state.key, open })
  return state.key
}
