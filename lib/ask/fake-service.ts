import type { AskApi, AskRequest } from '../../services/agent/ask-types'
import { answer, conversation, page } from './fixtures'

export interface FakeAskCalls {
  ask: AskRequest[]
  conversations: Array<{ page?: number; per_page?: number }>
  conversation: number[]
}

/**
 * A stand-in for the Ask API for the chat's tests. Every call is recorded exactly as the chat made it, and `overrides` replace what a method answers (or throws).
 * Nothing here touches the network.
 */
export function fakeAskService(overrides: Partial<AskApi> = {}) {
  const calls: FakeAskCalls = { ask: [], conversations: [], conversation: [] }
  const service: AskApi = {
    ask: async (request) => { calls.ask.push(request); return overrides.ask ? overrides.ask(request) : answer() },
    conversations: async (params) => { calls.conversations.push(params); return overrides.conversations ? overrides.conversations(params) : page() },
    conversation: async (id) => { calls.conversation.push(id); return overrides.conversation ? overrides.conversation(id) : conversation() },
  }
  return { service, calls }
}

/** A promise that is settled by hand, so a test decides the order in which answers arrive. */
export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}
