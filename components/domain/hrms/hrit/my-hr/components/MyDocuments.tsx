'use client'

import * as React from 'react'
import { Download, FileBadge, Info } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select } from '@/components/ui/select'
import { saveBlob } from '@/components/domain/hrms/hrit/payroll-management/shared/payroll-shell'
import { myHrService } from '@/services/hrms/my-hr'
import type { LaravelContext } from '@/lib/laravel-context'

/**
 * The two documents an employee actually has to ask somebody for. F-209.
 *
 * Both existed only behind routes/hrms.php's `hrit.role:admin,hr` group, so
 * getting either meant asking HR to operate a screen on your behalf. Worse,
 * both of those screens were broken:
 *
 *   SALARY CERTIFICATE - hrms_salary_certificate held ZERO rows across the
 *   entire platform. The builder dereferenced a salary structure that usually
 *   did not exist and fatalled (F-110), and once that was fixed, a certificate
 *   covering a full year still could not be stored: twelve month ids joined is
 *   26 characters and the column was varchar(20) (F-212).
 *
 *   FORM 16 - every call threw "Base table or view not found: fees_map_years",
 *   a table that exists on neither host and that no migration creates (F-210).
 *   HR got the same 500.
 *
 * So this is not a convenience wrapper over something that worked. It is the
 * first time either document has been obtainable at all.
 *
 * The year list is `salary_structure_years` from the summary, which is the set
 * of years a certificate can actually be issued for. Offering a year that will
 * refuse is the pattern this module has spent two phases removing.
 */
export function MyDocuments({
  context,
  years,
}: {
  context: LaravelContext
  /** Years this employee has a salary structure for. Empty is meaningful. */
  years: number[]
}) {
  const [year, setYear] = React.useState<string>(() => (years[0] ? String(years[0]) : ''))
  const [busy, setBusy] = React.useState<'certificate' | 'form16' | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [note, setNote] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!year && years[0]) setYear(String(years[0]))
  }, [years, year])

  const certificate = async () => {
    setBusy('certificate')
    setError(null)
    setNote(null)
    try {
      saveBlob(
        `salary-certificate-${year}.pdf`,
        await myHrService.downloadSalaryCertificate(Number(year)),
      )
      setNote(`Your ${year} salary certificate has been downloaded.`)
    } catch (caught) {
      // The server's own sentence names the missing thing and who adds it.
      setError(
        caught instanceof Error ? caught.message : 'Your salary certificate could not be issued.',
      )
    } finally {
      setBusy(null)
    }
  }

  const form16 = async () => {
    setBusy('form16')
    setError(null)
    setNote(null)
    try {
      const response = await myHrService.getForm16(context, Number(year))
      const data = response.data
      if (!data?.from_date) {
        setError(response.message || `No Form 16 figures are on record for ${year}.`)
        return
      }
      setNote(
        `Your Form 16 figures for ${data.from_date} to ${data.to_date} are ready on the Form 16 screen.`,
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your Form 16 could not be loaded.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-bold">My documents</CardTitle>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Issue your own salary certificate, or check the figures behind your Form 16.
        </p>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/*
          Say WHY rather than offering a button that will refuse. A certificate
          is built from the salary structure - without one there is nothing to
          state, and for two years that combination produced a stack trace.
        */}
        {years.length === 0 ? (
          <Alert>
            <AlertDescription className="flex items-start gap-2">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                A salary certificate and Form 16 can only be issued for a year you have a salary
                structure on record for, and you have none yet. Ask HR to add one under Salary
                Structure.
              </span>
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {error && (
              <Alert variant="destructive">
                <AlertDescription className="flex items-center justify-between gap-4">
                  <span>{error}</span>
                  <Button variant="ghost" size="sm" onClick={() => setError(null)}>
                    Dismiss
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {note && (
              <Alert>
                <AlertDescription className="flex items-center justify-between gap-4">
                  <span>{note}</span>
                  <Button variant="ghost" size="sm" onClick={() => setNote(null)}>
                    Dismiss
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[180px]">
                <label
                  htmlFor="my-documents-year"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Year
                </label>
                <Select
                  id="my-documents-year"
                  value={year}
                  onChange={setYear}
                  options={years.map((value) => ({ value: String(value), label: String(value) }))}
                  size="sm"
                  disabled={busy !== null}
                  aria-label="Year for your documents"
                />
              </div>

              <Button size="sm" onClick={certificate} disabled={!year || busy !== null}>
                <FileBadge className="mr-2 size-4" />
                {busy === 'certificate' ? 'Preparing…' : 'Salary certificate (PDF)'}
              </Button>

              <Button size="sm" variant="outline" onClick={form16} disabled={!year || busy !== null}>
                <Download className="mr-2 size-4" />
                {busy === 'form16' ? 'Checking…' : 'Check my Form 16'}
              </Button>
            </div>

            {/*
              Said plainly, because the name carries a legal expectation this
              screen cannot meet. A statutory Form 16 is issued by the deductor
              against filed TDS returns; nothing here files anything.
            */}
            <p className="text-xs leading-relaxed text-muted-foreground">
              The salary certificate states your pay for the year from your salary structure. Form
              16 here shows the same pay and deduction figures your HR team sees &mdash; it is not
              the statutory Form 16, which your employer issues against filed TDS returns.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
