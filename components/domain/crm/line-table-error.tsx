/**
 * The one sentence a line table shows when the server refused the last save (S16, 25 Nov 2026): a Sub-product that is priced in one currency cannot go on a document in
 * another ("<Sub-product> is priced in INR, this document is in USD."). It sits above the lines, as an alert, so a screen reader hears it and a person sees which table it
 * belongs to. Nothing is drawn without a sentence.
 */
export function LineTableError({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <p role="alert" data-line-table-error className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
      {message}
    </p>
  )
}
