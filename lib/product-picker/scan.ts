import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

/**
 * Support for the picker's static guard and its vocabulary and contrast scans (slice 15, WPC). No tests of its own: lib/product-picker/guard.test.ts and
 * contrast.test.ts call it, and guard.test.ts proves each scan on made-up source (a scan that cannot see an offence proves nothing). Tests run from the repository root.
 */

/** Source with the comments taken out (block comments, whole-line comments and trailing ones after whitespace; a `//` inside a string, like a URL, is kept). */
export function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/)
    .map((line) => (/^\s*\/\//.test(line) ? '' : line.replace(/(^|[\s;,{(])\/\/[^'"`]*$/, '$1')))
    .join('\n')
}

/** What a person could read in a piece of source: string literals and the text between tags (the same rule as lib/portfolio-list/vocabulary.test.ts). */
export function readableText(source: string): string[] {
  const code = withoutComments(source)
  const out: string[] = []
  for (const m of code.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)) out.push((m[1] ?? m[2] ?? m[3] ?? '').replace(/\$\{[^}]*\}/g, ' '))
  for (const m of code.matchAll(/>([^<>{}\n]*[A-Za-z][^<>{}\n]*)</g)) out.push(m[1])
  for (const m of code.matchAll(/^\s*([A-Z][^<>{}=;]*[a-z.,])\s*$/gm)) out.push(m[1])
  return out
}

// A word is the word only when it is not part of a longer or hyphenated one: `items-center` (a class name) and `itemType` (an identifier) are not offences.
const RETIRED = /(?<![\w-])(catalogues?|catalogs?|offers?|items?|product[ -]lines?|product\s*\/\s*services?)(?![\w-])/i

/** The readable pieces that name a retired word, as "file: piece". A document's "line items" is the document's own word for its rows, not a product word. */
export function retiredWords(file: string, source: string): string[] {
  return readableText(source)
    .map((text) => text.replace(/\bline[ -]items?\b/gi, ' '))
    .filter((text) => RETIRED.test(text) && !/^[a-z]+$/.test(text))
    .map((text) => `${file}: ${text.trim().slice(0, 120)}`)
}

/** Every source file (not a test) under the given roots, as paths relative to the repository root with forward slashes. */
export function sourceFiles(roots: readonly string[]): string[] {
  const found: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue
      const full = path.join(dir, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) found.push(full.split(path.sep).join('/'))
    }
  }
  for (const root of roots) walk(root)
  return found.sort()
}

export const read = (file: string): string => readFileSync(file, 'utf8')

/** The receivers of every `x.getProducts(` call (a definition `getProducts: (` is not a call). `crmService` reads the old catalogue list by item type. */
export function getProductsReceivers(source: string): string[] {
  return [...withoutComments(source).matchAll(/([A-Za-z_$][\w$]*)\s*\.\s*getProducts\s*\(/g)].map((m) => m[1])
}

/** True when the source reads the old catalogue list directly (`GET /crm/products` with no id after it), whatever the helper that does it is called. */
export function readsBareProductList(source: string): boolean {
  return /\bget\s*(?:<[^>]*>)?\s*\(\s*['"`]\/crm\/products['"`]/.test(withoutComments(source))
}

/** True when the source asks the Product Master for its full options list (every Product, Sub-product and item at once). */
export function readsMasterOptions(source: string): boolean {
  const code = withoutComments(source)
  return /\bproductMasterService\s*\.\s*options\s*\(/.test(code) || (/\bproductMasterService\b/.test(code) && /\bservice\s*\.\s*options\s*\(/.test(code))
}
