'use client'

import { useState, useSyncExternalStore } from 'react'
import { AskSession, type AskSessionOptions, type AskSessionState } from './session'

/** One chat session for the life of the widget, and its state handed to React. The options are read once, when the session is made. */
export function useAskSession(options: AskSessionOptions): { session: AskSession; state: AskSessionState } {
  const [session] = useState(() => new AskSession(options))
  const state = useSyncExternalStore(session.subscribe, session.getState, session.getState)
  return { session, state }
}
