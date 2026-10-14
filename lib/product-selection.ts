/**
 * Which product a screen starts on. A saved or linked (`?product=`) value is used only if it names a real product (or "all" where the screen
 * can show several); an intentional valid choice is never replaced. With no usable value a screen that cannot show "all" starts on
 * ScholarClone when it is ready, else the first ready product, else the first product.
 */
export function resolveSelection(stored: string | null | undefined, products: { key: string; ready: boolean }[], allowAll: boolean): string {
  if (stored && products.some((p) => p.key === stored)) return stored
  if (allowAll) return 'all'

  return (products.find((p) => p.key === 'scholarclone' && p.ready) ?? products.find((p) => p.ready) ?? products[0])?.key ?? 'all'
}

/** Where "Product Details & ICP" goes: the existing Product Portfolio route, opened on this product (it reads `?product=`). */
export const configureHref = (productKey: string) => `/portfolio?product=${encodeURIComponent(productKey)}`
