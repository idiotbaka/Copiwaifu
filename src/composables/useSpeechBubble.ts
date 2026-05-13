import { ref } from 'vue'
import { APP_LANGUAGE, TYPING_SPEED_PRESET, WINDOW_SIZE_PRESET } from '../types/agent'
import type { AppLanguage, TypingSpeedPreset, WindowSizePreset } from '../types/agent'

const MAX_TEXT_LENGTH = 100
const DEFAULT_DURATION = 3000

const TYPING_SPEED_MS: Record<TypingSpeedPreset, number> = {
  [TYPING_SPEED_PRESET.SLOW]: 120,
  [TYPING_SPEED_PRESET.MEDIUM]: 60,
  [TYPING_SPEED_PRESET.FAST]: 25,
  [TYPING_SPEED_PRESET.FASTEST]: 0,
}
const AI_TALK_LIMITS: Record<WindowSizePreset, { cjk: number, latin: number }> = {
  [WINDOW_SIZE_PRESET.TINY]: { cjk: 24, latin: 45 },
  [WINDOW_SIZE_PRESET.SMALL]: { cjk: 36, latin: 70 },
  [WINDOW_SIZE_PRESET.MEDIUM]: { cjk: 42, latin: 80 },
  [WINDOW_SIZE_PRESET.LARGE]: { cjk: 60, latin: 110 },
  [WINDOW_SIZE_PRESET.HUGE]: { cjk: 80, latin: 140 },
}

export function useSpeechBubble() {
  const isVisible = ref(false)
  const displayedText = ref('')

  let fullText = ''
  let charIndex = 0
  let typingTimer: ReturnType<typeof setInterval> | null = null
  let hideTimer: ReturnType<typeof setTimeout> | null = null

  function clearTimers() {
    if (typingTimer) {
      clearInterval(typingTimer)
      typingTimer = null
    }
    if (hideTimer) {
      clearTimeout(hideTimer)
      hideTimer = null
    }
  }

  function hide() {
    clearTimers()
    isVisible.value = false
    displayedText.value = ''
  }

  function say(text: string, duration = DEFAULT_DURATION, speed: TypingSpeedPreset = TYPING_SPEED_PRESET.MEDIUM) {
    clearTimers()

    fullText = text.length > MAX_TEXT_LENGTH
      ? `${text.slice(0, MAX_TEXT_LENGTH)}…`
      : text

    // If the text starts with a [label] prefix, display it immediately
    // and only apply the typewriter effect to the rest.
    const prefixMatch = fullText.match(/^\[[^\]]+\]\s*/)
    const prefix = prefixMatch ? prefixMatch[0] : ''
    charIndex = prefix.length

    displayedText.value = prefix
    isVisible.value = true

    const intervalMs = TYPING_SPEED_MS[speed]

    if (intervalMs === 0 || charIndex >= fullText.length) {
      displayedText.value = fullText
      hideTimer = setTimeout(hide, duration)
      return
    }

    typingTimer = setInterval(() => {
      if (charIndex < fullText.length) {
        charIndex++
        displayedText.value = fullText.slice(0, charIndex)
      }
      else {
        clearInterval(typingTimer!)
        typingTimer = null
        hideTimer = setTimeout(hide, duration)
      }
    }, intervalMs)
  }

  return { isVisible, displayedText, say, hide }
}

export function limitAiTalkBubbleText(
  text: string,
  windowSize: WindowSizePreset,
  language: AppLanguage,
) {
  const normalized = text
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
    .trim()
  if (!normalized) {
    return ''
  }

  const useCjkLimit = language === APP_LANGUAGE.CHINESE
    || language === APP_LANGUAGE.JAPANESE
    || /[\u3040-\u30ff\u3400-\u9fff]/.test(normalized)
  const limit = useCjkLimit
    ? AI_TALK_LIMITS[windowSize].cjk
    : AI_TALK_LIMITS[windowSize].latin

  const chars = [...normalized]
  if (chars.length <= limit) {
    return normalized
  }

  return `${chars.slice(0, Math.max(0, limit - 1)).join('')}…`
}
