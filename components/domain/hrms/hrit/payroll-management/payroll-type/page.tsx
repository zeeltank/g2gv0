'use client'

import { useMemo, useState } from 'react'
import { ArrowDownCircle, ArrowUpCircle, CheckCircle2, Lock, Plus, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog'
import { KPICard, Tabs } from '@/shared/business'
import { useAuth } from '@/hooks/use-auth'
import { usePayrollTypes } from '@/hooks/use-payroll'
import type { PayrollTypeRow } from '@/services/hrms'
import PayrollTypeDialog from './components/PayrollTypeDialog'
import PayrollTypeTable from './components/PayrollTypeTable'

type PayrollTab = 'all' | 'earnings' | 'deductions'

/**
 * Payroll Type master.
 *
 * Every tab, KPI card and row action is driven by the same three Laravel
 * endpoints - GET /payroll-type, POST /payroll-type/store and
 * POST /payroll-type/destroy/{id} (App\Http\Controllers\Payroll\PayrollController).
 * The list returns active and inactive rows for the tenant, so the tabs and the
 * counters are slices of one response rather than separate requests.
 */
export default function PayrollTypePage() {
  const { user, isLoading: authLoading } = useAuth()
  const {
    loading,
    processing,
    error,
    actionMessage,
    payrollTypes,
    summary,
    retry,
    clearMessages,
    save,
    toggleStatus,
    remove,
  } = usePayrollTypes()

  const [activeTab, setActiveTab] = useState<PayrollTab>('all')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editing, setEditing] = useState<PayrollTypeRow | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PayrollTypeRow | null>(null)

  const tabs = useMemo(
    () => [
      { id: 'all', label: `All (${summary.total})` },
      { id: 'earnings', label: `Earnings (${summary.earnings})` },
      { id: 'deductions', label: `Deductions (${summary.deductions})` },
    ],
    [summary],
  )

  const visibleRows = useMemo(() => {
    if (activeTab === 'earnings') return payrollTypes.filter((row) => row.kind === 'Earning')
    if (activeTab === 'deductions') return payrollTypes.filter((row) => row.kind === 'Deduction')
    return payrollTypes
  }, [activeTab, payrollTypes])

  const openCreate = () => {
    setEditing(null)
    setIsDialogOpen(true)
  }

  const openEdit = (row: PayrollTypeRow) => {
    setEditing(row)
    setIsDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!pendingDelete) return
    const result = await remove(pendingDelete.id)
    if (result.ok) {
      setPendingDelete(null)
    }
  }

  const payrollTypeDialog = (
    <PayrollTypeDialog
      open={isDialogOpen}
      onOpenChange={setIsDialogOpen}
      editing={editing}
      processing={processing}
      onSave={save}
    />
  )

  // Mirrors the Laravel side, where the payroll routes sit behind the HR/Admin menu.
  if (!authLoading && (!user || !['admin', 'hr'].includes(user.role))) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center sm:min-h-[480px] sm:px-8 sm:py-16">
        <div
          className="mb-5 flex size-14 items-center justify-center rounded-lg bg-danger/10 text-danger sm:mb-6 sm:size-16"
          aria-hidden="true"
        >
          <Lock className="size-7 sm:size-8" />
        </div>
        <h2 className="text-xl font-semibold text-foreground sm:text-2xl">Access Restricted</h2>
        <p className="mt-2 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground sm:mt-3 sm:text-base">
          Payroll Type configuration is accessible to HR Manager and Administrator roles only.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-full flex-col gap-4 sm:gap-5 md:gap-6">
      <div className="flex flex-col gap-3 px-4 sm:px-0 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl md:text-3xl">
            Payroll Type
          </h1>
          <p className="mt-1 text-sm text-muted-foreground sm:mt-2 sm:text-base">
            Manage the earning and deduction components used to build salary structures and monthly
            payroll.
          </p>
        </div>
        <Button className="h-9 w-full gap-2 rounded-lg font-semibold md:w-auto" onClick={openCreate}>
          <Plus className="size-4" />
          Add Payroll Type
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 px-4 sm:grid-cols-2 sm:px-0 lg:grid-cols-4">
        <KPICard
          label="Total Types"
          value={loading ? '-' : summary.total}
          description="Components configured for this organization"
          icon={<Wallet className="size-5" />}
        />
        <KPICard
          label="Active Types"
          value={loading ? '-' : summary.active}
          variant="success"
          description={loading ? undefined : `${summary.inactive} inactive`}
          icon={<CheckCircle2 className="size-5" />}
        />
        <KPICard
          label="Earnings"
          value={loading ? '-' : summary.earnings}
          variant="primary"
          description="Added to gross salary"
          icon={<ArrowUpCircle className="size-5" />}
        />
        <KPICard
          label="Deductions"
          value={loading ? '-' : summary.deductions}
          variant="warning"
          description="Subtracted from gross salary"
          icon={<ArrowDownCircle className="size-5" />}
        />
      </div>

      <div className="px-4 sm:px-0">
        <Tabs tabs={tabs} active={activeTab} onChange={(id) => setActiveTab(id as PayrollTab)} />
      </div>

      <div className="px-4 pb-4 sm:px-0 sm:pb-0">
        {authLoading || loading ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          </div>
        ) : error && payrollTypes.length === 0 ? (
          <ErrorState title="Unable to load payroll types" description={error} retry={retry} />
        ) : payrollTypes.length === 0 ? (
          <Card>
            <CardContent>
              <EmptyState
                icon={<Wallet className="size-10" />}
                title="No payroll types configured"
                description="Add your first earning or deduction component to start building salary structures."
                action={
                  <Button onClick={openCreate}>
                    <Plus className="mr-2 size-4" />
                    Add Payroll Type
                  </Button>
                }
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg md:text-xl">
                {activeTab === 'earnings'
                  ? 'Earning Components'
                  : activeTab === 'deductions'
                    ? 'Deduction Components'
                    : 'All Payroll Types'}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {visibleRows.length} {visibleRows.length === 1 ? 'component' : 'components'} in this
                view
              </CardDescription>
            </CardHeader>

            {(actionMessage || error) && (
              <CardContent className="pt-0">
                <Alert variant={error ? 'destructive' : undefined}>
                  <AlertDescription className="flex items-center justify-between gap-4">
                    <span>{error ?? actionMessage}</span>
                    <Button variant="ghost" size="sm" onClick={clearMessages}>
                      Dismiss
                    </Button>
                  </AlertDescription>
                </Alert>
              </CardContent>
            )}

            <CardContent>
              <PayrollTypeTable
                rows={visibleRows}
                processing={processing}
                onEdit={openEdit}
                onToggleStatus={toggleStatus}
                onDelete={setPendingDelete}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {payrollTypeDialog}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
      >
        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payroll Type</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `"${pendingDelete.name || 'This payroll type'}" will be removed from the payroll component list. Salary structures already built with it keep their saved values.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setPendingDelete(null)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="w-full sm:w-auto"
              onClick={handleDelete}
              disabled={processing}
            >
              {processing ? 'Deleting...' : 'Delete'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
