# `app/api/jobrole-task-description/route.ts` — REMOVED 2026-09-29

## What it was for

A server-side proxy that fetched a job role task's description text from the
Laravel `/jobrole-task-description` endpoint, for the job-role/skills
management screens.

## Why it was removed

**Same design mistake as the sibling `app/api/jobrole-tasks/route.ts`
(see that folder's own `REMOVED.md`, 2026-08-12), independently rediscovered
during the 2026-09-29 security fix pass:**

    readLaravelSession()  opens with  `if (typeof window === 'undefined') return null`

This is a Next **server-side** API route, so `window` is always undefined, the
session is always null, and the route returned 401 before ever reaching the
Laravel call.

**And nothing called it.** The only real caller of task descriptions,
`services/task/index.ts`'s `getTaskDescription()`, calls
`apiClient.get('/jobrole-task-description', ...)` — that goes straight to the
Laravel backend directly through the shared `apiClient` (which already
attaches a real `Authorization: Bearer` header), not to this Next.js route.
Grepping the whole repo for the literal path `/api/jobrole-task-description`
finds zero callers.

## The design mistake, so it is not repeated

**A server-side route cannot read a browser session.** `readLaravelSession()`
is `localStorage`-backed and client-only. Any server route needing the
Laravel identity must have it **passed in by the client** — see the sibling
`jobrole-tasks/REMOVED.md` for the two working shapes if a server-side proxy
for this data is wanted again.
