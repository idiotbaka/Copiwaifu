import type { MaybeRefOrGetter, Ref } from 'vue'
import type { UnlistenFn } from '@tauri-apps/api/event'
import { cursorPosition, getCurrentWindow } from '@tauri-apps/api/window'
import { Config, LogLevel } from 'easy-live2d'
import { onMounted, onUnmounted, ref, toValue, watch } from 'vue'
import { createLive2DRuntime } from '../live2d/runtime'
import { createMotionController } from '../live2d/motion-controller'
import type { MotionGroupOption, TAgentState, WindowSizePreset } from '../types/agent'

export interface UseMainWindowLive2dOptions {
  canvasRef: Ref<HTMLCanvasElement | undefined>
  modelUrl: MaybeRefOrGetter<string>
  windowSize: MaybeRefOrGetter<WindowSizePreset>
  currentState: Ref<TAgentState>
  getActionGroupBindings: () => Record<TAgentState, string | null>
  getFallbackMotionGroups: () => readonly MotionGroupOption[]
  onModelReady?: () => void
}

export function useMainWindowLive2d(options: UseMainWindowLive2dOptions) {
  const currentWindow = getCurrentWindow()
  const runtimeReady = ref(false)

  let runtime: ReturnType<typeof createLive2DRuntime> | null = null
  let canvasResizeObserver: ResizeObserver | null = null
  let unlistenWindowResized: UnlistenFn | null = null
  let unlistenWindowScaleChanged: UnlistenFn | null = null
  let unlistenWindowMoved: UnlistenFn | null = null
  let globalMouseRafId: number | null = null
  let lastDomPointerMoveTime = 0
  let cachedWindowX = 0
  let cachedWindowY = 0

  const motionController = createMotionController({
    getSprite: () => runtime?.getSprite() ?? null,
    getCurrentState: () => options.currentState.value,
    getActionGroupBindings: options.getActionGroupBindings,
    getFallbackMotionGroups: options.getFallbackMotionGroups,
  })

  Config.MotionGroupIdle = 'Idle'
  Config.ViewScale = 1.46
  Config.CubismLoggingLevel = LogLevel.LogLevel_Off
  Config.MouseFollow = true

  async function syncSize() {
    await runtime?.syncSize()
  }

  async function mountModel(modelUrl: string) {
    if (!runtimeReady.value || !runtime || !modelUrl) {
      return
    }

    motionController.invalidate()
    await runtime.mountModel({
      modelEntryUrl: modelUrl,
      onReady: () => {
        options.onModelReady?.()
      },
    })
  }

  async function playState(state: TAgentState, force = false) {
    await motionController.playState(state, force)
  }

  async function refreshCurrentState(force = true) {
    motionController.syncIdleMotionGroupConfig()
    await motionController.playCurrentState(force)
  }

  // Drive model eye-follow by updating drag state with canvas-pixel coordinates.
  // Accesses easy-live2d internals at runtime (fields are private in TS types).
  function driveModelMouseFollow(rawCanvasX: number, rawCanvasY: number) {
    const sprite = runtime?.getSprite()
    if (!sprite)
      return

    // Clamp coordinates to the canvas viewport so that a far-away cursor on
    // another monitor does not produce exaggerated Live2D view coordinates.
    const canvas = options.canvasRef.value
    const canvasX = canvas ? Math.max(0, Math.min(canvas.width, rawCanvasX)) : rawCanvasX
    const canvasY = canvas ? Math.max(0, Math.min(canvas.height, rawCanvasY)) : rawCanvasY

    const internalSprite = sprite as unknown as {
      _model: { setDragging: (x: number, y: number) => void } | null
      _ctx: {
        viewTransform: {
          transformViewX: (x: number) => number
          transformViewY: (y: number) => number
        }
      } | null
    }

    const model = internalSprite._model
    const ctx = internalSprite._ctx
    if (!model || !ctx)
      return

    const viewX = ctx.viewTransform.transformViewX(canvasX)
    const viewY = ctx.viewTransform.transformViewY(canvasY)
    model.setDragging(viewX, viewY)
  }

  // Within-window: intercept pointermove on the document to update eye tracking
  // regardless of whether the user is holding a mouse button (_captured flag bypass).
  function handleDocumentPointerMove(ev: PointerEvent) {
    const canvas = options.canvasRef.value
    if (!canvas)
      return

    const rect = canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0)
      return

    const canvasX = (ev.clientX - rect.left) * (canvas.width / rect.width)
    const canvasY = (ev.clientY - rect.top) * (canvas.height / rect.height)
    lastDomPointerMoveTime = performance.now()
    driveModelMouseFollow(canvasX, canvasY)
  }

  // Outside-window: poll global cursor position each animation frame and convert
  // to canvas coordinates using the cached window outer position.
  async function pollGlobalCursor() {
    const DOM_ACTIVE_THRESHOLD_MS = 80

    if (performance.now() - lastDomPointerMoveTime > DOM_ACTIVE_THRESHOLD_MS) {
      try {
        const pos = await cursorPosition()
        const canvas = options.canvasRef.value
        if (canvas) {
          // outerPosition is in physical pixels; cursorPosition is also physical pixels.
          // Canvas coordinates (passed to ViewTransform) are physical pixels too.
          const canvasX = pos.x - cachedWindowX
          const canvasY = pos.y - cachedWindowY
          driveModelMouseFollow(canvasX, canvasY)
        }
      }
      catch {
        // Ignore transient IPC failures silently
      }
    }

    globalMouseRafId = requestAnimationFrame(() => { void pollGlobalCursor() })
  }

  onMounted(async () => {
    const canvas = options.canvasRef.value
    if (!canvas) {
      return
    }

    runtime = createLive2DRuntime({
      canvas,
      resizeTo: canvas.parentElement ?? window,
      resolution: Math.max(window.devicePixelRatio || 1, 1),
    })

    motionController.syncIdleMotionGroupConfig()
    await runtime.init()
    runtimeReady.value = true
    await syncSize()

    canvasResizeObserver = new ResizeObserver(() => {
      void syncSize()
    })
    canvasResizeObserver.observe(canvas)

    unlistenWindowResized = await currentWindow.onResized(() => {
      void syncSize()
    })
    unlistenWindowScaleChanged = await currentWindow.onScaleChanged(() => {
      void syncSize()
    })

    // Cache initial window position for global cursor coordinate conversion.
    try {
      const pos = await currentWindow.outerPosition()
      cachedWindowX = pos.x
      cachedWindowY = pos.y
    }
    catch { /* ignore */ }

    // Keep cached position up-to-date when window is moved.
    unlistenWindowMoved = await currentWindow.onMoved((pos) => {
      cachedWindowX = pos.payload.x
      cachedWindowY = pos.payload.y
    })

    // Register within-window mouse tracking (bypasses _captured requirement).
    document.addEventListener('pointermove', handleDocumentPointerMove, { passive: true })

    // Start global cursor polling for outside-window tracking.
    void pollGlobalCursor()
  })

  onUnmounted(() => {
    runtimeReady.value = false
    motionController.invalidate()

    document.removeEventListener('pointermove', handleDocumentPointerMove)

    if (globalMouseRafId !== null) {
      cancelAnimationFrame(globalMouseRafId)
      globalMouseRafId = null
    }

    if (unlistenWindowMoved) {
      void unlistenWindowMoved()
      unlistenWindowMoved = null
    }

    if (unlistenWindowResized) {
      void unlistenWindowResized()
      unlistenWindowResized = null
    }

    if (unlistenWindowScaleChanged) {
      void unlistenWindowScaleChanged()
      unlistenWindowScaleChanged = null
    }

    if (canvasResizeObserver) {
      canvasResizeObserver.disconnect()
      canvasResizeObserver = null
    }

    runtime?.dispose()
    runtime = null
  })

  watch(
    () => [runtimeReady.value, toValue(options.modelUrl)] as const,
    ([ready, modelUrl]) => {
      if (!ready || !modelUrl) {
        return
      }

      void mountModel(modelUrl)
    },
    { immediate: true },
  )

  watch(
    () => toValue(options.windowSize),
    () => {
      void syncSize()
    },
  )

  return {
    playState,
    refreshCurrentState,
    syncIdleMotionGroupConfig: motionController.syncIdleMotionGroupConfig,
  }
}
