import { createElement, type ReactElement } from 'react'

/**
 * createElement for test code, without React's overloads: they cannot see children passed as extra arguments to a component whose `children` prop is
 * required, and reject every such call at type-check time even though it is valid at run time. Components under test are still real components.
 */
export const h = createElement as unknown as (type: unknown, props?: unknown, ...children: unknown[]) => ReactElement
