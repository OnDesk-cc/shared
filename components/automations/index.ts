/**
 * Las automatizaciones entre apps en la interfaz (2026-10-21): lo que montan las
 * apps en Ajustes (`AutomationsPanel`) y la consola de ondesk
 * (`AutomationsConsole`). Spec: ondesk/docs/specs/2026-10-21-automatizaciones.md § 8.
 */
export { AutomationsConsole, AutomationsPanel } from "./automations-panel";
export { AutomationsError, automationsApi, automationsKeys } from "./automations-api";
export type { AutomationProduct, ListedFlow } from "./automations-model";
