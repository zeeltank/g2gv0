'use client'

import React, { useState } from 'react'
import {
  Search,
  Plus,
  Filter,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  GitMerge,
  FileText,
  Users,
  Plug,
  ShieldCheck,
  Settings,
  X,
  ChevronDown,
  ArrowRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/ui/status-badge'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

import {
  mockAdminKPIs,
  mockWorkflows,
  type Workflow
} from './admin-data'

export function AdminCenter() {
  const [activeTab, setActiveTab] = useState('workflows')
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null)
  
  const activeWorkflow = activeWorkflowId ? mockWorkflows.find(w => w.id === activeWorkflowId) : null

  const getStatusVariant = (status: Workflow['status']) => {
    switch (status) {
      case 'Active': return 'success'
      case 'Draft': return 'warning'
      case 'Inactive': return 'default'
      default: return 'default'
    }
  }

  const renderIcon = (iconStr: string) => {
    const props = { className: "size-5 text-muted-foreground" }
    switch (iconStr) {
      case 'git-merge': return <GitMerge {...props} />
      case 'file-text': return <FileText {...props} />
      case 'users': return <Users {...props} />
      case 'plug': return <Plug {...props} />
      case 'shield-check': return <ShieldCheck {...props} />
      default: return <Settings {...props} />
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-4 p-6 border-b border-border/40 bg-surface">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg text-primary border border-primary/20 shadow-sm">
                <ShieldCheck className="size-5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Administration & Governance</h1>
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl mt-1">
              Configure workflows, templates, permissions, integrations and governance for the Talent Management module.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="gap-2 shadow-sm">
              <FileText className="size-4" /> Audit Logs
            </Button>
            <Button className="gap-2 shadow-sm">
              <Plus className="size-4" /> Create New <ChevronDown className="size-3.5 opacity-70" />
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-2">
          {mockAdminKPIs.map((kpi) => (
            <Card key={kpi.id} className="p-4 flex flex-col justify-between border-border/60 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-muted-foreground">{kpi.title}</span>
                <div className="p-1.5 rounded-md bg-muted/50 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  {renderIcon(kpi.icon)}
                </div>
              </div>
              <div className="flex flex-col gap-2 mt-1">
                <span className="text-3xl font-bold text-foreground">{kpi.value}</span>
                <button className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 w-fit">
                  {kpi.linkText} <ArrowRight className="size-3" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border/60 px-6 bg-surface/50">
        <div className="flex gap-6">
          {[
            { id: 'workflows', label: 'Workflows', icon: GitMerge },
            { id: 'templates', label: 'Templates', icon: FileText },
            { id: 'permissions', label: 'Permissions', icon: Users },
            { id: 'integrations', label: 'Integrations', icon: Plug },
            { id: 'configuration', label: 'Configuration', icon: Settings },
            { id: 'audit', label: 'Audit & Compliance', icon: ShieldCheck },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 py-4 text-sm font-semibold transition-all border-b-2",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              )}
            >
              <tab.icon className={cn("size-4", activeTab === tab.id ? "text-primary" : "text-muted-foreground")} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-muted/10">
        {activeTab === 'workflows' && (
          <div className="flex flex-col gap-6 max-w-[1400px]">
            <Card className="shadow-sm overflow-hidden border-border/60">
              <div className="p-4 border-b border-border flex items-center justify-between bg-surface">
                <div className="flex flex-col">
                  <h2 className="text-base font-bold text-foreground">Workflows</h2>
                  <p className="text-xs text-muted-foreground">Manage and configure all talent management workflows.</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-[150px]">
                    <Select value="all" options={[{label: 'All Modules', value: 'all'}]} size="sm" />
                  </div>
                  <div className="relative w-[250px]">
                    <Search className="absolute left-2.5 top-2 size-4 text-muted-foreground" />
                    <Input placeholder="Search workflows..." className="pl-9 h-8 text-sm" />
                  </div>
                  <Button variant="outline" size="icon" className="h-8 w-8"><Filter className="size-4" /></Button>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="font-semibold text-foreground">Workflow Name</TableHead>
                      <TableHead className="font-semibold text-foreground">Module</TableHead>
                      <TableHead className="font-semibold text-foreground">Status</TableHead>
                      <TableHead className="font-semibold text-foreground">Version</TableHead>
                      <TableHead className="font-semibold text-foreground">Last Updated</TableHead>
                      <TableHead className="font-semibold text-foreground w-[80px] text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockWorkflows.map((workflow) => (
                      <TableRow 
                        key={workflow.id} 
                        className={cn(
                          "cursor-pointer hover:bg-muted/50 transition-colors",
                          activeWorkflowId === workflow.id ? 'bg-primary/5' : ''
                        )}
                        onClick={() => setActiveWorkflowId(workflow.id)}
                      >
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm text-foreground">{workflow.name}</span>
                            <span className="text-xs text-muted-foreground">{workflow.description}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{workflow.module}</span>
                        </TableCell>
                        <TableCell>
                          <StatusBadge 
                            variant={getStatusVariant(workflow.status)} 
                            className={cn(
                              "px-2 py-0.5 text-[10px] border-0 h-5",
                              workflow.status === 'Active' ? 'bg-success/10 text-success' :
                              workflow.status === 'Draft' ? 'bg-warning/10 text-warning-foreground' :
                              'bg-muted text-muted-foreground'
                            )}
                          >
                            {workflow.status}
                          </StatusBadge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">{workflow.version}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm">{workflow.lastUpdated}</span>
                            <span className="text-xs text-muted-foreground">by {workflow.updatedBy}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              <div className="p-3 border-t flex items-center justify-between bg-muted/5">
                <span className="text-xs text-muted-foreground">Showing 1 to 8 of 28 workflows</span>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-7 w-7 text-muted-foreground"><ChevronLeft className="size-4" /></Button>
                    <Button variant="default" size="icon" className="h-7 w-7 text-xs bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30">1</Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-xs text-muted-foreground">2</Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-xs text-muted-foreground">3</Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-xs text-muted-foreground">4</Button>
                    <Button variant="outline" size="icon" className="h-7 w-7 text-muted-foreground"><ChevronRight className="size-4" /></Button>
                  </div>
                  <div className="w-[100px]"><Select value="10" options={[{label: '10 / page', value: '10'}]} size="sm" /></div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Detail Drawer (Sheet) */}
      <Sheet open={!!activeWorkflowId} onOpenChange={(open) => !open && setActiveWorkflowId(null)}>
        <SheetContent side="right" className="w-[95vw] sm:max-w-4xl p-0 flex flex-col gap-0 border-l border-border/80">
          {activeWorkflow && (
            <div className="flex flex-col h-full bg-background overflow-hidden">
              {/* Header */}
              <div className="px-6 py-5 border-b flex items-center justify-between bg-surface relative">
                <div className="flex flex-col gap-1">
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-3">
                    Workflow Details
                  </h2>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setActiveWorkflowId(null)}>
                  <X className="size-5" />
                </Button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 bg-surface">
                
                {/* Workflow Summary Header inside sheet */}
                <div className="flex items-start justify-between mb-8">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-bold text-foreground">{activeWorkflow.name}</h3>
                      <StatusBadge 
                        variant={getStatusVariant(activeWorkflow.status)} 
                        className={cn(
                          "px-2 py-0.5 text-[10px] border-0 h-5",
                          activeWorkflow.status === 'Active' ? 'bg-success/10 text-success' :
                          activeWorkflow.status === 'Draft' ? 'bg-warning/10 text-warning-foreground' :
                          'bg-muted text-muted-foreground'
                        )}
                      >
                        {activeWorkflow.status}
                      </StatusBadge>
                    </div>
                  </div>
                  <Button variant="outline" className="gap-2 text-sm shadow-sm">
                    More Actions <ChevronDown className="size-3.5" />
                  </Button>
                </div>
                
                {/* Info Grid */}
                <div className="grid grid-cols-[100px_1fr] gap-y-4 text-sm mb-10 max-w-xl">
                  <span className="text-muted-foreground">Module</span>
                  <span className="font-semibold text-foreground">{activeWorkflow.module}</span>
                  
                  <span className="text-muted-foreground">Description</span>
                  <span className="text-foreground">{activeWorkflow.description}</span>
                  
                  <span className="text-muted-foreground">Version</span>
                  <span className="text-foreground">{activeWorkflow.version}</span>
                  
                  <span className="text-muted-foreground">Created By</span>
                  <span className="text-foreground">{activeWorkflow.createdBy}</span>
                  
                  <span className="text-muted-foreground">Last Updated</span>
                  <span className="text-foreground">{activeWorkflow.lastUpdated} by {activeWorkflow.updatedBy}</span>
                </div>

                {activeWorkflow.stages.length > 0 && (
                  <>
                    {/* Workflow Stages */}
                    <div className="flex flex-col gap-4 mb-10">
                      <h4 className="text-base font-bold text-foreground">Workflow Stages</h4>
                      <div className="flex items-center">
                        {activeWorkflow.stages.map((stage, i) => (
                          <React.Fragment key={stage.step}>
                            <div className={cn(
                              "flex flex-col items-center justify-center p-3 border rounded-lg min-w-[120px] min-h-[70px] bg-card text-center gap-1 shadow-sm",
                              stage.step === activeWorkflow.stages.length ? 'border-success/30 bg-success/5' : 'border-border/60'
                            )}>
                              <span className={cn(
                                "text-sm font-medium whitespace-pre-line leading-tight",
                                stage.step === activeWorkflow.stages.length ? 'text-success' : 'text-primary'
                              )}>
                                {stage.step}<br/>
                                <span className={cn(
                                  "text-xs mt-1",
                                  stage.step === activeWorkflow.stages.length ? 'text-success font-semibold' : 'text-foreground'
                                )}>{stage.label}</span>
                              </span>
                            </div>
                            
                            {i < activeWorkflow.stages.length - 1 && (
                              <div className="w-8 flex items-center justify-center text-muted-foreground mx-1">
                                <ArrowRight className="size-4" />
                              </div>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>

                    {/* Approvers Table */}
                    <div className="flex flex-col gap-4">
                      <h4 className="text-base font-bold text-foreground">Approvers</h4>
                      
                      <div className="rounded-lg border border-border/60 overflow-hidden">
                        <Table>
                          <TableHeader className="bg-muted/20">
                            <TableRow className="border-b-border/60">
                              <TableHead className="font-semibold text-muted-foreground py-3">Approver</TableHead>
                              <TableHead className="font-semibold text-muted-foreground py-3">Approval Type</TableHead>
                              <TableHead className="font-semibold text-muted-foreground py-3">Escalation</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {activeWorkflow.approvers.map((approver) => (
                              <TableRow key={approver.id} className="border-b-border/40 hover:bg-transparent">
                                <TableCell className="py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="size-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0 border">
                                      {approver.initials}
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-sm font-semibold text-foreground">{approver.role}</span>
                                      <span className="text-xs text-muted-foreground">{approver.title}</span>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="py-4">
                                  <span className="text-sm text-foreground">{approver.approvalType}</span>
                                </TableCell>
                                <TableCell className="py-4">
                                  <span className="text-sm text-foreground">{approver.escalation}</span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </>
                )}
                
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
