# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Copiwaifu is a Tauri 2 + Vue 3 desktop pet application (macOS primary, Windows supported) that mirrors the live state of AI coding tools using a Live2D animated companion. The bundled Yulia model reacts to sessions from Claude Code, GitHub Copilot, Codex, Gemini CLI, and OpenCode by playing state-appropriate motion animations and showing speech bubbles.

**AI Talk** is an optional feature that activates when a session reaches `complete` or `error`. It calls a user-configured LLM provider (via a Node.js sidecar) to generate a single short in-character speech bubble. AI Talk never reads full conversations, project files, or source code — it works only from session metadata and filtered summaries.

Current version: **1.2.1-idiotbaka** (fork of upstream Copiwaifu).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vue 3 + TypeScript + Vite 6 |
| Desktop shell | Tauri 2 + Rust |
| macOS extras | tauri-nspanel (NSPanel private API), Dock-hidden window |
| Windows extras | tauri-plugin-autostart, system tray |
| Live2D rendering | Pixi.js 8 + easy-live2d |
| AI runtime | Node.js ESM sidecar + Vercel AI SDK + esbuild |
| HTTP server | tiny_http (Rust, port 23333) |
| Persistence | rusqlite (bundled), JSON session files |
| Package manager | pnpm (workspace) |

## Common Commands

```bash
# Frontend dev server only (port 1420)
pnpm dev

# Bundle the AI Talk Node.js runtime sidecar
pnpm sidecar:build

# Type-check, build frontend, and bundle AI runtime
pnpm build

# Full Tauri desktop app in dev mode
# (runs sidecar:build + pnpm dev automatically before Tauri)
pnpm tauri dev

# Shortcut alias for pnpm tauri dev
pnpm run

# Production desktop build
pnpm tauri build

# ESLint
pnpm eslint .
```

## Repository Structure

```
Copiwaifu/
├── src/                        # Vue 3 + TypeScript frontend
│   ├── main.ts                 # App entry, mounts Vue to #app
│   ├── App.vue                 # Root: bootstrap, window routing by Tauri label
│   ├── windows/
│   │   ├── MainWindow.vue      # Desktop pet canvas, bubbles, context menu, AI Talk
│   │   └── SettingsWindow.vue  # All user settings UI
│   ├── components/
│   │   ├── SpeechBubble.vue    # Animated typed bubble with themes
│   │   └── PetContextMenu.vue  # Right-click context menu
│   ├── composables/
│   │   ├── useAgentState.ts    # Tracks navigator state, listens to events
│   │   ├── useMainWindowLive2d.ts  # Pixi.js + Live2D init, model sync
│   │   ├── useSpeechBubble.ts  # say(), typing animation, text limits
│   │   ├── useContextMenu.ts   # Menu positioning with edge clamp
│   │   └── useNavigatorSessions.ts  # Session list (future use)
│   ├── live2d/
│   │   ├── runtime.ts          # Pixi Application, mountModel(), syncSize()
│   │   ├── model.ts            # Model URL loading, motion group scanning
│   │   └── motion-controller.ts  # State → motion group mapping, playState()
│   ├── types/
│   │   └── agent.ts            # All shared TypeScript types (309 lines)
│   ├── i18n.ts                 # English / Chinese / Japanese UI strings
│   └── updater.ts              # Tauri updater integration with retry + dialog
├── src-tauri/
│   ├── src/
│   │   ├── main.rs             # Tauri run() entry
│   │   ├── lib.rs              # Plugin wiring, window setup, navigator init
│   │   ├── shell.rs            # Settings, model import, window/tray management
│   │   ├── ai_talk.rs          # AI Talk command, sidecar invocation, fallback
│   │   ├── platform.rs         # OS-specific utilities
│   │   └── navigator/
│   │       ├── mod.rs          # NavigatorStore, init(), emit_all()
│   │       ├── state.rs        # NavigatorState, SessionSnapshot, process_event()
│   │       ├── events.rs       # Event type definitions, payload structs
│   │       ├── commands.rs     # get_agent_status(), get_navigator_sessions(), uninstall_hooks()
│   │       ├── server.rs       # tiny_http server (port 23333), /event, /status, /model/current/
│   │       ├── reducer.rs      # Event → phase/state, digests, aiTalkContext builder
│   │       ├── session_store.rs  # ~/.copiwaifu/sessions/ read/write
│   │       ├── session_recovery.rs  # Session state restore on startup
│   │       ├── reconcile.rs    # Session reconciliation logic
│   │       ├── presentation.rs # State/phase formatting helpers
│   │       ├── agent.rs        # Session TTL (60s), cleanup loop
│   │       ├── hook_installer.rs  # Per-agent hook installation and backup
│   │       ├── hook_helpers.rs # TOML/JSON file read/write helpers
│   │       └── providers/
│   │           ├── mod.rs      # parse_agent_type(), normalize_event()
│   │           ├── claude.rs   # Claude Code event normalization
│   │           ├── copilot.rs  # GitHub Copilot event normalization
│   │           ├── codex.rs    # Codex event normalization
│   │           ├── gemini.rs   # Gemini CLI event normalization
│   │           └── opencode.rs # OpenCode event normalization
│   ├── Cargo.toml
│   ├── tauri.conf.json         # App manifest, window config, bundle resources
│   └── icons/                  # App icons (PNG + ICNS)
├── sidecar/
│   └── ai-runtime/
│       ├── src/main.mjs        # Vercel AI SDK entrypoint (ESM)
│       ├── bundle/main.mjs     # esbuild output (gitignored, generated)
│       └── package.json
├── hooks/
│   ├── copiwaifu-hook.js       # Universal hook script (all agents except OpenCode)
│   └── copiwaifu-opencode.js   # OpenCode plugin integration
├── public/
│   ├── Core/                   # Live2D Cubism Core JS/WASM runtime
│   └── Resources/Yulia/        # Built-in Yulia Live2D model assets
├── docs/                       # Documentation site
├── scripts/                    # Version sync utilities
├── package.json                # pnpm workspace root (v1.2.1-idiotbaka)
├── pnpm-workspace.yaml
├── vite.config.ts              # Vite 6, port 1420
├── tsconfig.json               # ES2020, strict mode
└── eslint.config.ts            # @panzerjack/eslint-config
```

