'use client'

import { useEffect, useLayoutEffect, useCallback, useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { ChevronRight, ChevronDown, X } from 'lucide-react'
import { HOME_NAV, type ActiveNav } from '@/hooks/use-navigation'
import { findNodePath, type NavModule, type NavNode } from '@/lib/gtg-navigation'
import { IconButton } from '@/components/ui/icon-button'
import { GtgBrandMark } from '@/components/shell/gtg-brand-mark'
import { IconGlyph } from '@/components/shell/icon-glyph'

interface GtgSidebarProps {
  active: ActiveNav
  onSelect: (next: ActiveNav) => void
  modules: NavModule[]
  mobileOpen?: boolean
  onMobileClose?: () => void
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
}

/** All ancestor ids (down to and including the active leaf) within `module`, for pre-expanding the branch that contains the active item. */
function activePathIds(module: NavModule, active: ActiveNav): Set<string> {
  const targetId = active.submenuId || active.menuId
  if (!targetId) return new Set()
  const path = findNodePath(module.children, targetId)
  return new Set((path ?? []).map((node) => node.id))
}

function containsId(node: NavNode, id: string): boolean {
  if (node.id === id) return true
  return node.children.some((child) => containsId(child, id))
}

/** A module has no meaningful expand/collapse when it resolves to exactly one leaf — clicking it should navigate straight there. */
function isDirectLeafModule(module: NavModule): boolean {
  return module.children.length === 1 && module.children[0].children.length === 0
}

interface SidebarMenuBranchProps {
  node: NavNode
  depth: number
  moduleId: string
  parentId: string | null
  active: ActiveNav
  expandedIds: Set<string>
  onToggle: (id: string) => void
  onLeafSelect: (next: ActiveNav) => void
}

/**
 * Renders one menu node and, if expanded, recurses into its children — to
 * whatever depth the tblmenumaster_g2g hierarchy actually has. Used by the
 * desktop rail, the mobile drawer, and the collapsed-rail flyout, so a menu
 * with grandchildren (e.g. Task Management's Administration) renders and
 * expands correctly everywhere without any per-level code.
 */
function SidebarMenuBranch({
  node,
  depth,
  moduleId,
  parentId,
  active,
  expandedIds,
  onToggle,
  onLeafSelect,
}: SidebarMenuBranchProps) {
  const hasChildren = node.children.length > 0
  const isOpen = expandedIds.has(node.id)
  const activeLeafId = active.submenuId || active.menuId
  const isActiveLeaf = !hasChildren && active.moduleId === moduleId && node.id === activeLeafId
  const hasActiveDescendant =
    hasChildren && active.moduleId === moduleId && node.children.some((child) => containsId(child, activeLeafId))
  const isTopLevel = depth === 0

  const handleClick = () => {
    if (hasChildren) {
      onToggle(node.id)
    } else {
      onLeafSelect({ moduleId, menuId: parentId ?? node.id, submenuId: node.id })
    }
  }

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={handleClick}
        aria-current={isActiveLeaf ? 'page' : undefined}
        aria-expanded={hasChildren ? isOpen : undefined}
        className={cn(
          'flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isTopLevel ? 'min-h-9 text-sm' : 'min-h-8 text-xs',
          isActiveLeaf || hasActiveDescendant
            ? isTopLevel ? 'bg-primary/10 text-primary font-semibold' : 'bg-primary/15 text-primary font-semibold'
            : isTopLevel
              ? 'text-sidebar-foreground hover:bg-sidebar-hover'
              : 'text-muted-foreground hover:bg-sidebar-hover hover:text-sidebar-foreground',
        )}
      >
        {isTopLevel && (
          <IconGlyph
            icon={node.icon}
            className={cn(
              'size-4 shrink-0 text-[14px]',
              isActiveLeaf || hasActiveDescendant ? 'text-primary' : 'text-muted-foreground',
            )}
          />
        )}
        <span className="min-w-0 flex-1 truncate">{node.label}</span>
        {hasChildren && (
          <ChevronRight
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
              isOpen && 'rotate-90',
            )}
            aria-hidden="true"
          />
        )}
      </button>

      {hasChildren && isOpen && (
        <div className="ml-4 flex flex-col gap-0.5 border-l border-sidebar-border pl-3">
          {node.children.map((child) => (
            <SidebarMenuBranch
              key={child.id}
              node={child}
              depth={depth + 1}
              moduleId={moduleId}
              parentId={node.id}
              active={active}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onLeafSelect={onLeafSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function GtgSidebar({
  active,
  onSelect,
  modules,
  mobileOpen = false,
  onMobileClose,
  collapsed = true,
  onCollapsedChange,
}: GtgSidebarProps) {
  const [flyoutModuleId, setFlyoutModuleId] = useState<string | null>(null)
  const [flyoutExpandedIds, setFlyoutExpandedIds] = useState<Set<string>>(new Set())
  const [flyoutPosition, setFlyoutPosition] = useState<{ top: number; height: number } | null>(null)
  const [flyoutStyle, setFlyoutStyle] = useState<{ top: number; left: number; maxHeight: number; fromLeft: boolean } | null>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const flyoutRef = useRef<HTMLDivElement>(null)
  const [desktopExpandedModuleId, setDesktopExpandedModuleId] = useState<string | null>(active.moduleId)
  const [desktopExpandedIds, setDesktopExpandedIds] = useState<Set<string>>(() => {
    const activeModule = modules.find((m) => m.id === active.moduleId)
    return activeModule ? activePathIds(activeModule, active) : new Set()
  })
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null)
  const [expandedMobileIds, setExpandedMobileIds] = useState<Set<string>>(new Set())
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const filteredNav = modules

  const clearFlyout = useCallback(() => {
    setFlyoutModuleId(null)
    setFlyoutExpandedIds(new Set())
    setFlyoutPosition(null)
  }, [])

  const expandDesktopSidebar = useCallback((module: NavModule) => {
    clearFlyout()
    setDesktopExpandedModuleId(module.id)
    setDesktopExpandedIds(module.id === active.moduleId ? activePathIds(module, active) : new Set())
    onCollapsedChange?.(false)
  }, [active, clearFlyout, onCollapsedChange])

  const handleModuleClick = useCallback((module: NavModule) => {
    if (module.standalone) {
      clearFlyout()
      onSelect(HOME_NAV)
      return
    }
    if (!collapsed) {
      const nextModuleId = desktopExpandedModuleId === module.id ? null : module.id
      setDesktopExpandedModuleId(nextModuleId)
      setDesktopExpandedIds(nextModuleId === active.moduleId ? activePathIds(module, active) : new Set())
      return
    }
    expandDesktopSidebar(module)
  }, [active, clearFlyout, collapsed, desktopExpandedModuleId, expandDesktopSidebar, onSelect])

  const handleModuleActivate = useCallback((module: NavModule) => {
    if (module.standalone) {
      clearFlyout()
      onSelect(HOME_NAV)
      return
    }
    expandDesktopSidebar(module)
  }, [clearFlyout, expandDesktopSidebar, onSelect])

  const handleModuleMouseEnter = useCallback((module: NavModule, element: HTMLElement) => {
    if (!collapsed || module.standalone) return
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
    const rect = element.getBoundingClientRect()
    setFlyoutPosition({ top: rect.top, height: rect.height })
    setFlyoutModuleId(module.id)
    setFlyoutExpandedIds(new Set())
  }, [collapsed])

  const closeFlyout = useCallback(() => {
    if (!collapsed) return
    hideTimeoutRef.current = setTimeout(() => {
      clearFlyout()
    }, 150)
  }, [clearFlyout, collapsed])

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

  useEffect(() => {
    if (collapsed) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (sidebarRef.current?.contains(target)) return

      clearFlyout()
      onCollapsedChange?.(true)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [clearFlyout, collapsed, onCollapsedChange])

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

  const handleDesktopLeafSelect = useCallback((next: ActiveNav) => {
    clearFlyout()
    setDesktopExpandedModuleId(next.moduleId)
    const nextModule = modules.find((m) => m.id === next.moduleId)
    setDesktopExpandedIds(nextModule ? activePathIds(nextModule, next) : new Set())
    onSelect(next)
    onCollapsedChange?.(true)
  }, [clearFlyout, modules, onSelect, onCollapsedChange])

  const handleFlyoutLeafSelect = useCallback((next: ActiveNav) => {
    setFlyoutModuleId(null)
    setFlyoutExpandedIds(new Set())
    setFlyoutPosition(null)
    onSelect(next)
  }, [onSelect])

  const toggleDesktopNode = useCallback((nodeId: string) => {
    setDesktopExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }, [])

  const toggleMobileNode = useCallback((nodeId: string) => {
    setExpandedMobileIds((current) => {
      const next = new Set(current)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }, [])

  const toggleFlyoutNode = useCallback((nodeId: string) => {
    setFlyoutExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }, [])

  const toggleMobileModule = useCallback((moduleId: string) => {
    setExpandedModuleId((current) => (current === moduleId ? null : moduleId))
    setExpandedMobileIds(new Set())
  }, [])

  const handleMobileModuleClick = useCallback((module: NavModule) => {
    if (module.standalone) {
      handleMobileLeafSelect({ moduleId: module.id, menuId: HOME_NAV.menuId, submenuId: HOME_NAV.submenuId })
      return
    }
    if (isDirectLeafModule(module)) {
      const leaf = module.children[0]
      handleMobileLeafSelect({ moduleId: module.id, menuId: leaf.id, submenuId: leaf.id })
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
        ref={sidebarRef}
        aria-label="Primary Navigation"
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 sidebar-transition md:flex',
          collapsed ? 'w-[72px]' : 'w-[260px]',
        )}
      >
        <div
          className={cn(
            'flex h-12 shrink-0 items-center border-sidebar-border px-4',
            collapsed && 'justify-center px-0',
          )}
        >
          <GtgBrandMark collapsed={collapsed} />
        </div>

        <nav className={cn("g2g-page-scroll g2g-scrollbar flex-1", collapsed ? "px-2 pt-2 pb-4" : "px-3 py-3")}>
          <div className={cn("flex flex-col", collapsed ? "items-center gap-1.5" : "gap-1")}>
            {filteredNav.map((module) => {
              const isActive = active.moduleId === module.id
              const isDesktopModuleOpen = !collapsed && desktopExpandedModuleId === module.id

              return (
                <div
                  key={module.id}
                  className="relative"
                >
                  <button
                    type="button"
                    onMouseEnter={(e) => handleModuleMouseEnter(module, e.currentTarget)}
                    onClick={() => handleModuleClick(module)}
                    onDoubleClick={() => handleModuleActivate(module)}
                    onMouseLeave={closeFlyout}
                    aria-current={isActive ? 'page' : undefined}
                    aria-label={collapsed ? `${module.label}. Click to open ${module.label}.` : undefined}
                    aria-expanded={!collapsed && !module.standalone ? isDesktopModuleOpen : undefined}
                    className={cn(
                      'flex items-center cursor-pointer rounded-md text-sm font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      collapsed
                        ? cn(
                            'size-10 justify-center',
                            isActive
                              ? 'text-sidebar-active-foreground bg-sidebar-active rounded-xl shadow-sidebar-active'
                              : 'text-sidebar-foreground hover:bg-sidebar-hover',
                          )
                        : cn(
                            'h-10 w-full gap-3 px-2',
                            isActive
                              ? 'text-sidebar-active-foreground bg-sidebar-active rounded-md shadow-sidebar-active'
                              : 'text-sidebar-foreground hover:bg-sidebar-hover',
                          ),
                    )}
                  >
                    <span className={cn(
                      "flex items-center justify-center rounded-md transition-all duration-200",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground",
                      collapsed ? "size-7" : "size-7",
                    )}>
                      <IconGlyph icon={module.icon} className={cn("shrink-0 transition-transform duration-200 text-[18px]", collapsed ? "size-5" : "size-5")} />
                    </span>
                    {!collapsed && (
                      <span className="flex-1 truncate text-left">{module.label}</span>
                    )}
                    {!collapsed && !module.standalone && (
                      <ChevronDown
                        className={cn(
                          'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
                          isDesktopModuleOpen && 'rotate-180',
                        )}
                        aria-hidden="true"
                      />
                    )}
                  </button>

                  {isDesktopModuleOpen && module.children.length > 0 && (
                    <div className="ml-5 mt-1 flex flex-col gap-1 border-l border-sidebar-border pl-3">
                      {module.children.map((menu) => (
                        <SidebarMenuBranch
                          key={menu.id}
                          node={menu}
                          depth={0}
                          moduleId={module.id}
                          parentId={null}
                          active={active}
                          expandedIds={desktopExpandedIds}
                          onToggle={toggleDesktopNode}
                          onLeafSelect={handleDesktopLeafSelect}
                        />
                      ))}
                    </div>
                  )}
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
         <div className="flex h-14 shrink-0 items-center justify-between border-b border-sidebar-border px-4">
          <GtgBrandMark />
          <IconButton
            type="button"
            onClick={onMobileClose}
            aria-label="Close navigation"
            variant="ghost"
            size="lg"
            className="text-sidebar-foreground hover:bg-sidebar-hover"
          >
            <X className="size-5" aria-hidden="true" />
          </IconButton>
        </div>

        <nav className="g2g-page-scroll g2g-scrollbar flex-1 overflow-y-auto px-3 py-4">
          <div className="flex flex-col gap-1">
            {filteredNav.map((module) => {
              const isModuleActive = active.moduleId === module.id
              const isModuleExpanded = expandedModuleId === module.id
              const showModuleExpand = !module.standalone && !isDirectLeafModule(module) && module.children.length > 0

              return (
                <div key={module.id} className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => handleMobileModuleClick(module)}
                    aria-expanded={showModuleExpand ? isModuleExpanded : undefined}
                    className={cn(
                      'flex h-11 w-full items-center gap-3 rounded-md px-2 text-sm font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isModuleActive
                        ? 'text-sidebar-active-foreground bg-sidebar-active'
                        : 'text-sidebar-foreground hover:bg-sidebar-hover',
                    )}
                  >
                    <span className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-md transition-all duration-200",
                      isModuleActive
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}>
                      <IconGlyph icon={module.icon} className="size-4 shrink-0 text-[14px]" />
                    </span>
                    <span className="flex-1 truncate text-left">{module.label}</span>
                    {showModuleExpand ? (
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
                      {module.children.map((menu) => (
                        <SidebarMenuBranch
                          key={menu.id}
                          node={menu}
                          depth={0}
                          moduleId={module.id}
                          parentId={null}
                          active={active}
                          expandedIds={expandedMobileIds}
                          onToggle={toggleMobileNode}
                          onLeafSelect={handleMobileLeafSelect}
                        />
                      ))}
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
            const foundModule = filteredNav.find((m) => m.id === flyoutModuleId)
            if (!foundModule) return null

            return (
              <>
                <div className="shrink-0 border-b border-border px-4 py-2.5 bg-surface-muted">
                  <h2 className="text-sm font-semibold text-foreground">{foundModule.label}</h2>
                </div>
                <div className="flex-1 flex flex-col gap-0.5 px-2 py-2 overflow-y-auto g2g-scrollbar">
                  {foundModule.children.map((menu) => (
                    <SidebarMenuBranch
                      key={menu.id}
                      node={menu}
                      depth={0}
                      moduleId={foundModule.id}
                      parentId={null}
                      active={active}
                      expandedIds={flyoutExpandedIds}
                      onToggle={toggleFlyoutNode}
                      onLeafSelect={handleFlyoutLeafSelect}
                    />
                  ))}
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
