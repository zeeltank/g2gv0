/*
 * Test support for the public Sales Kit page: a token, the server's answer for a shared entry, and a `fetch` that records what it was asked and answers with whatever the test says. No tests of
 * its own, and nothing here touches the network.
 */

export const API = 'https://api.test/api'
export const TOKEN = 'Ab3'.repeat(16)

/** The server's answer for a shared PowerPoint, with the fields a test cares about changed. */
export const payload = (over: Record<string, unknown> = {}) => ({
  status: 1,
  data: {
    title: 'ScholarClone client presentation',
    description: 'The same story as a PowerPoint.',
    kind: 'presentation',
    source: 'file',
    productName: 'ScholarClone',
    fileName: 'ScholarClone-Client-Presentation.pptx',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    size: 57_400_000,
    url: null,
    deck: null,
    expiresAt: '2026-12-27 12:00:00',
    ...over,
  },
})

/** The answer for a shared file of this type. */
export const fileAnswer = (fileName: string, mimeType: string, kind: string, size = 910_000) => payload({ kind, fileName, mimeType, size, title: `Shared ${fileName}` })

export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

export interface Seen { url: string; init: RequestInit }

export function fakeFetch(answer: () => Response | Promise<Response>) {
  const seen: Seen[] = []
  const impl = (async (input: unknown, init?: RequestInit) => { seen.push({ url: String(input), init: init ?? {} }); return answer() }) as typeof fetch
  return { impl, seen }
}
