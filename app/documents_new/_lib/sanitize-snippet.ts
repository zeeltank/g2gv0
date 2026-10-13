/**
 * Search snippets arrive from the server as text with <mark> around matches.
 * Everything is escaped, then only the <mark> tags are restored, so nothing a
 * document contains can become markup.
 */
export function sanitizeSnippet(html: string): string {
  return html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&lt;mark&gt;/g, '<mark>')
    .replace(/&lt;\/mark&gt;/g, '</mark>');
}
