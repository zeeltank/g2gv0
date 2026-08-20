/**
 * MOVED — the implementation now lives in components/shared/business/widget-shell.tsx.
 *
 * This kit (WidgetShell, WidgetLoading, WidgetMessage, KpiCard, DonutChart) is
 * the only one in the codebase that already models loading, empty and error as
 * first-class states rather than leaving them to each caller. The Home
 * dashboard needs exactly that, and importing it from `domain/lms` would make
 * one feature module depend on another — a layering inversion that the next
 * three dashboards would copy.
 *
 * This file stays as a re-export so the five LMS importers keep working
 * unchanged. New code should import from '@/components/shared/business'.
 */
export * from '@/components/shared/business/widget-shell'
