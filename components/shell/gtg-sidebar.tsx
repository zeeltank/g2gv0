'use client'

import { useEffect, useCallback, useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'
import { GTG_NAVIGATION, type ActiveNav } from '@/lib/gtg-navigation'
import { type Role } from '@/lib/gtg-roles'
import { filterNavigationByRole } from '@/lib/gtg-nav-visibility'
import { GtgBrandMark } from './gtg-brand-mark'

export function GtgSidebar({
  active,
  onSelect,
  role = 'admin',
}: {
  active: ActiveNav
  onSelect: (next: ActiveNav) => void
  role?: Role
}) {
  const collapsed = false
  const [flyoutModuleId, setFlyoutModuleId] = useState<string | null>(null)
  const [flyoutMenuId, setFlyoutMenuId] = useState<string | null>(null)
  const [flyoutPosition, setFlyoutPosition] = useState<{ top: number } | null>(null)
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const filteredNav = filterNavigationByRole(role)

  const handleModuleClick = useCallback((moduleId: string, element: HTMLElement) => {
    const rect = element.getBoundingClientRect()
    setFlyoutPosition({ top: rect.top })
    setFlyoutModuleId(moduleId)
    setFlyoutMenuId(null)
  }, [])

  const handleModuleMouseEnter = useCallback((moduleId: string, element: HTMLElement) => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
    const rect = element.getBoundingClientRect()
    setFlyoutPosition({ top: rect.top })
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

  return (
    <>
      <aside
        aria-label="Primary Navigation"
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200',
          collapsed ? 'w-[72px]' : 'w-[260px]',
        )}
        style={{ transitionTimingFunction: 'cubic-bezier(0.22,1,0.36,1)' }}
      >
        <div
          className={cn(
            'flex h-16 shrink-0 items-center border-b border-sidebar-border px-4',
            collapsed && 'justify-center px-0',
          )}
        >
          <GtgBrandMark collapsed={collapsed} />
        </div>

        <nav className={cn("g2g-page-scroll g2g-scrollbar flex-1", collapsed ? "px-2" : "px-3 py-2")}>
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
                    className={cn(
                      'flex items-center rounded-md text-sm font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring',
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

      {/* Flyout Panel - positioned next to the hovered module item */}
      {flyoutModuleId && flyoutPosition && (
        <div
          className={cn(
            'fixed z-30 w-64 rounded-lg border border-border bg-surface shadow-md transition-all duration-150 ease-out',
            flyoutModuleId ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none',
          )}
          style={{
            left: collapsed ? '72px' : '260px',
            top: flyoutPosition?.top,
          }}
          onMouseEnter={handleFlyoutEnter}
          onMouseLeave={handleFlyoutLeave}
        >
          {(() => {
            const module = GTG_NAVIGATION.find((m) => m.id === flyoutModuleId)
            if (!module) return null

            return (
              <>
                <div className="border-b border-border px-4 py-2.5 bg-surface-muted">
                  <h2 className="text-sm font-semibold text-foreground">{module.label}</h2>
                </div>
                <div className="flex flex-col gap-0.5 px-2 py-2">
                  {module.menus.map((menu) => {
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
                            const firstSubmenu = menu.submenus[0]
                            if (firstSubmenu) {
                              setFlyoutModuleId(null)
                              setFlyoutMenuId(null)
                              setFlyoutPosition(null)
                              onSelect({ moduleId: flyoutModuleId, menuId: menu.id, submenuId: firstSubmenu.id })
                            }
                          }}
                          className={cn(
                            'flex h-10 w-full items-center justify-between gap-2 rounded-md px-3 text-sm font-medium transition-colors duration-200 outline-none',
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
                                    'flex h-9 w-full items-center rounded-md px-3 text-left text-sm font-medium transition-colors duration-200 outline-none',
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
      )}
    </>
  )
}
