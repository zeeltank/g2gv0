/**
 * The Automations and Runs tabs of Workflows (/platform-services/workflow). Each fetches its own organisation-wide data and draws its own loading, error
 * (with a retry) and empty states, so the page shell mounts them with no props.
 */
export { AutomationsTab } from './automations-tab'
export { RunsTab } from './runs-tab'
