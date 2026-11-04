/**
 * Building blocks for the redesigned CRM screens (agentic CRM slice 1, Docs/agentic-crm/slices/S01-product-master.md).
 *
 * Each one composes what components/ui already has and changes none of it. A list screen is ListPage + useListQuery + ListSearch; a record page is
 * DetailPage + PageTabs/TabPanel + useUrlTab; creating or editing is RecordDrawer + FormLayout + FormSection + Field; asking before something that
 * cannot be undone is useConfirm. The rules that can be tested without a browser live in list-query.ts, url-tab.ts and form-errors.ts.
 */
export { DetailPage, type DetailStatus } from './detail-page'
export { Field, NativeSelect, type FieldControlProps } from './form-field'
export { splitFieldErrors, type SplitErrors } from './form-errors'
export { FormErrorSummary, FormLayout, FormSection } from './form-layout'
export {
  cleanPage, listQueryString, patchListQuery, readListQuery, writeListQuery,
  type FilterSpec, type ListQuery, type ListQueryConfig, type ListQueryPatch, type SortDirection,
} from './list-query'
export { ListPage, type ListStatus } from './list-page'
export { ListSearch } from './list-search'
export { PageTabs, TabPanel, tabButtonId, tabPanelId, type PageTab } from './page-tabs'
export { RecordDrawer } from './record-drawer'
export { useConfirm, type ConfirmOptions } from './use-confirm'
export { useListQuery } from './use-list-query'
export { useUrlTab } from './use-url-tab'
export { readTab, writeTab } from './url-tab'
