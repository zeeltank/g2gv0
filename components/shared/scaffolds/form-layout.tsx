'use client'

import type { FormEvent, ReactNode } from 'react'

/**
 * A form. Browser validation is off (`noValidate`): the server's field-by-field answer is the one source of messages, and it is worded for the person.
 * Submitting runs `onSubmit` and never navigates.
 */
export function FormLayout({ id, onSubmit, children }: { id?: string; onSubmit: () => void; children: ReactNode }) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit()
  }

  return (
    <form id={id} noValidate onSubmit={submit} className="space-y-5">
      {children}
    </form>
  )
}

/** A titled group of fields. `saves` says where the group is saved ("saves to the Portfolio"), because one form can write to several screens. */
export function FormSection({ title, saves, badge, children }: { title: string; saves?: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {saves && <span>{saves}</span>}
          {badge}
        </div>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}

/** Errors that belong to no single field, announced as a group. Nothing is drawn when there are none. */
export function FormErrorSummary({ messages, title = 'This could not be saved' }: { messages: readonly string[]; title?: string }) {
  if (messages.length === 0) return null

  return (
    <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
      <p className="font-medium">{title}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {messages.map((message) => <li key={message}>{message}</li>)}
      </ul>
    </div>
  )
}
