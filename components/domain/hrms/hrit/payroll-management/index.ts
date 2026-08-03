'use client'

// Payroll Management submodule
export * from './payroll-type'
export { default as SalaryStructurePage } from './salary-structure/page'
export { default as PayrollDeductionPage } from './payroll-deduction/page'
export { default as MonthlyPayrollPage } from './monthly-payroll/page'
export { default as SalaryCertificatePage } from './salary-certificate/page'
export { default as Form16Page } from './form-16/page'
export {
  PayrollPageShell,
  PayrollMessages,
  PayrollTableSkeleton,
  downloadCsv,
} from './shared/payroll-shell'
