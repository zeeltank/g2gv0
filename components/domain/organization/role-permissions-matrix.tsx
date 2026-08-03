'use client'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { IconGlyph } from '@/components/shell/icon-glyph'
import { Settings2 } from 'lucide-react'
import {
  ACTION_KEYS,
  countGrantedScreens,
  countScreens,
  isColumnChecked,
  isNodeFullySelected,
  type ActionKey,
  type PermissionNode,
} from '@/lib/role-permissions'

const ACTION_LABELS: Record<ActionKey, string> = {
  view: 'View',
  add: 'Add',
  edit: 'Edit',
  delete: 'Delete',
  dashboard: 'Dashboard',
  mobile: 'Mobile',
}

type Props = {
  /** Level 1 menus; their children are the level 2 menus and level 3 submenus. */
  modules: PermissionNode[]
  animateKey: number
  onToggleAction: (nodeId: string, action: ActionKey, value: boolean) => void
  onToggleNodeAll: (nodeId: string, value: boolean) => void
  onToggleModuleColumn: (moduleId: string, action: ActionKey, value: boolean) => void
}

type Row = { node: PermissionNode; depth: number }

/** Module first, then each menu followed by its own submenus - reading order. */
function toRows(node: PermissionNode, depth = 0): Row[] {
  return [{ node, depth }, ...node.children.flatMap((child) => toRows(child, depth + 1))]
}

function RowLabel({ node, depth }: Row) {
  return (
    <div
      className={cn('flex items-center gap-2', depth === 0 && 'font-semibold', depth === 1 && 'font-medium')}
      style={{ paddingLeft: `${depth * 20}px` }}
    >
      {depth > 0 && (
        <span aria-hidden className="text-muted-foreground/40 select-none">
          {depth === 1 ? '├' : '└'}
        </span>
      )}
      <span className={cn(depth === 2 ? 'text-muted-foreground' : 'text-foreground')}>{node.label}</span>
      {depth === 0 && (
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
          Module
        </span>
      )}
    </div>
  )
}

export function RolePermissionsMatrix({
  modules,
  animateKey,
  onToggleAction,
  onToggleNodeAll,
  onToggleModuleColumn,
}: Props) {
  if (modules.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto bg-surface p-6">
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No menus are configured for this organization.
        </div>
      </div>
    )
  }

  return (
    <div
      key={animateKey}
      className="flex-1 overflow-y-auto bg-surface p-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
    >
      <Accordion type="multiple" defaultValue={modules.map((module) => module.id)} className="space-y-4">
        {modules.map((module) => {
          const rows = toRows(module)

          return (
            <AccordionItem
              key={module.id}
              value={module.id}
              className="overflow-hidden rounded-xl border bg-card px-0 shadow-sm transition-all duration-300 data-[state=open]:border-primary/20 hover:shadow-md"
            >
              <AccordionTrigger className="cursor-pointer bg-muted/10 px-6 py-4 transition-colors duration-300 hover:no-underline hover:bg-muted/30 group">
                <div className="flex items-center gap-3 text-left">
                  <div className="shrink-0 rounded-md bg-primary/10 p-2 transition-colors duration-300 group-hover:bg-primary/20">
                    {module.icon ? (
                      <IconGlyph icon={module.icon} className="text-lg leading-none text-primary" />
                    ) : (
                      <Settings2 className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">{module.label}</h3>
                    <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                      {countGrantedScreens(module)} of {countScreens(module)} screens granted
                    </p>
                  </div>
                </div>
              </AccordionTrigger>

              <AccordionContent className="px-0 pb-0 pt-0">
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-y bg-muted/10 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-6 py-3 font-semibold">Menu / Screen</th>
                        {ACTION_KEYS.map((action) => (
                          <th
                            key={action}
                            className={cn(
                              'px-4 py-3 text-center font-semibold',
                              action === 'dashboard' ? 'w-28 border-l' : 'w-24',
                            )}
                          >
                            <div className="flex flex-col items-center gap-2">
                              <span>{ACTION_LABELS[action]}</span>
                              <Checkbox
                                className="cursor-pointer"
                                aria-label={`${ACTION_LABELS[action]} for every screen in ${module.label}`}
                                checked={isColumnChecked(module, action)}
                                onCheckedChange={(checked) => onToggleModuleColumn(module.id, action, !!checked)}
                              />
                            </div>
                          </th>
                        ))}
                        <th className="w-32 border-l px-6 py-3 text-right font-semibold">Quick Select</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {rows.map(({ node, depth }) => {
                        const isAllSelected = isNodeFullySelected(node)

                        return (
                          <tr
                            key={node.id}
                            className={cn(
                              'transition-colors hover:bg-muted/30',
                              depth === 0 && 'bg-muted/20',
                              depth === 1 && 'bg-muted/5',
                            )}
                          >
                            <td className="px-6 py-3 text-foreground">
                              <RowLabel node={node} depth={depth} />
                            </td>
                            {ACTION_KEYS.map((action) => (
                              <td
                                key={action}
                                className={cn(
                                  'px-4 py-3 text-center',
                                  action === 'dashboard' && 'border-l',
                                  (action === 'dashboard' || action === 'mobile') && 'bg-muted/5',
                                )}
                              >
                                <Checkbox
                                  checked={node.actions[action]}
                                  aria-label={`${ACTION_LABELS[action]} on ${node.label}`}
                                  onCheckedChange={(checked) => onToggleAction(node.id, action, !!checked)}
                                  className="inline-block cursor-pointer transition-transform hover:scale-110 active:scale-95"
                                />
                              </td>
                            ))}
                            <td className="border-l px-6 py-3 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onToggleNodeAll(node.id, !isAllSelected)}
                                className="h-7 cursor-pointer text-xs transition-all duration-200 hover:bg-primary/10 hover:text-primary active:scale-95"
                              >
                                {isAllSelected ? 'Deselect All' : 'Select All'}
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </div>
  )
}
