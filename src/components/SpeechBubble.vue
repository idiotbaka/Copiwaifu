<script setup lang="ts">
import { computed } from 'vue'
import type { BubbleThemeSettings, WindowSizePreset } from '../types/agent'

const props = defineProps<{
  text: string
  visible: boolean
  windowSize: WindowSizePreset
  characterName?: string
  bubbleTheme?: BubbleThemeSettings
}>()

const bubbleClassName = computed(() => `speech-bubble--${props.windowSize}`)
const showNametag = computed(() => !!props.characterName && props.windowSize !== 'tiny')

const PRESET_COLORS: Record<string, { accent: string; text: string }> = {
  pink:   { accent: '#d45fa0', text: '#3d2847' },
  blue:   { accent: '#3a8fbf', text: '#1a2e4a' },
  teal:   { accent: '#2a9985', text: '#1a3a35' },
  purple: { accent: '#8040c0', text: '#2a1a4a' },
  peach:  { accent: '#e06030', text: '#3a2015' },
}

const themeStyle = computed(() => {
  const theme = props.bubbleTheme
  if (!theme) return {}
  const colors = theme.preset === 'custom'
    ? { accent: theme.customAccent || '#d45fa0', text: '#2a1a35' }
    : (PRESET_COLORS[theme.preset] ?? PRESET_COLORS.pink)
  return {
    '--bubble-accent': colors.accent,
    '--bubble-text-color': colors.text,
  } as Record<string, string>
})
</script>

<template>
  <Transition name="bubble">
    <div
      v-if="visible"
      class="speech-bubble"
      :class="[bubbleClassName, { 'speech-bubble--has-nametag': showNametag }]"
      :style="themeStyle"
    >
      <div
        v-if="showNametag"
        class="speech-bubble__nametag"
      >
        {{ characterName }}
      </div>
      <span
        class="speech-bubble__pointer"
        aria-hidden="true"
      />
      <div class="speech-bubble__body">
        <span class="speech-bubble__text">{{ text }}</span>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.speech-bubble {
  --bubble-width: min(220px, calc(100vw - 16px));
  --bubble-max-height: calc(100% - var(--bubble-pointer-size) - var(--bubble-outer-gap));
  --bubble-min-height: 50px;
  --bubble-padding: 10px 16px;
  --bubble-radius: 16px;
  --bubble-border-width: 1.5px;
  --bubble-font-size: 13.5px;
  --bubble-pointer-size: 10px;
  --bubble-outer-gap: 8px;
  --bubble-offset-y: 40px;
  --bubble-accent: #d45fa0;
  --bubble-text-color: #3d2847;
  --nametag-left: 15px;
  --nametag-font-size: 11px;
  --nametag-padding: 3px 10px;
  --nametag-radius: 8px 8px 0 0;
  position: absolute;
  left: 50%;
  bottom: calc(var(--bubble-pointer-size) - var(--bubble-offset-y));
  width: var(--bubble-width);
  max-height: var(--bubble-max-height);
  min-height: var(--bubble-min-height);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: visible;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--bubble-accent) 6%, white) 0%,
    color-mix(in srgb, var(--bubble-accent) 11%, white) 28%,
    color-mix(in srgb, var(--bubble-accent) 14%, white) 58%,
    color-mix(in srgb, var(--bubble-accent) 9%, white) 84%,
    color-mix(in srgb, var(--bubble-accent) 5%, white) 100%
  );
  background-size: 300% 300%;
  border: var(--bubble-border-width) solid color-mix(in srgb, var(--bubble-accent) 50%, transparent);
  border-radius: var(--bubble-radius);
  backdrop-filter: blur(18px) saturate(1.2);
  box-shadow:
    0 4px 22px color-mix(in srgb, var(--bubble-accent) 18%, transparent),
    0 1px 5px rgba(0, 0, 0, 0.07),
    inset 0 1px 0 rgba(255, 255, 255, 0.82);
  pointer-events: auto;
  z-index: 10;
  transform-origin: bottom center;
  transform: translateX(-50%);
  animation: bubble-aurora 8s ease-in-out infinite;
}

.speech-bubble--small {
  --bubble-width: min(224px, calc(100vw - 16px));
  --bubble-min-height: 42px;
  --bubble-padding: 9px 13px;
  --bubble-radius: 13px;
  --bubble-border-width: 1.5px;
  --bubble-font-size: 12px;
  --bubble-pointer-size: 8px;
  --bubble-offset-y: 30px;
  --nametag-left: 13px;
  --nametag-font-size: 10px;
  --nametag-padding: 2px 8px;
  --nametag-radius: 6px 6px 0 0;
}

.speech-bubble--tiny {
  --bubble-width: min(176px, calc(100vw - 12px));
  --bubble-min-height: 32px;
  --bubble-padding: 7px 10px;
  --bubble-radius: 10px;
  --bubble-border-width: 1.5px;
  --bubble-font-size: 10px;
  --bubble-pointer-size: 6px;
  --bubble-offset-y: 20px;
}

.speech-bubble--medium {
  --bubble-width: min(280px, calc(100vw - 16px));
  --bubble-min-height: 50px;
  --bubble-padding: 11px 18px;
  --bubble-radius: 18px;
  --bubble-border-width: 1.5px;
  --bubble-font-size: 14px;
  --bubble-pointer-size: 10px;
  --bubble-offset-y: 40px;
  --nametag-left: 17px;
  --nametag-font-size: 11.5px;
  --nametag-padding: 3px 10px;
  --nametag-radius: 9px 9px 0 0;
}

