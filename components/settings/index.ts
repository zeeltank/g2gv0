export { ModuleCard, type Module } from './module-card'
export { ModuleConfiguration, type ModuleConfigurationHandle } from './module-configuration'
export { ModuleConfigurationPage } from './module-configuration-page'

/*
 * `SetupProgressTracker` and `SetupWizardLayout` are gone.
 *
 * The tracker hid setup progress behind a `<User />` icon in a popover, and the
 * layout was a full-screen shell whose only exit was a dead `href="#"` help
 * link. Both are replaced by components/shared/wizard, which is used by the
 * setup wizard and the create-organisation screen alike.
 *
 * `ModuleConfigurationPage` was missing from this barrel while its two siblings
 * were listed - the kind of gap that makes a barrel file worth less than the
 * direct import somebody writes instead.
 */
