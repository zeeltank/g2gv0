/**
 * LMS services — the barrel.
 *
 * Re-exports only. This file used to also define `lmsService`, an unverified
 * scaffold calling /courses, /assignments and /certifications — three endpoints
 * that do not exist on this Laravel backend and never did. It had one importer,
 * services/index.ts, which re-exported it to nobody. Every call it offered would
 * have 404'd, and its Course / Assignment / Certification types shadowed the
 * real CatalogCourse and LearningAssignment shapes in autocomplete.
 *
 * Verified services only from here: dashboard, catalog, ai-course, learning,
 * sessions, course-builder, governance, assignment, quiz, reports.
 */

export * from './dashboard'
export * from './catalog'
export * from './ai-course'
export * from './learning'
export * from './sessions'
export * from './course-builder'
export * from './governance'
export * from './quiz'
export * from './reports'
export * from './assignment'