## Architecture

### Event Flow

```
AI CLI → copiwaifu-hook.js → POST /event (port 23333)
  → navigator/server.rs
  → navigator/providers/*.rs  (normalize event)
  → navigator/reducer.rs      (event → phase/state, build aiTalkContext)
  → navigator/state.rs        (update SessionSnapshot)
  → navigator/session_store.rs (persist to ~/.copiwaifu/sessions/)
  → lib.rs emit_all()         (Tauri event: agent:state-change)
  → useAgentState.ts          (Vue reactive state update)
  → MainWindow.vue            (motion playback + bubble display)
  → ai_talk.rs                (on complete/error → spawn sidecar)
  → sidecar/ai-runtime        (Vercel AI SDK → LLM API)
  → MainWindow.vue            (display AI Talk bubble)
```

### Window Routing

`App.vue` reads the Tauri window label and renders the appropriate component:
- Label `main` → `MainWindow.vue` (the desktop pet)
- Label `settings` → `SettingsWindow.vue`

The main window is transparent, borderless, always-on-top, not in taskbar, and visible on all workspaces. On macOS it is elevated to an NSPanel so it floats above full-screen apps.

### Navigator State Machine

Each agent session is tracked as a `SessionSnapshot`:
```
phases: idle → processing → running_tool → waiting_attention → completed | error
states: idle | thinking | tool_use | error | complete | needs_attention
```

`reducer.rs` maps raw event types to phases/states, maintains a circular digest of recent events and summaries, detects turn boundaries via fingerprinting (session title or summary hash), and builds the `AiTalkContext` struct that gets passed to the sidecar.

Session TTL is 60 seconds — stale sessions are cleaned by a background loop in `agent.rs`.

### AI Talk Pipeline

1. `MainWindow.vue` calls `generate_ai_talk()` Tauri command after `complete` or `error` state
2. `ai_talk.rs` validates settings and claims the `AiTalkContext` from navigator state (one-shot, prevents duplicate calls)
3. If `hasContext` is false or settings are missing, silently returns empty → static bubble is used
4. Spawns Node.js sidecar with context JSON, character name, language, window size
5. `sidecar/ai-runtime/src/main.mjs` calls the configured LLM provider via Vercel AI SDK
6. Text is returned, capped by `limitAiTalkBubbleText()`, then displayed in bubble
7. Any failure (network, provider error, timeout) returns empty → static bubble fallback

### Hook Installation

`hook_installer.rs` installs `copiwaifu-hook.js` to `~/.copiwaifu/hooks/` and adds hook entries to each tool's config:
- **Claude Code**: `~/.claude/settings.json` hooks object
- **GitHub Copilot**: `~/.config/github-copilot/config.json`
- **Codex**: `~/.codex/config.toml` `[hooks]` sections
- **Gemini CLI**: `~/.gemini/settings.json`
- **OpenCode**: `~/.config/opencode/opencode.json` + plugin system (separate `copiwaifu-opencode.js`)

Originals are backed up to `~/.copiwaifu/hooks/original-hooks.json` before modification.

### Custom Model Serving

When a user imports a custom Live2D model, `server.rs` serves its files under `GET /model/current/{filename}`. The frontend `useMainWindowLive2d.ts` loads from this local HTTP URL instead of the bundled `public/Resources/` path.

## Key Types (`src/types/agent.ts`)

