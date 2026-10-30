/**
 * Which product a screen starts on. A saved or linked (`?product=`) value is used only if it names a real product (or "all" where the screen
 * can show several); an intentional valid choice is never replaced. With no usable value a screen that cannot show "all" starts on
 * ScholarClone when it is ready, else the first ready product, else the first product.
 */
export function resolveSelection(stored: string | null | undefined, products: { key: string; ready: boolean; offers?: { offer_id: string }[] }[], allowAll: boolean, allowSub = false): string {
  if (stored && products.some((p) => p.key === stored)) return stored
  // A remembered sub-product choice ("product::OFFER-ID") is kept while that product still has that sub-product; otherwise the product itself.
  const split = splitChoice(stored)
  if (split.offerId && split.productKey) {
    const owner = products.find((p) => p.key === split.productKey)
    if (owner) return allowSub && (owner.offers ?? []).some((o) => o.offer_id === split.offerId) ? (stored as string) : owner.key
  }
  if (allowAll) return 'all'

  return (products.find((p) => p.key === 'scholarclone' && p.ready) ?? products.find((p) => p.ready) ?? products[0])?.key ?? 'all'
}

/** The product screen's choice is either a product key or a sub-product of it: "scholarclone::SCH-11". */
export const SUB_SEPARATOR = '::'

export const choiceOf = (productKey: string, offerId?: string | null): string => (offerId ? `${productKey}${SUB_SEPARATOR}${offerId}` : productKey)

export function splitChoice(choice: string | null | undefined): { productKey: string | null; offerId: string | null } {
  if (!choice) return { productKey: null, offerId: null }
  const at = choice.indexOf(SUB_SEPARATOR)

  return at < 0 ? { productKey: choice, offerId: null } : { productKey: choice.slice(0, at) || null, offerId: choice.slice(at + SUB_SEPARATOR.length) || null }
}

/** Where "Product Details & ICP" goes: that one product's own page (details, ICP and offers), never the whole Product Portfolio. */
export const configureHref = (productKey: string) => `/portfolio/${encodeURIComponent(productKey)}`

/** The same page opened on its ICP tab. */
export const icpHref = (productKey: string) => `${configureHref(productKey)}?tab=icp`

/** The page tabs of one product. An unknown or missing `?tab=` opens the overview. */
export const PRODUCT_TABS = ['overview', 'icp', 'offers'] as const
export type ProductTab = (typeof PRODUCT_TABS)[number]
export const resolveTab = (value: string | null | undefined): ProductTab => (PRODUCT_TABS as readonly string[]).includes(value ?? '') ? (value as ProductTab) : 'overview'

export type IcpStatus = 'ready' | 'draft' | 'incomplete' | 'invalid'

/** The ICP's readiness in one word, read only from what the server stored for the product (nothing is assumed). */
export function icpStatus(product: { state: 'ready' | 'needs_setup' | 'invalid'; draft_icp: unknown | null }): { key: IcpStatus; label: string } {
  if (product.state === 'ready') return { key: 'ready', label: 'ICP ready' }
  if (product.state === 'invalid') return { key: 'invalid', label: 'ICP invalid' }
  if (product.draft_icp) return { key: 'draft', label: 'ICP draft' }

  return { key: 'incomplete', label: 'ICP incomplete' }
}

/**
 * Normalizes any product key or route segment to its canonical registered key.
 * Handles hyphens, underscores, casing, spaces, and common aliases (e.g., enterprise-brain -> enterprise_brain).
 */
export function normalizeProductKey(
  input: string | null | undefined,
  availableProducts?: { key: string; label?: string }[]
): string {
  if (!input) return ''
  let raw = ''
  try {
    raw = decodeURIComponent(input).trim().toLowerCase()
  } catch {
    raw = String(input).trim().toLowerCase()
  }
  if (!raw) return ''

  if (availableProducts && availableProducts.length > 0) {
    const exact = availableProducts.find((p) => p.key === raw || p.key.toLowerCase() === raw)
    if (exact) return exact.key

    const rawClean = raw.replace(/[-_ ]/g, '')
    const relaxed = availableProducts.find((p) => {
      const kClean = p.key.toLowerCase().replace(/[-_ ]/g, '')
      const lClean = p.label ? p.label.toLowerCase().replace(/[-_ ]/g, '') : ''
      return kClean === rawClean || lClean === rawClean
    })
    if (relaxed) return relaxed.key
  }

  // Built-in standard canonical keys
  const clean = raw.replace(/[-_ ]/g, '')
  if (clean === 'enterprisebrain' || clean === 'eb') return 'enterprise_brain'
  if (clean === 'scholarclone' || clean === 'scholar') return 'scholarclone'
  if (clean === 'g2g') return 'g2g'

  return raw
}

