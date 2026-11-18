/**
 * Renders a search snippet that contains `<mark>...</mark>` around the
 * matched text, WITHOUT `dangerouslySetInnerHTML`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS MATTERS HERE SPECIFICALLY
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The snippet comes from `DocumentSearchService` on the server, built by
 * wrapping a match inside a slice of the UPLOADED DOCUMENT'S OWN EXTRACTED
 * TEXT (see `DocumentSearchService::snippets()`). That text is not HTML-
 * escaped on the server - it is literally what somebody's PDF or DOCX
 * contained. A document whose content happens to include `<img src=x
 * onerror=...>` would, if this were rendered with `dangerouslySetInnerHTML`,
 * execute in the browser of every colleague whose search matched it. The
 * only part of the string that is genuinely markup is the `<mark>` the
 * server added; everything else is untrusted content and must stay text.
 *
 * This splits on literal `<mark>…</mark>` boundaries and renders each piece
 * as a plain string (React escapes text children automatically), wrapping
 * only the matched piece in a real `<mark>` element. No other tag in the
 * string - intentional or accidental - is ever interpreted as markup.
 */
export function HighlightedSnippet({ text }: { text: string }) {
  const parts = text.split(/(<mark>.*?<\/mark>)/g)

  return (
    <>
      {parts.map((part, index) => {
        const match = /^<mark>(.*)<\/mark>$/.exec(part)

        if (match) {
          return (
            <mark key={index} className="rounded bg-primary/20 px-0.5 text-foreground">
              {match[1]}
            </mark>
          )
        }

        return part ? <span key={index}>{part}</span> : null
      })}
    </>
  )
}