.speech-bubble--large {
  --bubble-width: min(336px, calc(100vw - 20px));
  --bubble-min-height: 60px;
  --bubble-padding: 13px 20px;
  --bubble-radius: 20px;
  --bubble-border-width: 2px;
  --bubble-font-size: 15px;
  --bubble-pointer-size: 12px;
  --bubble-offset-y: 50px;
  --nametag-left: 18px;
  --nametag-font-size: 12px;
  --nametag-padding: 3px 11px;
  --nametag-radius: 9px 9px 0 0;
}

.speech-bubble--huge {
  --bubble-width: min(400px, calc(100vw - 24px));
  --bubble-min-height: 68px;
  --bubble-padding: 15px 24px;
  --bubble-radius: 22px;
  --bubble-border-width: 2px;
  --bubble-font-size: 16px;
  --bubble-pointer-size: 14px;
  --bubble-offset-y: 60px;
  --nametag-left: 20px;
  --nametag-font-size: 12.5px;
  --nametag-padding: 4px 12px;
  --nametag-radius: 10px 10px 0 0;
}

/* 底部三角尖角 */
.speech-bubble__pointer {
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 0;
  height: 0;
  pointer-events: none;
  z-index: 2;
}

.speech-bubble__pointer::before {
  content: '';
  position: absolute;
  bottom: calc(var(--bubble-pointer-size) * -1 - 2.5px);
  left: 0;
  width: 0;
  height: 0;
  border-left: calc(var(--bubble-pointer-size) + 2.5px) solid transparent;
  border-right: calc(var(--bubble-pointer-size) + 2.5px) solid transparent;
  border-top: calc(var(--bubble-pointer-size) + 2.5px) solid color-mix(in srgb, var(--bubble-accent) 55%, black);
}

.speech-bubble__pointer::after {
  content: '';
  position: absolute;
  bottom: calc(var(--bubble-pointer-size) * -1);
  left: 0;
  width: 0;
  height: 0;
  border-left: var(--bubble-pointer-size) solid transparent;
  border-right: var(--bubble-pointer-size) solid transparent;
  border-top: var(--bubble-pointer-size) solid color-mix(in srgb, var(--bubble-accent) 8%, white);
}

.speech-bubble::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(
    118deg,
    transparent 0%,
    transparent 28%,
    rgba(255, 255, 255, 0.18) 44%,
    rgba(255, 255, 255, 0.26) 50%,
    rgba(255, 255, 255, 0.18) 56%,
    transparent 72%,
    transparent 100%
  );
  background-size: 200% 100%;
  animation: bubble-shimmer 4s linear infinite;
  pointer-events: none;
  z-index: 0;
}

/* Character nametag */
.speech-bubble__nametag {
  position: absolute;
  top: 0;
  left: var(--nametag-left, 15px);
  transform: translateY(calc(-100% + var(--bubble-border-width)));
  padding: var(--nametag-padding, 3px 10px);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--bubble-accent) 55%, white) 0%,
    var(--bubble-accent) 100%
  );
  border-radius: var(--nametag-radius, 8px 8px 0 0);
  color: #fff;
  font-size: var(--nametag-font-size, 11px);
  font-weight: 700;
  letter-spacing: 0.4px;
  line-height: 1.4;
  white-space: nowrap;
  pointer-events: none;
  text-shadow: 0 1px 2px color-mix(in srgb, var(--bubble-accent) 60%, black);
  box-shadow:
    0 -2px 8px color-mix(in srgb, var(--bubble-accent) 14%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.28);
  z-index: -1;
}

.speech-bubble__body {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: var(--bubble-padding);
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--bubble-accent) 35%, transparent) transparent;
}

.speech-bubble__text {
  display: block;
  font-family: inherit;
  font-size: var(--bubble-font-size);
  line-height: 1.65;
  color: var(--bubble-text-color);
  font-weight: 500;
  word-break: break-word;
  white-space: pre-wrap;
  text-align: left;
}

/* 弹入动画 */
.bubble-enter-active {
  animation:
    bubble-pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
    bubble-aurora 8s ease-in-out infinite;
}

/* 弹出动画 */
.bubble-leave-active {
  animation:
    bubble-pop-out 0.3s cubic-bezier(0.55, 0, 1, 0.45) forwards,
    bubble-aurora 8s ease-in-out infinite;
}

@keyframes bubble-pop-in {
  0% {
    opacity: 0;
    transform: translateX(-50%) scale(0) translateY(10px);
  }
  50% {
    transform: translateX(-50%) scale(1.08) translateY(-2px);
  }
  100% {
    opacity: 1;
    transform: translateX(-50%) scale(1) translateY(0);
  }
}

@keyframes bubble-pop-out {
  0% {
    opacity: 1;
    transform: translateX(-50%) scale(1);
  }
  50% {
    transform: translateX(-50%) scale(1.05);
  }
  100% {
    opacity: 0;
    transform: translateX(-50%) scale(0) translateY(10px);
  }
}

@keyframes bubble-aurora {
  0%, 100% { background-position: 0% 50%; }
  33%       { background-position: 100% 20%; }
  66%       { background-position: 50% 100%; }
}

@keyframes bubble-shimmer {
  0%          { background-position: -80% 0; }
  35%         { background-position: 180% 0; }
  35.1%, 100% { background-position: -80% 0; }
}
</style>
