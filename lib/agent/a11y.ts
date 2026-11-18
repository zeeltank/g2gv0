/**
 * Runs axe-core (the accessibility rules engine) over a part of the fake page and answers every violation as one line, so a test can assert there are none.
 *
 * Only the rules a fake DOM can decide are run: the WCAG A and AA ones that look at markup, names, roles and relationships. COLOUR CONTRAST is switched off
 * because jsdom computes no layout and no styles from the stylesheet, so it could only ever answer "cannot tell"; contrast is a check for a real browser.
 * axe-core is in node_modules as a dependency of the lint tooling, not a dependency of this app: if it is ever missing, this throws, so the tests fail loudly
 * instead of passing without having checked anything.
 */
export async function axeViolations(root: Element): Promise<string[]> {
  let axe: typeof import('axe-core')
  try {
    axe = (await import('axe-core')).default
  } catch (cause) {
    throw new Error(`axe-core could not be loaded, so accessibility was NOT checked: ${String(cause)}`)
  }
  const results = await axe.run(root, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    rules: { 'color-contrast': { enabled: false } },
  })
  return results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join('; ')})`)
}
