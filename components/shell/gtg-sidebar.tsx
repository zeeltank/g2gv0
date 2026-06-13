'use client'

import { useState, useCallback } from 'react'
import React from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  GTG_NAVIGATION,
  type ActiveNav,
  type NavModule,
} from '@/lib/gtg-navigation'
import { type Role } from '@/lib/gtg-roles'
import { filterNavigationByRole } from '@/lib/gtg-nav-visibility'
import { GtgBrandMark } from './gtg-brand-mark'

export function GtgSidebar({
  collapsed,
  active,
  onSelect,
  role = 'admin',
}: {
  collapsed: boolean
  active: ActiveNav
  onSelect: (next: ActiveNav) => void
  role?: Role
}) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(active.menuId)
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(
    active.moduleId,
  )
  const filteredNav = filterNavigationByRole(role)

  const toggleModule = useCallback((moduleId: string) => {
    setExpandedModuleId((current) =>
      current === moduleId ? null : moduleId,
    )
  }, [])

  const toggleMenu = useCallback((menuId: string) => {
    setOpenMenuId((current) => (current === menuId ? null : menuId))
  }, [])

  // Auto-expand module and menu when active changes
  React.useEffect(() => {
    if (active.moduleId && active.moduleId !== expandedModuleId) {
      setExpandedModuleId(active.moduleId)
      setOpenMenuId(active.menuId)
    }
  }, [active.moduleId, active.menuId, expandedModuleId])

  return (
    <aside
      aria-label="Primary"
      className={cn(
        'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-card transition-[width] duration-240',
        collapsed ? 'w-[72px]' : 'w-[260px]',
      )}
      style={{ transitionTimingFunction: 'cubic-bezier(0.22,1,0.36,1)' }}
    >
      <div
        className={cn(
          'flex h-16 shrink-0 items-center border-b border-border px-4',
          collapsed && 'justify-center px-0',
        )}
      >
        <GtgBrandMark collapsed={collapsed} />
      </div>

      <nav className="g2g-page-scroll g2g-scrollbar flex-1 px-3 pb-6">
        {filteredNav.map((module) => {
          const isModuleExpanded = expandedModuleId === module.id
          
          return (
            <div key={module.id} className="flex flex-col gap-1">
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => toggleModule(module.id)}
                  aria-expanded={isModuleExpanded}
                  className={cn(
                    'flex items-center justify-between rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors duration-200 outline-none',
                    'focus-visible:ring-2 focus-visible:ring-ring',
                    isModuleExpanded
                      ? 'text-brand bg-brand/10'
                      : 'text-muted-foreground hover:bg-secondary',
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="mr-1 text-[10px] font-bold text-brand">
                      {module.short}
                    </span>
                    {module.label}
                  </span>
                  <ChevronRight
                    className={cn(
                      'size-3.5 shrink-0 transition-transform duration-200',
                      isModuleExpanded && 'rotate-90',
                    )}
                    aria-hidden="true"
                  />
                </button>
              )}

              {!collapsed && isModuleExpanded && (
                <div className="flex flex-col gap-1">
                  {module.menus.map((menu) => {
                    const Icon = menu.icon
                    const isOpen = openMenuId === menu.id
                    const menuHasActive = active.menuId === menu.id

                    return (
                      <div key={menu.id} className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => toggleMenu(menu.id)}
                          aria-expanded={isOpen}
                          title={collapsed ? menu.label : undefined}
                          className={cn(
                            'group flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors duration-200 outline-none',
                            'focus-visible:ring-2 focus-visible:ring-ring',
                            collapsed && 'justify-center px-0',
                            menuHasActive
                              ? 'text-foreground'
                              : 'text-muted-foreground hover:bg-secondary hover:text-secondary-foreground',
                          )}
                        >
                          <Icon className="size-5 shrink-0" aria-hidden="true" />
                          {!collapsed && (
                            <>
                              <span className="flex-1 truncate text-left">
                                {menu.label}
                              </span>
                              <ChevronRight
                                className={cn(
                                  'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
                                  isOpen && 'rotate-90',
                                )}
                                aria-hidden="true"
                              />
                            </>
                          )}
                        </button>

                        {!collapsed && isOpen && (
                          <ul className="mt-1 mb-1 flex flex-col gap-0.5 border-l border-border pl-3 ml-5">
                            {menu.submenus.map((submenu) => {
                              const isActive =
                                active.menuId === menu.id &&
                                active.submenuId === submenu.id
                              return (
                                <li key={submenu.id}>
                                  <button
                                    type="button"
                                    aria-current={isActive ? 'page' : undefined}
                                    onClick={() =>
                                      onSelect({
                                        moduleId: module.id,
                                        menuId: menu.id,
                                        submenuId: submenu.id,
                                      })
                                    }
                                    className={cn(
                                      'flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition-colors duration-200 outline-none',
                                      'focus-visible:ring-2 focus-visible:ring-ring',
                                      isActive
                                        ? 'g2g-brand-gradient font-semibold text-brand-foreground shadow-sm'
                                        : 'font-medium text-muted-foreground hover:bg-secondary hover:text-secondary-foreground',
                                    )}
                                  >
                                    <span className="truncate">{submenu.label}</span>
                                  </button>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
