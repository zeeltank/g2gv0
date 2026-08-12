# `app/api/jobrole-tasks/route.ts` — REMOVED 2026-08-12

## What it was for

A server-side proxy that fetched **the tasks belonging to one job role** for the
job-role/skills management screens. It called the Laravel `table_data` endpoint
against `s_user_jobrole_task`, filtered client-side to the requested `jobRoleId`,
and returned `{id, task_title, task_description}`.

Introduced in `551f6ae` (employee profile and job role skills management).

## Why it was removed

**It could never run.**

    readLaravelSession()  opens with  `if (typeof window === 'undefined') return null`

It is a Next **server-side** API route, so `window` is always undefined, the
session is always null, and the route returned 401 before reaching the Laravel
call. Measured:

    GET /api/jobrole-tasks?jobRoleId=1  ->  401 {"message":"Unauthorized"}

**And nothing called it.** Callers across the frontend: 0.

## The design mistake, so it is not repeated

**A server-side route cannot read a browser session.** `readLaravelSession()` is
`localStorage`-backed and client-only. Any server route needing the Laravel
identity must have it **passed in by the client** - which is what
`job-posting-form.tsx` does correctly, calling `table_data` directly from a
`'use client'` component with `Authorization: Bearer ${session.token}`.

## If this feature is wanted again

Two working shapes:

1. **Call `table_data` from a client component**, as `job-posting-form.tsx` does.
   Simplest, and it is the pattern already proven here.
2. **Keep a server route, but have the client send the token to it**, and forward
   that token onward. Do NOT reach for `readLaravelSession()` on the server.

It also sent `api_key`, which **the Laravel backend never checks** - it has no
inbound `api_key` mechanism at all; all four backend mentions are outbound
third-party keys. That parameter was a false signal and should not be restored.
