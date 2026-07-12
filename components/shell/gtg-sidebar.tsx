'use client'

import { useEffect, useLayoutEffect, useCallback, useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { ChevronRight, ChevronDown, X } from 'lucide-react'
import { GTG_NAVIGATION, type ActiveNav } from '@/hooks/use-navigation'
import type { NavModule } from '@/lib/gtg-navigation'
import { type Role } from '@/hooks/use-role-visibility'
import { filterNavigationByRole } from '@/hooks/use-role-visibility'
import { GtgBrandMark } from '@/components/shell/gtg-brand-mark'

export function GtgSidebar({
  active,
  onSelect,
  role = 'admin',
  mobileOpen = false,
  onMobileClose,
}: {
  active: ActiveNav
  onSelect: (next: ActiveNav) => void
  role?: Role
  mobileOpen?: boolean
  onMobileClose?: () => void
}) {
  const collapsed = true
  const [flyoutModuleId, setFlyoutModuleId] = useState<string | null>(null)
  const [flyoutMenuId, setFlyoutMenuId] = useState<string | null>(null)
  const [flyoutPosition, setFlyoutPosition] = useState<{ top: number; height: number } | null>(null)
  const [flyoutStyle, setFlyoutStyle] = useState<{ top: number; left: number; maxHeight: number; fromLeft: boolean } | null>(null)
  const flyoutRef = useRef<HTMLDivElement>(null)
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null)
  const [expandedMenuId, setExpandedMenuId] = useState<string | null>(null)
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const filteredNav = filterNavigationByRole(role)

  const handleModuleClick = useCallback((moduleId: string, element: HTMLElement) => {
    const rect = element.getBoundingClientRect()
    setFlyoutPosition({ top: rect.top, height: rect.height })
    setFlyoutModuleId(moduleId)
    setFlyoutMenuId(null)
  }, [])

  const handleModuleMouseEnter = useCallback((moduleId: string, element: HTMLElement) => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
    const rect = element.getBoundingClientRect()
    setFlyoutPosition({ top: rect.top, height: rect.height })
    setFlyoutModuleId(moduleId)
    setFlyoutMenuId(null)
  }, [])

  const closeFlyout = useCallback(() => {
    hideTimeoutRef.current = setTimeout(() => {
      setFlyoutModuleId(null)
      setFlyoutMenuId(null)
      setFlyoutPosition(null)
    }, 150)
  }, [])

  const handleFlyoutEnter = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
  }, [])

  const handleFlyoutLeave = useCallback(() => {
    closeFlyout()
  }, [closeFlyout])

  useEffect(() => () => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
  }, [])

  useLayoutEffect(() => {
    if (!flyoutModuleId || !flyoutPosition || !flyoutRef.current) {
      return
    }
    const panel = flyoutRef.current
    const panelW = panel.offsetWidth
    const panelH = panel.scrollHeight
    const vw = window.innerWidth
    const vh = window.innerHeight
    const margin = 8

    const railW = collapsed ? 72 : 260
    const moduleTop = flyoutPosition.top
    const moduleBottom = flyoutPosition.top + flyoutPosition.height

    // Horizontal: open to the right of the rail; flip to the left when there
    // is not enough space, then clamp fully within the viewport.
    let left = railW + 4
    let fromLeft = false
    if (left + panelW > vw - margin) {
      left = railW - panelW - 4
      fromLeft = true
    }
    left = Math.max(margin, Math.min(left, vw - panelW - margin))

    // Vertical: open downward from the module top; flip upward (anchor the
    // panel bottom to the module bottom) when there is not enough space below.
    let top = moduleTop
    let maxHeight = vh - margin - moduleTop
    if (panelH > maxHeight) {
      const upwardTop = moduleBottom - panelH
      if (upwardTop >= margin) {
        top = upwardTop
        maxHeight = panelH
      } else {
        top = margin
        maxHeight = vh - 2 * margin
      }
    }

    setFlyoutStyle({ top, left, maxHeight, fromLeft })
  }, [flyoutModuleId, flyoutPosition, collapsed])

  const handleMobileLeafSelect = useCallback((next: ActiveNav) => {
    onSelect(next)
    onMobileClose?.()
  }, [onSelect, onMobileClose])

  const toggleMobileModule = useCallback((moduleId: string) => {
    setExpandedModuleId((current) => (current === moduleId ? null : moduleId))
    setExpandedMenuId(null)
  }, [])

  const toggleMobileMenu = useCallback((menuId: string) => {
    setExpandedMenuId((current) => (current === menuId ? null : menuId))
  }, [])

  const handleMobileModuleClick = useCallback((module: NavModule) => {
    if (module.menus.length === 1 && module.menus[0].submenus.length === 1) {
      const menu = module.menus[0]
      const submenu = menu.submenus[0]
      handleMobileLeafSelect({ moduleId: module.id, menuId: menu.id, submenuId: submenu.id })
    } else {
      toggleMobileModule(module.id)
    }
  }, [toggleMobileModule, handleMobileLeafSelect])

  useEffect(() => {
    if (!mobileOpen) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onMobileClose?.()
    }
    document.addEventListener('keydown', handleEscape)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = previousOverflow
    }
  }, [mobileOpen, onMobileClose])

  return (
    <>
      {/* Desktop / Tablet icon rail (md and up) */}
      <aside
        aria-label="Primary Navigation"
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 sidebar-transition md:flex',
          collapsed ? 'w-[72px]' : 'w-[260px]',
        )}
      >
        <div
          className={cn(
            'flex h-16 shrink-0 items-center border-b border-sidebar-border px-4',
            collapsed && 'justify-center px-0',
          )}
        >
          <GtgBrandMark collapsed={collapsed} />
        </div>

        <nav className={cn("g2g-page-scroll g2g-scrollbar flex-1", collapsed ? "px-2 py-4" : "px-3 py-4")}>
          <div className={cn("flex flex-col", collapsed ? "gap-2" : "gap-1")}>
            {filteredNav.map((module) => {
              const Icon = module.icon
              const isActive = active.moduleId === module.id

              return (
                <div
                  key={module.id}
                  className="relative"
                >
                  <button
                    type="button"
                    onMouseEnter={(e) => handleModuleMouseEnter(module.id, e.currentTarget)}
                    onClick={(e) => handleModuleClick(module.id, e.currentTarget)}
                    onMouseLeave={closeFlyout}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex items-center cursor-pointer rounded-md text-sm font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      collapsed
                        ? cn(
                            'size-12 justify-center',
                            isActive
                              ? 'text-sidebar-active-foreground bg-sidebar-active rounded-xl'
                              : 'text-sidebar-foreground hover:bg-sidebar-hover',
                          )
                        : cn(
                            'h-10 w-full gap-3 px-2',
                            isActive
                              ? 'text-sidebar-active-foreground bg-sidebar-active'
                              : 'text-sidebar-foreground hover:bg-sidebar-hover',
                          ),
                    )}
                  >
                    <span className={cn(
                      "flex items-center justify-center rounded-md transition-all duration-200",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground",
                      collapsed ? "size-6" : "size-6",
                    )}>
                      <Icon className={cn("shrink-0 transition-transform duration-200", collapsed ? "size-5" : "size-5")} />
                    </span>
                    {!collapsed && (
                      <span className="flex-1 truncate text-left">{module.label}</span>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </nav>
      </aside>

      {/* Mobile off-canvas drawer (<md) */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}
      <aside
        aria-label="Primary Navigation"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-300 ease-out md:hidden sidebar-transition',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-hidden={!mobileOpen}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-sidebar-border px-4">
          <GtgBrandMark />
          <button
            type="button"
            onClick={onMobileClose}
            aria-label="Close navigation"
            className="flex size-9 items-center justify-center rounded-md text-sidebar-foreground transition-colors duration-200 outline-none hover:bg-sidebar-hover focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <nav className="g2g-page-scroll g2g-scrollbar flex-1 overflow-y-auto px-3 py-4">
          <div className="flex flex-col gap-1">
            {filteredNav.map((module) => {
              const Icon = module.icon
              const isModuleActive = active.moduleId === module.id
              const isModuleExpanded = expandedModuleId === module.id

              return (
                <div key={module.id} className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => handleMobileModuleClick(module)}
                    aria-expanded={module.menus.length > 1 || module.menus[0]?.submenus.length > 1 ? isModuleExpanded : undefined}
                    className={cn(
                      'flex h-11 w-full items-center gap-3 rounded-md px-2 text-sm font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isModuleActive
                        ? 'text-sidebar-active-foreground bg-sidebar-active'
                        : 'text-sidebar-foreground hover:bg-sidebar-hover',
                    )}
                  >
                    <span className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-md transition-all duration-200",
                      isModuleActive
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}>
                      <Icon className="size-4 shrink-0" />
                    </span>
                    <span className="flex-1 truncate text-left">{module.label}</span>
                    {module.menus.length > 1 || module.menus[0]?.submenus.length > 1 ? (
                      <ChevronDown
                        className={cn(
                          'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
                          isModuleExpanded && 'rotate-180',
                        )}
                        aria-hidden="true"
                      />
                    ) : null}
                  </button>

                  {isModuleExpanded && (
                    <div className="ml-3 mt-0.5 flex flex-col gap-0.5 border-l border-sidebar-border pl-3">
                      {module.menus.map((menu) => {
                        const isMenuActive = active.menuId === menu.id && active.moduleId === module.id
                        const hasActiveSubmenu = menu.submenus.some((s) => s.id === active.submenuId)
                        const isMenuExpanded = expandedMenuId === menu.id
                        const showExpand = menu.submenus.length > 1

                        return (
                          <div key={menu.id} className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                if (menu.submenus.length === 0) {
                                  handleMobileLeafSelect({ moduleId: module.id, menuId: menu.id, submenuId: menu.id })
                                } else if (menu.submenus.length === 1) {
                                  handleMobileLeafSelect({ moduleId: module.id, menuId: menu.id, submenuId: menu.submenus[0].id })
                                } else {
                                  toggleMobileMenu(menu.id)
                                }
                              }}
                              aria-expanded={showExpand ? isMenuExpanded : undefined}
                              className={cn(
                                'flex h-10 w-full items-center justify-between gap-2 rounded-md px-3 text-sm font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                isMenuActive || hasActiveSubmenu
                                  ? 'bg-primary/15 text-primary font-semibold'
                                  : 'text-sidebar-foreground hover:bg-primary/10',
                              )}
                            >
                              <span className="truncate text-left">{menu.label}</span>
                              {showExpand && (
                                <ChevronRight
                                  className={cn(
                                    'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
                                    isMenuExpanded && 'rotate-90',
                                  )}
                                  aria-hidden="true"
                                />
                              )}
                            </button>

                            {showExpand && isMenuExpanded && (
                              <div className="ml-3 flex flex-col gap-0.5 border-l border-sidebar-border pl-3">
                                {menu.submenus.map((submenu) => {
                                  const isSubmenuActive = active.submenuId === submenu.id && active.menuId === menu.id
                                  return (
                                    <button
                                      key={submenu.id}
                                      type="button"
                                      onClick={() => handleMobileLeafSelect({ moduleId: module.id, menuId: menu.id, submenuId: submenu.id })}
                                      aria-current={isSubmenuActive ? 'page' : undefined}
                                      className={cn(
                                        'flex h-9 w-full items-center rounded-md px-3 text-left text-sm font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                        isSubmenuActive
                                          ? 'bg-primary/15 text-primary font-semibold'
                                          : 'text-sidebar-foreground hover:bg-primary/10',
                                      )}
                                    >
                                      <span className="truncate">{submenu.label}</span>
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </nav>
      </aside>

      {/* Flyout Panel -  positioned next to the hovered module item (md and up) */}
      {flyoutModuleId && flyoutPosition && (() => {
        const flyoutDisplay = flyoutStyle ?? {
          top: flyoutPosition.top,
          left: collapsed ? 72 : 260,
          maxHeight: Math.max(0, window.innerHeight - 16),
          fromLeft: false,
        }

        return (
          <div
            ref={flyoutRef}
            className={cn(
              'fixed z-30 hidden w-64 flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-md transition-all duration-150 ease-out md:flex',
              flyoutModuleId
                ? 'opacity-100 translate-x-0'
                : flyoutDisplay.fromLeft
                  ? 'opacity-0 translate-x-2 pointer-events-none'
                  : 'opacity-0 -translate-x-2 pointer-events-none',
            )}
            style={{
              top: flyoutDisplay.top,
              left: flyoutDisplay.left,
              maxHeight: flyoutDisplay.maxHeight,
            }}
            onMouseEnter={handleFlyoutEnter}
            onMouseLeave={handleFlyoutLeave}
          >
          {(() => {
            const foundModule = GTG_NAVIGATION.find((m) => m.id === flyoutModuleId)
            if (!foundModule) return null

            return (
              <>
                <div className="shrink-0 border-b border-border px-4 py-2.5 bg-surface-muted">
                  <h2 className="text-sm font-semibold text-foreground">{foundModule.label}</h2>
                </div>
                <div className="flex-1 flex flex-col gap-0.5 px-2 py-2 overflow-y-auto g2g-scrollbar">
                  {foundModule.menus.map((menu) => {
                    const isFlyoutMenuOpen = flyoutMenuId === menu.id
                    const isMenuActive = active.menuId === menu.id && active.moduleId === flyoutModuleId
                    const hasActiveSubmenu = menu.submenus.some((s) => s.id === active.submenuId)

                    return (
                      <div
                        key={menu.id}
                        className="flex flex-col gap-0.5"
                        onMouseEnter={() => setFlyoutMenuId(menu.id)}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            // If the menu has no submenus, it would be a standalone page (currently none exist)
                            if (menu.submenus.length === 0) {
                              setFlyoutModuleId(null)
                              setFlyoutMenuId(null)
                              setFlyoutPosition(null)
                              onSelect({ moduleId: flyoutModuleId, menuId: menu.id, submenuId: menu.id })
                            } else {
                              // Toggle the submenu open/close on click
                              setFlyoutMenuId(isFlyoutMenuOpen ? null : menu.id)
                            }
                          }}
                          className={cn(
                            'flex h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-md px-3 text-sm font-medium transition-colors duration-200 outline-none',
                            'focus-visible:ring-2 focus-visible:ring-ring',
                            isMenuActive || hasActiveSubmenu
                              ? 'bg-primary/15 text-primary font-semibold'
                              : 'text-sidebar-foreground hover:bg-primary/10',
                          )}
                        >
                          <span className="truncate">{menu.label}</span>
                          {menu.submenus.length > 0 && (
                            <ChevronRight
                              className={cn(
                                'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
                                isFlyoutMenuOpen && 'rotate-90',
                              )}
                              aria-hidden="true"
                            />
                          )}
                        </button>

                        {menu.submenus.length > 0 && isFlyoutMenuOpen && (
                          <div
                            className="flex flex-col gap-0.5 border-l border-sidebar-border pl-3 ml-3"
                            onMouseEnter={() => setFlyoutMenuId(menu.id)}
                          >
                            {menu.submenus.map((submenu) => {
                              const isSubmenuActive = active.submenuId === submenu.id && active.menuId === menu.id
                              return (
                                <button
                                  key={submenu.id}
                                  type="button"
                                  onClick={() => {
                                    setFlyoutModuleId(null)
                                    setFlyoutMenuId(null)
                                    setFlyoutPosition(null)
                                    onSelect({ moduleId: flyoutModuleId, menuId: menu.id, submenuId: submenu.id })
                                  }}
                                  className={cn(
                                    'flex h-9 w-full cursor-pointer items-center rounded-md px-3 text-left text-sm font-medium transition-colors duration-200 outline-none',
                                    'focus-visible:ring-2 focus-visible:ring-ring',
                                    isSubmenuActive
                                      ? 'bg-primary/15 text-primary font-semibold'
                                      : 'text-sidebar-foreground hover:bg-primary/10',
                                  )}
                                >
                                  <span className="truncate">{submenu.label}</span>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )
          })()}
          </div>
        )
      })()}
    </>
  )
}
