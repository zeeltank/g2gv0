'use client'

import { FileSpreadsheet, FileText, Printer, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ComplianceLibraryToolbarProps {
  visibleCount: number
  totalCount: number
  onPrint: () => void
  onExcelExport: () => void
  onPdfExport: () => void
}

export function ComplianceLibraryToolbar({
  visibleCount,
  totalCount,
  onPrint,
  onExcelExport,
  onPdfExport,
}: ComplianceLibraryToolbarProps) {
  return (
    <Card className="overflow-hidden border-primary/10 bg-gradient-to-br from-primary/8 via-card to-card">
      <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <ShieldCheck className="size-6" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-2xl font-semibold">Compliance Library</CardTitle>
            <CardDescription className="mt-2 max-w-3xl text-sm leading-6">
              Create, assign, track, and maintain recurring compliance obligations with evidence ownership and export-ready records.
            </CardDescription>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={onPrint}>
            <Printer className="size-4" />
            Print
          </Button>
          <Button variant="outline" className="gap-2" onClick={onExcelExport}>
            <FileSpreadsheet className="size-4" />
            Excel Export
          </Button>
          <Button variant="outline" className="gap-2" onClick={onPdfExport}>
            <FileText className="size-4" />
            PDF Export
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {visibleCount} visible of {totalCount} total
        </div>
        <Badge variant="navy">Live library</Badge>
      </CardContent>
    </Card>
  )
}
