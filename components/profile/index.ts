export { ProfileDashboard } from './profile-dashboard'
export { SkillsPanel } from './skills-panel'
// The profile TYPES. `mockProfile` used to be re-exported here beside them -
// an "Alex Morgan" fixture that nothing rendered, sitting in the public surface
// of a module whose screen runs entirely on the signed-in person's real record.
export type { Profile, ProfileProps, TabId } from '@/types/profile'
export * from './cards'