```typescript
type AgentType = 'claude-code' | 'copilot' | 'codex' | 'gemini' | 'opencode'
type AppLanguage = 'english' | 'chinese' | 'japanese'
type TAgentState = 'idle' | 'thinking' | 'tool_use' | 'error' | 'complete' | 'needs_attention'
type SessionPhase = 'idle' | 'processing' | 'running_tool' | 'waiting_attention' | 'completed' | 'error'
type WindowSizePreset = 'tiny' | 'small' | 'medium' | 'large' | 'huge'
type TypingSpeedPreset = 'slow' | 'medium' | 'fast' | 'fastest'
type ActionGroupBindingSource = 'manual' | 'auto' | 'unresolved'

interface AiTalkContext {
  agent: AgentType
  sessionId: string
  state: TAgentState
  phase: SessionPhase
  turnIndex: number
  updatedAtMs: number
  workingDirectory?: string
  sessionTitle?: string
  toolName?: string
  recentEventType?: string
  recentSummary?: string
  lastMeaningfulSummary?: string
  hasContext: boolean
  missingFields: string[]
}

interface AppSettings {
  name: string                              // Character name (max 16 chars)
  language: AppLanguage
  autoStart: boolean
  idleGreeting: boolean
  commanderTitle: string
  typingSpeed: TypingSpeedPreset
  modelDirectory: string | null             // Custom Live2D model path
  windowSize: WindowSizePreset
  actionGroupBindings: Record<TAgentState, string | null>  // State → motion group
  aiTalk: AiTalkSettings
  bubbleTheme: BubbleThemeSettings
}
```

## Supported AI Talk Providers

The sidecar supports these providers via Vercel AI SDK:
- OpenAI (and compatible)
- Anthropic
- Google Gemini
- DeepSeek
- Alibaba Bailian / Qwen
- Moonshot Kimi
- Zhipu GLM
- Volcengine Ark / Doubao
- Baidu Qianfan / ERNIE
- Tencent Hunyuan
- MiniMax

## Runtime Data Locations

| Path | Purpose |
|------|---------|
| `~/.copiwaifu/sessions/` | Persisted session snapshots (`{agent}_{sessionId}.json`) |
| `~/.copiwaifu/hooks/` | Installed hook script + original-hooks.json backup |
| `~/.copiwaifu/port` | Primary port discovery file (written by server.rs) |
| `/tmp/copiwaifu-port` | Fallback port discovery for cross-process reads |
| `{tauri-config-dir}/settings.json` | App settings including AI Talk API keys |

## Static Assets

- `public/Core/` — Live2D Cubism Core runtime (JS + WASM), loaded at startup
- `public/Resources/Yulia/` — Bundled Yulia model: `.moc3`, `.model3.json`, `.motion3.json` files per group (Idle, Thinking, Error, Complete, ToolUse, NeedsAttention, etc.), `.png` textures, `.physics3.json`
- `src-tauri/icons/` — App icons (32×32, 128×128, 256×256 PNG + ICNS)

## Conventions and Patterns

### Adding a New Agent Type
1. Add to `AgentType` union in `src/types/agent.ts`
2. Create `navigator/providers/{agent}.rs` implementing `normalize_event()`
3. Register in `navigator/providers/mod.rs`
4. Add hook installation logic in `navigator/hook_installer.rs`
5. Write hook handling in `hooks/copiwaifu-hook.js` (or separate plugin file)
6. Add display label and state strings in `src/i18n.ts`

### Adding a New AI Talk Provider
Edit `sidecar/ai-runtime/src/main.mjs` to add the provider via Vercel AI SDK, then run `pnpm sidecar:build`.

### Adding Settings Fields
1. Update `AppSettings` interface in `src/types/agent.ts`
2. Add UI in `windows/SettingsWindow.vue`
3. Update Rust `AppSettings` struct in `shell.rs` with `serde` defaults
4. Add localized labels in `src/i18n.ts`

### Motion Group Binding
Motion groups auto-detect on normalized names (case-insensitive, stripped of separators). Standard names: `idle`, `thinking`, `tooluse`, `error`, `complete`, `needsattention`. Custom bindings override auto-detect per state.

### Speech Bubble Text Limits
Applied in `useSpeechBubble.ts → limitAiTalkBubbleText()`:
- English: 80 characters max
- Chinese: 40 characters max
- Japanese: 50 characters max

## Implementation Constraints

- AI Talk triggers **only** for `complete` and `error` states, **once per terminal turn**, and **only** when `aiTalkContext.hasContext` is true
- `needs_attention` always uses static bubbles — never trigger AI Talk for this state
- All AI Talk failures (missing config, missing context, sidecar crash, network error, LLM error) must fall back silently to static bubbles — never show raw error text in the pet bubble
- The `claim_ai_talk_context()` call in `ai_talk.rs` is destructive (clears context) to prevent duplicate generation within the same turn
- The sidecar is an ESM bundle; always run `pnpm sidecar:build` after editing `sidecar/ai-runtime/src/main.mjs`
- macOS-specific code (`tauri-nspanel`, `fix_path_env`, `elevate_desktop_pet_window`) is conditionally compiled with `#[cfg(target_os = "macos")]`
- Window dimensions are constrained: min 240×456, max 560×1064; the five `WindowSizePreset` values map to specific pixel sizes within this range
- Character name is validated to max 16 characters in `SettingsWindow.vue`
