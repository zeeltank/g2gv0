const SIDEBAR_FIRST_OPEN_KEY = 'gtg-sidebar-expand-on-first-open'

export function requestSidebarFirstOpenExpansion() {
  localStorage.setItem(SIDEBAR_FIRST_OPEN_KEY, 'true')
}

export function consumeSidebarFirstOpenExpansion() {
  const shouldExpand = localStorage.getItem(SIDEBAR_FIRST_OPEN_KEY) === 'true'
  localStorage.removeItem(SIDEBAR_FIRST_OPEN_KEY)
  return shouldExpand
}

export function clearSidebarFirstOpenExpansion() {
  localStorage.removeItem(SIDEBAR_FIRST_OPEN_KEY)
}
