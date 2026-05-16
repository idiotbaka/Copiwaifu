import type { AppLanguage, CustomPetMessageKey, CustomPetMessagesConfig } from './types/agent'

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function applyVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '')
}

/**
 * Returns:
 *   null      → key not configured, caller should use the i18n default
 *   []        → key explicitly set to empty, caller should show nothing
 *   string[]  → use these messages (random pick)
 */
function getCustomMessages(
  config: CustomPetMessagesConfig | null | undefined,
  language: AppLanguage,
  key: CustomPetMessageKey,
): string[] | null {
  if (!config) return null
  const langConfig = config[language]
  if (!langConfig || !(key in langConfig)) return null
  return langConfig[key] ?? []
}

export interface PetMessageDefaults {
  greetings: (name: string, commanderTitle: string) => string[]
  thinking: (agentLabel: string, name: string) => string
  toolUse: (agentLabel: string, name: string, toolName: string | null) => string
  error: (agentLabel: string, name: string) => string
  complete: (agentLabel: string, name: string) => string
  needsAttention: (agentLabel: string, name: string, commanderTitle: string) => string
  idleResume: (agentLabel: string, name: string) => string
}

export function buildPetMessages(
  customMessages: CustomPetMessagesConfig | null | undefined,
  language: AppLanguage,
  defaults: PetMessageDefaults,
): PetMessageDefaults {
  return {
    greetings: (name, commanderTitle) => {
      const msgs = getCustomMessages(customMessages, language, 'greetings')
      if (msgs === null) return defaults.greetings(name, commanderTitle)
      if (msgs.length === 0) return []
      return msgs.map(m => applyVars(m, { name, commanderTitle }))
    },
    thinking: (agentLabel, name) => {
      const msgs = getCustomMessages(customMessages, language, 'thinking')
      if (msgs === null) return defaults.thinking(agentLabel, name)
      if (msgs.length === 0) return ''
      return applyVars(pickRandom(msgs), { agentLabel, name })
    },
    toolUse: (agentLabel, name, toolName) => {
      const msgs = getCustomMessages(customMessages, language, 'toolUse')
      if (msgs === null) return defaults.toolUse(agentLabel, name, toolName)
      if (msgs.length === 0) return ''
      return applyVars(pickRandom(msgs), { agentLabel, name, toolName: toolName ?? '' })
    },
    error: (agentLabel, name) => {
      const msgs = getCustomMessages(customMessages, language, 'error')
      if (msgs === null) return defaults.error(agentLabel, name)
      if (msgs.length === 0) return ''
      return applyVars(pickRandom(msgs), { agentLabel, name })
    },
    complete: (agentLabel, name) => {
      const msgs = getCustomMessages(customMessages, language, 'complete')
      if (msgs === null) return defaults.complete(agentLabel, name)
      if (msgs.length === 0) return ''
      return applyVars(pickRandom(msgs), { agentLabel, name })
    },
    needsAttention: (agentLabel, name, commanderTitle) => {
      const msgs = getCustomMessages(customMessages, language, 'needsAttention')
      if (msgs === null) return defaults.needsAttention(agentLabel, name, commanderTitle)
      if (msgs.length === 0) return ''
      return applyVars(pickRandom(msgs), { agentLabel, name, commanderTitle })
    },
    idleResume: (agentLabel, name) => {
      const msgs = getCustomMessages(customMessages, language, 'idleResume')
      if (msgs === null) return defaults.idleResume(agentLabel, name)
      if (msgs.length === 0) return ''
      return applyVars(pickRandom(msgs), { agentLabel, name })
    },
  }
}
