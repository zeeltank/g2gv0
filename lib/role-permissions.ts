/**
 * Role & Permissions tree model.
 *
 * Turns the Modules -> Menus -> Submenus payload of ajax_groupwiserights_g2g
 * (tblmenumaster_g2g levels 1, 2 and 3) into an editable tree, and back into
 * the flat rows tblgroupwise_rights_g2g stores.
 *
 * The cascade rules encoded here mirror what the sidebar endpoint does when it
 * later reads these rows: a node whose parent has no can_view is dropped from
 * the menu entirely, so granting a right on a child has to grant view on its
 * ancestors, and revoking view on a parent has to clear the branch below it.
 * Without that, the screen would happily save rights that produce an empty
 * sidebar.
 */

import type {
  MenuRightFlags,
  MenuRightPayload,
  MenuRightsMenuNode,
  MenuRightsModuleNode,
  MenuRightsSubmenuNode,
} from '@/services/navigation/menu-rights'

export type ActionKey = 'view' | 'add' | 'edit' | 'delete' | 'dashboard' | 'mobile'

export const ACTION_KEYS: ActionKey[] = ['view', 'add', 'edit', 'delete', 'dashboard', 'mobile']

/** Actions that make no sense without view, and so are cleared when view goes. */
const VIEW_DEPENDENT: ActionKey[] = ['add', 'edit', 'delete']

export type PermissionActions = Record<ActionKey, boolean>

export interface PermissionNode {
  /** tblmenumaster_g2g.id, as a string for React keys. */
  id: string
  label: string
  /** 1 = module, 2 = menu, 3 = submenu. */
  level: 1 | 2 | 3
  /** MDI class from tblmenumaster_g2g.icon; many rows have none. */
  icon: string | null
  accessLink: string | null
  actions: PermissionActions
  children: PermissionNode[]
}

function toActions(flags: MenuRightFlags): PermissionActions {
  return {
    view: flags.can_view === 1,
    add: flags.can_add === 1,
    edit: flags.can_edit === 1,
    delete: flags.can_delete === 1,
    dashboard: flags.dashboard_right === 1,
    mobile: flags.is_mobile === 1,
  }
}

function toNode(node: MenuRightsSubmenuNode, level: 1 | 2 | 3, children: PermissionNode[]): PermissionNode {
  return {
    id: String(node.id),
    label: node.label,
    level,
    icon: node.icon || null,
    accessLink: node.access_link,
    actions: toActions(node),
    children,
  }
}

export function toPermissionTree(modules: MenuRightsModuleNode[]): PermissionNode[] {
  return modules.map((module) =>
    toNode(
      module,
      1,
      (module.menus ?? []).map((menu: MenuRightsMenuNode) =>
        toNode(
          menu,
          2,
          (menu.submenus ?? []).map((submenu) => toNode(submenu, 3, [])),
        ),
      ),
    ),
  )
}

export function flattenTree(nodes: PermissionNode[]): PermissionNode[] {
  return nodes.flatMap((node) => [node, ...flattenTree(node.children)])
}

/** Every node of the tree as a tblgroupwise_rights_g2g row; the API drops the all-zero ones. */
export function toRightsPayload(nodes: PermissionNode[]): MenuRightPayload[] {
  return flattenTree(nodes).map((node) => ({
    menu_id: Number(node.id),
    can_view: node.actions.view ? 1 : 0,
    can_add: node.actions.add ? 1 : 0,
    can_edit: node.actions.edit ? 1 : 0,
    can_delete: node.actions.delete ? 1 : 0,
    dashboard_right: node.actions.dashboard ? 1 : 0,
    is_mobile: node.actions.mobile ? 1 : 0,
  }))
}

function cloneTree(nodes: PermissionNode[]): PermissionNode[] {
  return nodes.map((node) => ({
    ...node,
    actions: { ...node.actions },
    children: cloneTree(node.children),
  }))
}

/** The chain from a module down to `nodeId`, root first. Empty if not found. */
function findPath(nodes: PermissionNode[], nodeId: string): PermissionNode[] {
  for (const node of nodes) {
    if (node.id === nodeId) return [node]
    const childPath = findPath(node.children, nodeId)
    if (childPath.length) return [node, ...childPath]
  }
  return []
}

function setBranch(node: PermissionNode, action: ActionKey, value: boolean) {
  node.actions[action] = value
  if (!value && action === 'view') {
    VIEW_DEPENDENT.forEach((dependent) => {
      node.actions[dependent] = false
    })
  }
  node.children.forEach((child) => setBranch(child, action, value))
}

function clearBranch(node: PermissionNode) {
  node.children.forEach((child) => {
    ACTION_KEYS.forEach((action) => {
      child.actions[action] = false
    })
    clearBranch(child)
  })
}

/**
 * Applies one action to one node, then repairs the branch: ancestors gain view
 * so the node stays reachable, and losing view clears everything underneath.
 */
export function applyAction(nodes: PermissionNode[], nodeId: string, action: ActionKey, value: boolean): PermissionNode[] {
  const next = cloneTree(nodes)
  const path = findPath(next, nodeId)
  if (!path.length) return next

  const target = path[path.length - 1]
  target.actions[action] = value

  if (value) {
    // Anything granted implies view, on this node and on every ancestor.
    target.actions.view = true
    path.slice(0, -1).forEach((ancestor) => {
      ancestor.actions.view = true
    })
  } else if (action === 'view') {
    VIEW_DEPENDENT.forEach((dependent) => {
      target.actions[dependent] = false
    })
    clearBranch(target)
  }

  return next
}

/** "Select all" / "Deselect all" for a single row, cascading down its subtree. */
export function applyNodeAll(nodes: PermissionNode[], nodeId: string, value: boolean): PermissionNode[] {
  const next = cloneTree(nodes)
  const path = findPath(next, nodeId)
  if (!path.length) return next

  const target = path[path.length - 1]
  ACTION_KEYS.forEach((action) => {
    target.actions[action] = value
  })

  if (value) {
    path.slice(0, -1).forEach((ancestor) => {
      ancestor.actions.view = true
    })
  } else {
    clearBranch(target)
  }

  return next
}

/** Column header checkbox: one action across an entire module subtree. */
export function applyModuleColumn(nodes: PermissionNode[], moduleId: string, action: ActionKey, value: boolean): PermissionNode[] {
  const next = cloneTree(nodes)
  const moduleNode = next.find((node) => node.id === moduleId)
  if (!moduleNode) return next

  setBranch(moduleNode, action, value)
  if (value && action !== 'view') {
    setBranch(moduleNode, 'view', true)
  }

  return next
}

export function isNodeFullySelected(node: PermissionNode): boolean {
  return ACTION_KEYS.every((action) => node.actions[action])
}

/** Header checkbox state for a column: every row in the module has the action. */
export function isColumnChecked(module: PermissionNode, action: ActionKey): boolean {
  return flattenTree([module]).every((node) => node.actions[action])
}

/** Screens under a module - the level 2 and level 3 rows, not the module itself. */
export function countScreens(module: PermissionNode): number {
  return flattenTree(module.children).length
}

export function countGrantedScreens(module: PermissionNode): number {
  return flattenTree(module.children).filter((node) => node.actions.view).length
}
